import raw from '@/data/eh40.json';

export interface Eh40Entry {
  name: string;
  cas?: string;
  twa?: string;     // canonical display string e.g. "500 ppm (1210 mg/m³)"
  stel?: string;    // canonical display string
  notes?: string;   // e.g. "Sk", "Carc"
  aliases?: string[];
}

interface Eh40File {
  source: string;
  version: string;
  license: string;
  entries: Eh40Entry[];
}

const data: Eh40File = raw as Eh40File;

const normalise = (s: string): string =>
  s.toLowerCase().replace(/\*/g, '').replace(/[^a-z0-9]+/g, '');

// Build lookup indexes once at module load.
const byCas = new Map<string, Eh40Entry[]>();
const byName = new Map<string, Eh40Entry>();

for (const e of data.entries) {
  if (e.cas) {
    const key = e.cas.trim();
    const rows = byCas.get(key) ?? [];
    rows.push(e);
    byCas.set(key, rows);
  }
  byName.set(normalise(e.name), e);
  e.aliases?.forEach((a) => byName.set(normalise(a), e));
}

function closestNameMatch(rows: Eh40Entry[], name: string): Eh40Entry | undefined {
  const n = normalise(name);
  return rows.find((e) => normalise(e.name) === n)
    ?? rows.find((e) => n.includes(normalise(e.name)) || normalise(e.name).includes(n));
}

export function lookupEh40(opts: { cas?: string; name?: string }): Eh40Entry | undefined {
  if (opts.name) {
    const hit = byName.get(normalise(opts.name));
    if (hit) return hit;
  }
  if (opts.cas) {
    const rows = byCas.get(opts.cas.trim());
    if (rows?.length) return opts.name ? closestNameMatch(rows, opts.name) ?? rows[0] : rows[0];
  }
  return undefined;
}

export const eh40Meta = {
  source: data.source,
  version: data.version,
  count: data.entries.length,
};
