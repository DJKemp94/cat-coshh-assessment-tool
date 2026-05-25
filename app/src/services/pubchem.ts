import { GhsPictogram, HCode, SubstanceForm, WelSource } from '@/types/assessment';
import { lookupEh40 } from '@/services/eh40';

const REST = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';
const AUTOCOMPLETE = 'https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound';
const CACHE_PREFIX = 'cat.pubchem.v4.';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

export interface PubChemResult {
  cid: number;
  cas?: string;
  name: string;
  hazardStatements: HCode[];
  pictograms: GhsPictogram[];
  wel: { twa?: string; stel?: string; source?: WelSource };
  form?: SubstanceForm;
  formNote?: string;
  sdsUrl?: string;
  sdsSource?: string;
  /** Median boiling point in °C across reported sources, or undefined if unparseable. */
  boilingPointC?: number;
  /** Molecular formula (e.g. "C2H6O"). Used to determine organic vs inorganic. */
  molecularFormula?: string;
  fetchedAt: string;
}

export interface PubChemAutocompleteSuggestion {
  name: string;
  cid?: number;
}

// ---------- rate-limited queue (≤5 req/s, internal min gap 250 ms) ----------

let last = 0;
const gap = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, last + gap - now);
  if (wait) await sleep(wait);
  last = Date.now();
  return fetch(url, { headers: { Accept: 'application/json' } });
}

// ---------- cache ----------

interface CacheEntry {
  fetchedAt: string;
  result: PubChemResult;
}

function readCache(cid: number): PubChemResult | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + cid);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - new Date(entry.fetchedAt).getTime() > CACHE_TTL_MS) return null;
    return entry.result;
  } catch {
    return null;
  }
}

function writeCache(result: PubChemResult) {
  try {
    const entry: CacheEntry = { fetchedAt: result.fetchedAt, result };
    localStorage.setItem(CACHE_PREFIX + result.cid, JSON.stringify(entry));
  } catch {
    /* quota / unavailable — ignore */
  }
}

// ---------- name → CID ----------

const CAS_RE = /^\s*\d{2,7}-\d{2}-\d\s*$/;

async function nameToCid(name: string): Promise<number | null> {
  const url = `${REST}/compound/name/${encodeURIComponent(name)}/cids/JSON`;
  const r = await rateLimitedFetch(url);
  if (!r.ok) return null;
  const j = (await r.json()) as { IdentifierList?: { CID?: number[] } };
  return j.IdentifierList?.CID?.[0] ?? null;
}

async function casToCid(cas: string): Promise<number | null> {
  const trimmed = cas.trim();
  const byName = await nameToCid(trimmed);
  if (byName) return byName;

  const url = `${REST}/compound/xref/RN/${encodeURIComponent(trimmed)}/cids/JSON`;
  const r = await rateLimitedFetch(url);
  if (!r.ok) return null;
  const j = (await r.json()) as { IdentifierList?: { CID?: number[] } };
  const candidates = j.IdentifierList?.CID ?? [];
  for (const cid of candidates) {
    const synonyms = await fetchSynonyms(cid);
    if (synonyms.some((s) => s.trim() === trimmed)) return cid;
  }
  return candidates[0] ?? null;
}

async function resolveCid(query: string): Promise<number | null> {
  if (CAS_RE.test(query)) {
    const direct = await casToCid(query);
    if (direct) return direct;
    // Some retired CAS numbers route through name lookup instead.
    return nameToCid(query.trim());
  }
  const direct = await nameToCid(query);
  if (direct) return direct;
  // Fallback: try the autocomplete dictionary — PubChem returns canonical names
  // that the /name/ endpoint will then resolve cleanly (handles cases where the
  // user's typed form, e.g. "butane", isn't a primary synonym).
  const suggestions = await autocompleteNames(query, 5);
  for (const candidate of suggestions) {
    if (candidate.toLowerCase() === query.toLowerCase()) continue;
    const cid = await nameToCid(candidate);
    if (cid) return cid;
  }
  return null;
}

// ---------- PUG-View parsing ----------

interface ViewNode {
  TOCHeading?: string;
  Section?: ViewNode[];
  Information?: ViewInfo[];
}
interface ViewInfo {
  Name?: string;
  Reference?: string[];
  URL?: string;
  Value?: {
    StringWithMarkup?: { String: string; Markup?: { URL?: string; Extra?: string }[] }[];
    Number?: number[];
    Unit?: string;
    ExternalDataURL?: string[];
  };
}

function walk(root: ViewNode, heading: string): ViewNode[] {
  const out: ViewNode[] = [];
  const visit = (n: ViewNode) => {
    if (n.TOCHeading === heading) out.push(n);
    n.Section?.forEach(visit);
  };
  visit(root);
  return out;
}

function collectSds(root: ViewNode | undefined): { url?: string; source?: string } {
  if (!root) return {};
  const candidates: { url: string; source: string }[] = [];
  const visit = (n: ViewNode) => {
    if (n.TOCHeading && /safety data sheet/i.test(n.TOCHeading)) {
      n.Information?.forEach((info) => {
        const source = info.Reference?.[0] ?? info.Name ?? 'SDS';
        const urls: string[] = [];
        if (info.URL) urls.push(info.URL);
        info.Value?.ExternalDataURL?.forEach((u) => urls.push(u));
        info.Value?.StringWithMarkup?.forEach((s) =>
          s.Markup?.forEach((m) => m.URL && urls.push(m.URL)),
        );
        urls.forEach((url) => candidates.push({ url, source }));
      });
    }
    n.Section?.forEach(visit);
  };
  visit(root);
  // Prefer Sigma-Aldrich / Fisher / Merck (most reliable, current revisions); fallback to first.
  const ranked = candidates.sort((a, b) => priority(b.source) - priority(a.source));
  return ranked[0] ? { url: ranked[0].url, source: ranked[0].source } : {};
}

function priority(source: string): number {
  const s = source.toLowerCase();
  if (/sigma|aldrich|merck/.test(s)) return 5;
  if (/fisher|fluka/.test(s)) return 4;
  if (/tci|alfa/.test(s)) return 3;
  if (/cameo/.test(s)) return 2;
  return 1;
}

function infoStrings(node: ViewNode | undefined, name?: string): string[] {
  if (!node) return [];
  const out: string[] = [];
  const visit = (n: ViewNode) => {
    n.Information?.forEach((info) => {
      if (name && info.Name !== name) return;
      info.Value?.StringWithMarkup?.forEach((s) => out.push(s.String));
    });
    n.Section?.forEach(visit);
  };
  visit(node);
  return out;
}

const PICTOGRAM_MAP: { match: RegExp; pic: GhsPictogram }[] = [
  { match: /explosiv/i, pic: 'explosive' },
  { match: /flammab/i, pic: 'flammable' },
  { match: /oxidi[sz]/i, pic: 'oxidising' },
  { match: /gas.*pressure|compressed gas/i, pic: 'compressed-gas' },
  { match: /corrosiv/i, pic: 'corrosive' },
  { match: /acute toxic|skull/i, pic: 'toxic' },
  { match: /irritant|harmful|exclamation/i, pic: 'harmful' },
  { match: /health hazard|carcinog|mutagen|reproductive/i, pic: 'health-hazard' },
  { match: /environment/i, pic: 'environmental' },
];

const PUBCHEM_GHS_CODE_MAP: Record<string, GhsPictogram> = {
  GHS01: 'explosive',
  GHS02: 'flammable',
  GHS03: 'oxidising',
  GHS04: 'compressed-gas',
  GHS05: 'corrosive',
  GHS06: 'toxic',
  GHS07: 'harmful',
  GHS08: 'health-hazard',
  GHS09: 'environmental',
};

function parseHCodes(strings: string[]): HCode[] {
  const set = new Map<string, string>();
  // Tolerates the ECHA convention "H370 **:" (asterisks denote route-specific
  // classification) and the notifier-percentage format "H225 (99.9%):".
  const re = /(H\d{3}[A-Za-z]{0,3})\s*\*{0,3}\s*(?:\([^)]*\)\s*)?[:\s\-—]+([^;\n[]+)/g;
  strings.forEach((s) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      const code = m[1].toUpperCase();
      // Preserve original case for the suffix letters (H360FD, H350i).
      const normalised = code.replace(/^H(\d{3})([A-Z]*)$/, (_, n, suf: string) =>
        `H${n}${suf.length === 1 ? suf.toLowerCase() : suf}`,
      );
      if (!set.has(normalised)) set.set(normalised, m[2].trim());
    }
  });
  return [...set.entries()].map(([code, text]) => ({ code, text }));
}

function parsePictograms(strings: string[]): GhsPictogram[] {
  const found = new Set<GhsPictogram>();
  strings.forEach((s) => {
    PICTOGRAM_MAP.forEach(({ match, pic }) => {
      if (match.test(s)) found.add(pic);
    });
  });
  return [...found];
}

function parseWel(strings: string[]): { twa?: string; stel?: string; source?: WelSource } {
  const joined = strings.join(' \n ');
  let twa: string | undefined;
  let stel: string | undefined;
  let source: WelSource | undefined;

  const twaMatch = joined.match(/(?:TWA|8[- ]?hour TWA|PEL[^.]*?)[:\s]+([0-9.]+\s*(?:ppm|mg\/m\^?3|mg\/m3))/i);
  if (twaMatch) twa = twaMatch[1].replace(/\^/g, '');
  const stelMatch = joined.match(/STEL[^0-9]*([0-9.]+\s*(?:ppm|mg\/m\^?3|mg\/m3))/i);
  if (stelMatch) stel = stelMatch[1].replace(/\^/g, '');
  if (/OSHA/i.test(joined)) source = 'PubChem-OSHA';
  else if (/NIOSH/i.test(joined)) source = 'PubChem-NIOSH';

  return { twa, stel, source };
}

function parseBoilingPointC(strings: string[]): number | undefined {
  // PubChem returns multiple BP entries from different sources, formats like:
  //   "148.3 °F at 760 mmHg (NTP, 1992)"
  //   "64.7 °C at 760 mm Hg"
  //   "64.00 to 65.00 °C. @ 760.00 mm Hg"   (range → midpoint)
  // We collect every parseable value (in °C) and return the median, which is
  // robust against outliers and stale source entries.
  const values: number[] = [];
  const rangeRe = /([-+]?\d+(?:\.\d+)?)\s*(?:to|-|–|—)\s*([-+]?\d+(?:\.\d+)?)\s*°?\s*([CF])\b/i;
  const pointRe = /([-+]?\d+(?:\.\d+)?)\s*°?\s*([CF])\b/i;
  for (const raw of strings) {
    // Skip entries that contain text we cannot trust (e.g. "decomposes", "subl.")
    if (/decompos|sublim|N\/A|not applicable/i.test(raw)) continue;
    const r = rangeRe.exec(raw);
    let valueC: number | null = null;
    if (r) {
      const lo = parseFloat(r[1]);
      const hi = parseFloat(r[2]);
      const mid = (lo + hi) / 2;
      valueC = r[3].toUpperCase() === 'F' ? (mid - 32) * (5 / 9) : mid;
    } else {
      const p = pointRe.exec(raw);
      if (p) {
        const v = parseFloat(p[1]);
        valueC = p[2].toUpperCase() === 'F' ? (v - 32) * (5 / 9) : v;
      }
    }
    if (valueC !== null && Number.isFinite(valueC) && valueC > -100 && valueC < 600) {
      values.push(valueC);
    }
  }
  if (values.length === 0) return undefined;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return Math.round(median * 10) / 10;
}

function parseForm(strings: string[]): { form?: SubstanceForm; note?: string } {
  // PubChem lists multiple supplier-variant descriptions per substance
  // (e.g. methanol has a "Liquid; Dry Powder, Liquid; Pellets" entry from
  // industrial preparations). Vote across all strings rather than picking the
  // first regex hit — most-frequent form wins, ties broken by primary states.
  const tally: Record<SubstanceForm, number> = {
    gas: 0, liquid: 0, solid: 0, vapour: 0, aerosol: 0, mist: 0, powder: 0, other: 0,
  };
  const patterns: { re: RegExp; form: SubstanceForm }[] = [
    { re: /\bliquid\b/gi, form: 'liquid' },
    { re: /\bgas\b/gi, form: 'gas' },
    { re: /\b(?:solid|crystal|pellet|granule|flake)/gi, form: 'solid' },
    { re: /\bpowder\b/gi, form: 'powder' },
    { re: /\bvapou?r\b/gi, form: 'vapour' },
    { re: /\baerosol\b/gi, form: 'aerosol' },
    { re: /\bmist\b/gi, form: 'mist' },
  ];
  for (const s of strings) {
    for (const { re, form } of patterns) {
      tally[form] += (s.match(re) ?? []).length;
    }
  }
  // Order: primary states first to break ties (liquid > solid > gas), then specialised.
  const order: SubstanceForm[] = ['liquid', 'solid', 'gas', 'powder', 'vapour', 'aerosol', 'mist'];
  let best: SubstanceForm | undefined;
  let bestCount = 0;
  for (const f of order) {
    if (tally[f] > bestCount) { best = f; bestCount = tally[f]; }
  }
  return best ? { form: best } : {};
}

async function fetchPugView(cid: number): Promise<ViewNode | null> {
  const r = await rateLimitedFetch(`${VIEW}/data/compound/${cid}/JSON`);
  if (!r.ok) return null;
  const j = (await r.json()) as { Record?: ViewNode };
  return j.Record ?? null;
}

async function fetchCas(cid: number): Promise<string | undefined> {
  try {
    const synonyms = await fetchSynonyms(cid);
    const cas = synonyms.find((s) => /^\d{2,7}-\d{2}-\d$/.test(s));
    return cas;
  } catch {
    return undefined;
  }
}

async function fetchPreferredName(cid: number): Promise<string | undefined> {
  try {
    return (await fetchSynonyms(cid))[0];
  } catch {
    return undefined;
  }
}

async function fetchSynonyms(cid: number): Promise<string[]> {
  const r = await rateLimitedFetch(`${REST}/compound/cid/${cid}/synonyms/JSON`);
  if (!r.ok) return [];
  const j = (await r.json()) as {
    InformationList?: { Information?: { Synonym?: string[] }[] };
  };
  return j.InformationList?.Information?.[0]?.Synonym ?? [];
}

// ---------- public API ----------

/**
 * Normalize a chemical name's casing after fetching from PubChem.
 * PubChem returns names in inconsistent casing: sometimes ALL CAPS,
 * sometimes lowercase, sometimes mixed. This converts all-uppercase
 * names to title case and ensures the first letter is capitalized.
 */
function normalizeChemicalName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  // If the entire name is uppercase (contains at least one letter),
  // convert to lowercase then title-case each word.
  if (/[A-Z]/.test(trimmed) && trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  // Otherwise just ensure the first letter is capitalized.
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export async function lookupChemical(
  query: string | number,
  opts: { force?: boolean } = {},
): Promise<PubChemResult> {
  let cid: number | null = typeof query === 'number' ? query : null;
  if (cid === null) cid = await resolveCid(String(query));
  if (cid === null) throw new Error(`PubChem: no match found for "${query}"`);

  if (!opts.force) {
    const cached = readCache(cid);
    if (cached) return cached;
  }

  const record = await fetchPugView(cid);
  const ghsNodes = record ? walk(record, 'GHS Classification') : [];
  const expNodes = record ? walk(record, 'Exposure Limits') : [];
  const physNodes = record ? walk(record, 'Physical Description') : [];
  const bpNodes = record ? walk(record, 'Boiling Point') : [];
  const boilingPointC = parseBoilingPointC(bpNodes.flatMap((n) => infoStrings(n)));

  // The single "GHS Classification" node contains ~30 sibling Information
  // entries: a primary block (Pictogram → Signal → GHS Hazard Statements …)
  // followed by repeated notifier-subgroup blocks (each starting again with
  // Pictogram). The notifier blocks contain minority classifications such as
  // H351 / H360FD from a handful of suppliers — including them systematically
  // over-classifies. We take only the FIRST "GHS Hazard Statements" entry and
  // the FIRST "Pictogram(s)" entry, which together form the authoritative set.
  const primaryGhs = ghsNodes[0];
  const firstInfoByName = (name: string): ViewInfo | undefined =>
    (primaryGhs?.Information ?? []).find((i) => i.Name === name);
  const hazardInfo = firstInfoByName('GHS Hazard Statements');
  const hCodes = parseHCodes(
    hazardInfo?.Value?.StringWithMarkup?.map((s) => s.String) ?? [],
  );

  // Pictograms: parse from the PubChem icon markup (Extra field holds the
  // canonical GHS0X code). Falls back to keyword matching against hazard
  // statement text if Markup is unavailable.
  const pictogramSet = new Set<GhsPictogram>();
  const picInfo = firstInfoByName('Pictogram(s)');
  picInfo?.Value?.StringWithMarkup?.forEach((s) =>
    s.Markup?.forEach((m) => {
      const code = m.URL?.match(/GHS0[1-9]/)?.[0];
      const pic = code ? PUBCHEM_GHS_CODE_MAP[code] : undefined;
      if (pic) pictogramSet.add(pic);
    }),
  );
  if (pictogramSet.size === 0) {
    parsePictograms(
      hazardInfo?.Value?.StringWithMarkup?.map((s) => s.String) ?? [],
    ).forEach((p) => pictogramSet.add(p));
  }
  const pictograms = [...pictogramSet];

  const expStrings = expNodes.flatMap((n) => infoStrings(n));
  const wel = parseWel(expStrings);

  const physStrings = physNodes.flatMap((n) => infoStrings(n));
  const formInfo = parseForm(physStrings);

  const name = normalizeChemicalName(
    (await fetchPreferredName(cid)) ?? (typeof query === 'string' ? query : `CID ${cid}`)
  );

  const sds = collectSds(record ?? undefined);

  // CAS — PubChem exposes it in synonyms; the first xxx-xx-x match wins.
  const cas = await fetchCas(cid);

  // EH40 override: if we have UK WEL data for this CAS or name, prefer it
  // (EH40 is the authoritative UK source for WEL/STEL/TWA).
  const eh40 = lookupEh40({ cas, name });
  const mergedWel = eh40
    ? { twa: eh40.twa ?? wel.twa, stel: eh40.stel ?? wel.stel, source: 'EH40' as WelSource }
    : wel;

  const result: PubChemResult = {
    cid,
    cas,
    name,
    hazardStatements: hCodes,
    pictograms,
    wel: mergedWel,
    form: formInfo.form,
    formNote: formInfo.note,
    sdsUrl: sds.url,
    sdsSource: sds.source,
    boilingPointC,
    fetchedAt: new Date().toISOString(),
  };

  writeCache(result);
  return result;
}

export async function autocompleteNames(
  prefix: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<string[]> {
  const q = prefix.trim();
  if (q.length < 2) return [];
  const url = `${AUTOCOMPLETE}/${encodeURIComponent(q)}/json?limit=${limit}`;
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) return [];
  const j = (await r.json()) as { dictionary_terms?: { compound?: string[] } };
  return j.dictionary_terms?.compound ?? [];
}

async function cidForAutocompleteName(name: string, signal?: AbortSignal): Promise<number | undefined> {
  const url = `${REST}/compound/name/${encodeURIComponent(name)}/cids/JSON`;
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) return undefined;
  const j = (await r.json()) as { IdentifierList?: { CID?: number[] } };
  return j.IdentifierList?.CID?.[0];
}

export async function autocompleteChemicals(
  prefix: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<PubChemAutocompleteSuggestion[]> {
  const names = await autocompleteNames(prefix, limit, signal);
  const out: PubChemAutocompleteSuggestion[] = [];
  for (const name of names) {
    if (signal?.aborted) break;
    try {
      out.push({ name, cid: await cidForAutocompleteName(name, signal) });
    } catch {
      if (signal?.aborted) break;
      out.push({ name });
    }
  }
  return out;
}

export function clearPubChemCache() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
