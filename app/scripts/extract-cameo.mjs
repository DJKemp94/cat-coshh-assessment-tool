import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const defaultDb = '/Applications/CAMEO Chemicals 3.1.0.app/Contents/Resources/server/CAMEOChemicalsServer/_internal/cameo.sqlite';
const dbPath = process.argv[2] || process.env.CAMEO_SQLITE || defaultDb;
const outDir = resolve(appRoot, 'src/data/cameo');

function sqliteJson(sql) {
  const raw = execFileSync('sqlite3', ['-json', dbPath, sql], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 80 });
  return JSON.parse(raw || '[]');
}

function splitPipe(value) {
  return String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitSynonyms(value) {
  return String(value || '')
    .split(/\||\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 80);
}

function cleanText(value, maxLength = 900) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

mkdirSync(outDir, { recursive: true });

const info = sqliteJson('select version, import_date from info limit 1;')[0] ?? {};
const casRows = sqliteJson('select chem_id, cas_id from chemical_cas order by chem_id, sort;');
const casByChem = new Map();
for (const row of casRows) {
  const list = casByChem.get(row.chem_id) ?? [];
  list.push(row.cas_id);
  casByChem.set(row.chem_id, list);
}

const chemicals = sqliteJson(`
  select
    id,
    name,
    synonyms,
    dot_labels,
    formulas,
    air_water_reactions,
    chemical_profile,
    special_hazards,
    incompatible_absorbents,
    nfpa_flam,
    nfpa_health,
    nfpa_react,
    nfpa_special
  from chemicals
  order by name;
`).map((row) => ({
  id: row.id,
  name: row.name,
  cas: casByChem.get(row.id) ?? [],
  synonyms: splitSynonyms(row.synonyms),
  dotLabels: splitPipe(row.dot_labels),
  formulas: splitPipe(row.formulas),
  airWaterReactions: cleanText(row.air_water_reactions),
  chemicalProfile: cleanText(row.chemical_profile),
  specialHazards: cleanText(row.special_hazards),
  incompatibleAbsorbents: splitPipe(row.incompatible_absorbents),
  nfpa: {
    flammability: row.nfpa_flam,
    health: row.nfpa_health,
    reactivity: row.nfpa_react,
    special: cleanText(row.nfpa_special, 160),
  },
}));

const reactiveGroups = sqliteJson(`
  select id, name, special, description, flammability, reactivity, toxicity, characteristics, examples
  from reacts
  order by name;
`).map((row) => ({
  id: row.id,
  name: row.name,
  special: Boolean(row.special),
  description: cleanText(row.description, 600),
  flammability: cleanText(row.flammability, 500),
  reactivity: cleanText(row.reactivity, 500),
  toxicity: cleanText(row.toxicity, 500),
  characteristics: cleanText(row.characteristics, 500),
  examples: cleanText(row.examples, 500),
}));

const chemicalGroups = sqliteJson(`
  select chem_id as chemicalId, react_id as groupId
  from mm_chemical_react
  order by chem_id, react_id;
`);

const reactivityHazards = sqliteJson(`
  select mh.react1, mh.react2, h.name, h.phrases
  from mm_reactivity_hazard mh
  join hazards h on h.id = mh.hazard_id
  order by mh.react1, mh.react2, h.id;
`);
const hazardsByPair = new Map();
for (const row of reactivityHazards) {
  const key = `${row.react1}:${row.react2}`;
  const list = hazardsByPair.get(key) ?? [];
  list.push({ name: row.name, phrases: splitPipe(row.phrases) });
  hazardsByPair.set(key, list);
}

const reactivity = sqliteJson(`
  select react1, react2, pair_compatibility, gas_products, hazards_documentation
  from reactivity
  order by react1, react2;
`).map((row) => ({
  groupA: row.react1,
  groupB: row.react2,
  compatibility: row.pair_compatibility,
  gasProducts: splitPipe(row.gas_products),
  hazardsDocumentation: cleanText(row.hazards_documentation),
  hazards: hazardsByPair.get(`${row.react1}:${row.react2}`) ?? [],
}));

const payloads = {
  'meta.json': {
    version: info.version ?? 'unknown',
    importDate: info.import_date ?? '',
    extractedAt: new Date().toISOString(),
    source: 'CAMEO Chemicals database',
    counts: {
      chemicals: chemicals.length,
      reactiveGroups: reactiveGroups.length,
      chemicalGroups: chemicalGroups.length,
      reactivity: reactivity.length,
    },
  },
  'chemicals.json': chemicals,
  'reactiveGroups.json': reactiveGroups,
  'chemicalGroups.json': chemicalGroups,
  'reactivity.json': reactivity,
};

for (const [file, payload] of Object.entries(payloads)) {
  writeFileSync(resolve(outDir, file), `${JSON.stringify(payload)}\n`);
}

console.log(`Extracted CAMEO ${info.version ?? 'unknown'} to ${outDir}`);
