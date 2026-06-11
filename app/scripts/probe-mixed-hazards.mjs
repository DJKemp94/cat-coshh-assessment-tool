/**
 * One-off audit probe: mixed-hazard chemicals through the real classifier.
 * Not a regression gate — used to verify suspected tier-list gaps.
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const outdir = join(tmpdir(), 'cat-storage20-probe');
const cameoOutfile = join(outdir, 'cameo-storage.mjs');
const classifierOutfile = join(outdir, 'storage20-classifier.mjs');
await mkdir(outdir, { recursive: true });

for (const [entry, outfile] of [
  ['cameoStorage.ts', cameoOutfile],
  ['storage20Classifier.ts', classifierOutfile],
]) {
  await build({
    entryPoints: [join(import.meta.dirname, '..', 'src', 'services', entry)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    tsconfig: join(import.meta.dirname, '..', 'tsconfig.json'),
    logLevel: 'error',
  });
}

const { resolveCameoMatch } = await import(`file://${cameoOutfile}?t=${Date.now()}`);
const { classifyStorage20 } = await import(`file://${classifierOutfile}?t=${Date.now()}`);

function substance(input, id) {
  return {
    id,
    name: input.name,
    cas: input.cas ?? '',
    hazardStatements: (input.codes ?? []).map((code) => ({ code, text: code })),
    ghsPictograms: input.pictograms ?? [],
    wel: {},
    quantity: 'probe',
    form: input.form ?? 'liquid',
    exposureDuration: 'test',
    exposureFrequency: 'test',
    exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
    flashPointC: input.flash,
    vapourPressureKPa: input.vapourPressure,
    phValue: input.ph,
    canonicalSmiles: input.smiles,
    molecularFormula: input.formula,
    iupacName: input.iupacName,
  };
}

const cases = [
  // A. Flammable halogenated solvents — does the chlorinated-name signal evict them from flammables?
  { name: '1,2-Dichloroethane', cas: '107-06-2', codes: ['H225', 'H302', 'H319', 'H331', 'H350'], pictograms: ['flammable', 'toxic', 'health-hazard'], flash: -17, formula: 'C2H4Cl2' },
  { name: 'Chlorobenzene', cas: '108-90-7', codes: ['H226', 'H332', 'H411'], pictograms: ['flammable'], flash: 27, formula: 'C6H5Cl' },
  { name: 'Chloroform', cas: '67-66-3', codes: ['H302', 'H315', 'H331', 'H351'], pictograms: ['toxic', 'health-hazard'], formula: 'CHCl3' },

  // B. Flammable organic bases — acids get a flammables carve-out, do bases?
  { name: 'Pyridine', cas: '110-86-1', codes: ['H225', 'H302', 'H312', 'H332'], pictograms: ['flammable'], flash: 20, formula: 'C5H5N' },
  { name: 'Triethylamine', cas: '121-44-8', codes: ['H225', 'H302', 'H311', 'H314', 'H331'], pictograms: ['flammable', 'corrosive', 'toxic'], flash: -11, formula: 'C6H15N' },
  { name: 'Allylamine', cas: '107-11-9', codes: ['H225', 'H301', 'H310', 'H330'], pictograms: ['flammable', 'toxic'], flash: -29, formula: 'C3H7N' },
  { name: 'Ethylenediamine', cas: '107-15-3', codes: ['H226', 'H302', 'H312', 'H314', 'H317', 'H334'], pictograms: ['flammable', 'corrosive'], flash: 34, formula: 'C2H8N2' },

  // C. Benign "acid"-named chemicals — do they crowd the acids cabinet?
  { name: 'Citric acid', cas: '77-92-9', codes: ['H319'], pictograms: [], form: 'solid', formula: 'C6H8O7' },
  { name: 'L-Ascorbic acid', cas: '50-81-7', codes: [], form: 'solid', formula: 'C6H8O6' },
  { name: 'Stearic acid', cas: '57-11-4', codes: [], form: 'solid', formula: 'C18H36O2' },
  { name: 'EDTA', cas: '60-00-4', codes: ['H319'], form: 'solid', formula: 'C10H16N2O8', iupacName: '2-[2-[bis(carboxymethyl)amino]ethyl-(carboxymethyl)amino]acetic acid' },
  { name: 'Boric acid', cas: '10043-35-3', codes: ['H360'], pictograms: ['health-hazard'], form: 'solid', formula: 'BH3O3' },

  // D. Severe-toxic flammables (precedence sanity check — comment says flammables cabinet + toxic controls)
  { name: 'Methanol', cas: '67-56-1', codes: ['H225', 'H301', 'H311', 'H331', 'H370'], pictograms: ['flammable', 'toxic'], flash: 11, formula: 'CH4O' },
  { name: 'Acrylonitrile', cas: '107-13-1', codes: ['H225', 'H301', 'H311', 'H331', 'H350'], pictograms: ['flammable', 'toxic', 'health-hazard'], flash: -1, formula: 'C3H3N' },
  { name: 'Epichlorohydrin', cas: '106-89-8', codes: ['H226', 'H301', 'H311', 'H314', 'H331', 'H350'], pictograms: ['flammable', 'toxic', 'corrosive', 'health-hazard'], flash: 31, formula: 'C3H5ClO' },

  // E. Corrosive toxics with no acid/base name
  { name: 'Phenol', cas: '108-95-2', codes: ['H301', 'H311', 'H314', 'H331', 'H341', 'H373'], pictograms: ['toxic', 'corrosive', 'health-hazard'], form: 'solid', formula: 'C6H6O' },
  { name: 'Hydrazine hydrate', cas: '302-01-2', codes: ['H226', 'H301', 'H311', 'H314', 'H331', 'H350'], pictograms: ['flammable', 'toxic', 'corrosive', 'health-hazard'], flash: 52, formula: 'H4N2' },

  // F. Oxidiser combos
  { name: 'Calcium hypochlorite', cas: '7778-54-3', codes: ['H272', 'H302', 'H314', 'EUH031'], pictograms: ['oxidising', 'corrosive'], form: 'solid', formula: 'CaCl2O2' },
  { name: 'Silver nitrate', cas: '7761-88-8', codes: ['H272', 'H314'], pictograms: ['oxidising', 'corrosive'], form: 'solid', formula: 'AgNO3' },
  { name: 'Hydrogen peroxide 30%', cas: '7722-84-1', codes: ['H271', 'H302', 'H314', 'H332'], pictograms: ['oxidising', 'corrosive'], formula: 'H2O2' },

  // G. Acid/base double signal
  { name: 'Picolinic acid', cas: '98-98-6', codes: ['H302', 'H315', 'H319'], form: 'solid', formula: 'C6H5NO2', iupacName: 'pyridine-2-carboxylic acid' },
  { name: 'Sulfamic acid', cas: '5329-14-6', codes: ['H315', 'H319', 'H412'], form: 'solid', formula: 'H3NO3S' },
];

for (const input of cases) {
  const match = resolveCameoMatch(substance(input, `probe-${input.cas}`));
  const a = classifyStorage20(match);
  const groups = match.groups.map((g) => `${g.id}:${g.name}`).join(', ') || '(no CAMEO)';
  console.log(`${input.name}`);
  console.log(`  zone=${a.zoneId} cabinet=${a.cabinetId} category=${a.category} confidence=${a.confidence}`);
  console.log(`  groups: ${groups}`);
  console.log(`  requirements: ${a.requirements.join(' | ') || '(none)'}`);
  console.log('');
}
