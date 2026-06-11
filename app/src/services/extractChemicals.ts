import raw from '@/data/eh40.json';
import cameoRaw from '@/data/cameo/chemicals.json';
import { normalizeChemicalName } from '@/services/chemicalNames';

export interface ExtractMatch {
  name: string;        // canonical EH40 name to surface to the user
  cas?: string;
  matchedTerm: string; // the phrase found in the source text
}

interface Eh40Entry {
  name: string;
  cas?: string;
  aliases?: string[];
}

// Common lab synonyms that aren't in EH40 directly but route to an EH40 substance.
const SYNONYMS: { term: string; cas: string }[] = [
  { term: 'dcm',       cas: '75-09-2' },     // dichloromethane
  { term: 'methylene chloride', cas: '75-09-2' },
  { term: 'meoh',      cas: '67-56-1' },     // methanol
  { term: 'methyl alcohol', cas: '67-56-1' },
  { term: 'etoh',      cas: '64-17-5' },     // ethanol
  { term: 'ethyl alcohol', cas: '64-17-5' },
  { term: 'iproh',     cas: '67-63-0' },     // isopropanol
  { term: 'ipa',       cas: '67-63-0' },
  { term: 'isopropyl alcohol', cas: '67-63-0' },
  { term: 'acn',       cas: '75-05-8' },     // acetonitrile
  { term: 'dmf',       cas: '68-12-2' },     // N,N-dimethylformamide
  { term: 'dmso',      cas: '67-68-5' },     // not in EH40 but useful
  { term: 'thf',       cas: '109-99-9' },    // tetrahydrofuran
  { term: 'etoac',     cas: '141-78-6' },    // ethyl acetate
  { term: 'hexanes',   cas: '110-54-3' },    // n-hexane
];

interface Index {
  // sorted descending by length so multi-word names match before single-word
  terms: { term: string; canonical: string; cas?: string }[];
}

const data = raw as { entries: Eh40Entry[] };

// Build the search index once per session.
const index: Index = (() => {
  const out: Index['terms'] = [];
  const seen = new Set<string>();

  const push = (term: string, canonical: string, cas?: string) => {
    const norm = term.toLowerCase().trim();
    if (!norm || norm.length < 3) return;
    if (seen.has(norm)) return;
    seen.add(norm);
    out.push({ term: norm, canonical, cas });
  };

  for (const e of data.entries) {
    // Strip parenthetical qualifiers ("(mist)", "(as Cd)", etc.) for matching.
    const base = e.name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    push(base, e.name, e.cas);
    push(e.name, e.name, e.cas);
    e.aliases?.forEach((a) => push(a, e.name, e.cas));
  }
  for (const syn of SYNONYMS) {
    const eh = data.entries.find((e) => e.cas === syn.cas);
    push(syn.term, eh?.name ?? syn.term, syn.cas);
  }

  // CAMEO primary names extend coverage to substances without a UK WEL
  // (e.g. benzoic acid). Pushed after EH40 so EH40 stays the canonical source
  // for terms both datasets know. Inverted index-style names ("CINNAMIC ACID,
  // P-[...]") and short codes are skipped; a stoplist drops names that are
  // also common English words.
  const CAMEO_STOPLIST = new Set(['film', 'lead', 'oil', 'acid', 'base', 'salt', 'water']);
  for (const e of cameoRaw as { name?: string; cas?: string[] }[]) {
    const name = e.name?.trim();
    if (!name || name.length < 4 || name.length > 60) continue;
    if (name.includes(',') || name.includes('%')) continue;
    if (CAMEO_STOPLIST.has(name.toLowerCase())) continue;
    push(name, normalizeChemicalName(name), e.cas?.[0]);
  }

  // Longest-first so "ethyl acetate" matches before "acetate" etc.
  out.sort((a, b) => b.term.length - a.term.length);
  return { terms: out };
})();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function extractChemicals(text: string): ExtractMatch[] {
  const haystack = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const matches = new Map<string, ExtractMatch>();
  const taken: Array<[number, number]> = [];

  const overlaps = (start: number, end: number) =>
    taken.some(([s, e]) => start < e && end > s);

  for (const { term, canonical, cas } of index.terms) {
    const re = new RegExp(`(?<![\\w-])${escapeRegex(term)}(?![\\w-])`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(haystack)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      taken.push([start, end]);
      const key = (cas ?? canonical).toLowerCase();
      if (!matches.has(key)) {
        matches.set(key, { name: canonical, cas, matchedTerm: m[0].trim() });
      }
    }
  }

  return Array.from(matches.values());
}
