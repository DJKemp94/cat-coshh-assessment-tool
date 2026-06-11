import { GhsPictogram, Substance, SubstanceForm } from '@/types/assessment';

export const FLAMMABLE_CODES = ['H220', 'H221', 'H222', 'H223', 'H224', 'H225', 'H226', 'H227', 'H228', 'H242'];
const CORROSIVE_CODES = ['H290', 'H314', 'H318'];
const ACUTE_TOXIC_CODES = ['H300', 'H301', 'H310', 'H311', 'H330', 'H331'];
const CHRONIC_TOXIC_CODES = ['H340', 'H341', 'H350', 'H351', 'H360', 'H361', 'H370', 'H371', 'H372', 'H373'];
export const OXIDISING_CODES = ['H270', 'H271', 'H272'];
export const WATER_REACTIVE_CODES = ['H260', 'H261'];
export const PYROPHORIC_CODES = ['H250', 'H251', 'H252', 'H230', 'H231'];
export const EXPLOSIVE_CODES = ['H200', 'H201', 'H202', 'H203', 'H204', 'H205', 'H206', 'H207', 'H208', 'H240', 'H241'];
export const EUH_WATER_REACTIVE_CODES = ['EUH014', 'EUH029'];
export const EUH_ACID_GAS_CODES = ['EUH031', 'EUH032'];
export const EUH_PEROXIDE_CODES = ['EUH019'];
export const EUH_EXPLOSIVE_VAPOUR_CODES = ['EUH018'];

type StorageSuggestionGroup =
  | 'group1Flammable'
  | 'group2VolatilePoison'
  | 'group3OxidisingAcid'
  | 'group4NonOxidisingAcid'
  | 'group5LiquidBase'
  | 'group5SolidBase'
  | 'group6OxidiserPeroxide'
  | 'group7Poison'
  | 'group9DrySolid'
  | 'waterReactive'
  | 'pyrophoric'
  | 'cyanide'
  | 'sulfide';

interface StorageSignals {
  hCodes: string[];
  suggestionGroups: Set<StorageSuggestionGroup>;
  traits: {
    flammable: boolean;
    corrosive: boolean;
    oxidising: boolean;
    waterReactive: boolean;
    pyrophoric: boolean;
    toxic: boolean;
    acid: boolean;
    base: boolean;
    organic: boolean | null;
    volatilePoison: boolean;
    halogenatedSolvent: boolean;
    cyanide: boolean;
    sulfide: boolean;
    acidGasFormer: boolean;
    peroxideFormer: boolean;
  };
}

export function normalizeHazardCode(code: string) {
  const upper = code.trim().toUpperCase();
  const eu = upper.match(/^EUH?0?(\d{2,3})$/);
  if (eu) return `EUH${eu[1].padStart(3, '0')}`;
  return upper;
}

const codeList = (c: Substance) =>
  c.hazardStatements.map((h) => normalizeHazardCode(h.code)).filter(Boolean);

const hasPictogram = (c: Substance, p: GhsPictogram) =>
  c.ghsPictograms.includes(p);

const hasAny = (codes: Set<string>, values: string[]) => values.some((v) => codes.has(v));

function textFor(c: Substance) {
  return [
    c.name,
    c.cas,
    c.molecularFormula,
    c.canonicalSmiles,
    c.connectivitySmiles,
    c.isomericSmiles,
    c.inchi,
    c.iupacName,
    c.pubchemTitle,
  ].filter(Boolean).join(' ').toLowerCase();
}

function parseFormula(formula?: string): Map<string, number> {
  const counts = new Map<string, number>();
  if (!formula) return counts;
  const cleaned = formula.replace(/[()[\]{}+\-.·]/g, ' ');
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    counts.set(m[1], (counts.get(m[1]) ?? 0) + (m[2] ? Number(m[2]) : 1));
  }
  return counts;
}

function hasMetal(formula: Map<string, number>) {
  const nonMetals = new Set(['H', 'B', 'C', 'N', 'O', 'F', 'Si', 'P', 'S', 'Cl', 'Se', 'Br', 'I', 'At', 'Ts', 'He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og']);
  return [...formula.keys()].some((element) => !nonMetals.has(element));
}

function isInorganicCarbonException(formula: Map<string, number>, text: string) {
  if (!formula.has('C')) return false;
  if (/\b(carbonate|bicarbonate|hydrogen carbonate|cyanide|cyanate|thiocyanate|carbide|carbon dioxide|carbon monoxide|carbonic acid)\b/.test(text)) return true;
  if (hasMetal(formula) && !formula.has('H')) return true;
  return false;
}

function inferOrganic(c: Substance): boolean | null {
  const formula = parseFormula(c.molecularFormula);
  const text = textFor(c);
  if (formula.has('C')) {
    if (isInorganicCarbonException(formula, text)) return false;
    return true;
  }
  if (/\b(acet|ethyl|methyl|propyl|butyl|benz|phenyl|phenol|formic|acetic|citric|oxalic|ethidium|acrylamide|chloroform|dichloromethane|methylene chloride|carbon tetrachloride|chlorobenzene|dichlorobenzene|dichloroethane|trichloro|tetrachloro|organic)\b/.test(text)) return true;
  if (c.molecularFormula || c.canonicalSmiles || c.connectivitySmiles || c.inchi) return false;
  return null;
}

function isAcid(text: string) {
  if (/\b(hcl|hbr|hf|hno3|h2so4|h3po4|hydrochloric|hydrobromic|hydroiodic|hydrogen chloride|hydrogen bromide|hydrogen iodide|hydrogen fluoride|trifluoroacetic|trichloroacetic|formic|acetic)\b/.test(text)) return true;
  if (!/\bacid\b/.test(text)) return false;
  // "…ic acid, … ester/salt" names are esters/salts, not free acids, and
  // "Acid Red/Orange/…" names are dye trade names.
  if (/\b(esters?|salts?)\b/.test(text)) return false;
  return !/\bacid\s+(red|orange|yellow|blue|green|black|brown|violet)\b/.test(text);
}

export function isOxidisingAcid(text: string) {
  return /\b(nitric|sulphuric|sulfuric|perchloric|chromic|permanganic)\s+acid\b/.test(text);
}

export function isOxidiserName(text: string) {
  return /\b(hypochlorite|permanganate|chromate|dichromate|persulfate|peroxydisulfate|perchlorate|chlorate|bromate|iodate|periodate|nitrate|nitrite|peroxide)\b/.test(text);
}

/**
 * Terminal carboxylic/sulfonic acid motif in canonical SMILES — the trailing O
 * must not be followed by another atom (which would make it an ester).
 */
function hasAcidSmilesMotif(c: Substance) {
  const smiles = c.canonicalSmiles ?? c.connectivitySmiles ?? '';
  return /C\(=O\)O(?![A-Za-z(])/.test(smiles) || /S\(=O\)\(=O\)O(?![A-Za-z(])/.test(smiles);
}

function isBase(text: string) {
  return /\b(nh3|hydroxide|ammonia|ammonium hydroxide|amine|triethylamine|ethanolamine|piperidine|pyridine|morpholine|imidazole|sodium carbonate|potassium carbonate|base|alkali)\b/.test(text);
}

function isSolidLike(form: SubstanceForm | '') {
  return form === 'solid' || form === 'powder';
}

export function classifyStorageSignals(c: Substance): StorageSignals {
  const hCodes = new Set(codeList(c));
  const text = textFor(c);
  const flammable = hasAny(hCodes, FLAMMABLE_CODES) || hasPictogram(c, 'flammable');
  const corrosive = hasAny(hCodes, CORROSIVE_CODES) || hasPictogram(c, 'corrosive');
  const oxidising = hasAny(hCodes, OXIDISING_CODES) || hasPictogram(c, 'oxidising') || isOxidiserName(text);
  const waterReactive = hasAny(hCodes, WATER_REACTIVE_CODES) || hasAny(hCodes, EUH_WATER_REACTIVE_CODES);
  const pyrophoric = hasAny(hCodes, PYROPHORIC_CODES);
  const acidGasFormer = hasAny(hCodes, EUH_ACID_GAS_CODES);
  const peroxideFormer = hasAny(hCodes, EUH_PEROXIDE_CODES);
  const toxic = hasPictogram(c, 'toxic') || hasAny(hCodes, ACUTE_TOXIC_CODES) || hasAny(hCodes, CHRONIC_TOXIC_CODES);
  // Automated acid/base determination for corrosives: PubChem pH and SMILES
  // acid motifs only count alongside corrosive evidence, so benign esters and
  // buffered salts are not reclassified.
  const phAcid = corrosive && typeof c.phValue === 'number' && c.phValue <= 4;
  const phBase = corrosive && typeof c.phValue === 'number' && c.phValue >= 10;
  const smilesAcid = corrosive && hasAcidSmilesMotif(c);
  const acid = isAcid(text) || phAcid || smilesAcid;
  const base = isBase(text) || phBase;
  const organic = inferOrganic(c);
  const halogenatedSolvent = /\b(chloroform|dichloromethane|methylene chloride|carbon tetrachloride|chlorobenzene|dichlorobenzene|dichloroethane|trichloroethane|trichloroethylene|tetrachloroethylene|trichloro|tetrachloro|chlorinated solvent|halogenated solvent)\b/.test(text);
  const volatilePoison = halogenatedSolvent;
  const cyanide = /\bcyanide\b/.test(text);
  const sulfide = /\b(sulfide|sulphide)\b/.test(text);
  const suggestionGroups = new Set<StorageSuggestionGroup>();

  if (waterReactive) suggestionGroups.add('waterReactive');
  if (pyrophoric) suggestionGroups.add('pyrophoric');
  if (flammable) suggestionGroups.add('group1Flammable');
  if (volatilePoison && !flammable) suggestionGroups.add('group2VolatilePoison');
  if (isOxidisingAcid(text)) suggestionGroups.add('group3OxidisingAcid');
  else if (acid && !flammable) suggestionGroups.add('group4NonOxidisingAcid');
  if (base) suggestionGroups.add(isSolidLike(c.form) ? 'group5SolidBase' : 'group5LiquidBase');
  if ((oxidising || peroxideFormer || /\b(peroxide|peracetic)\b/.test(text) || hasAny(hCodes, ['H240', 'H241', 'H242'])) && !isOxidisingAcid(text)) suggestionGroups.add('group6OxidiserPeroxide');
  if (toxic && !volatilePoison) suggestionGroups.add('group7Poison');
  if (isSolidLike(c.form) && suggestionGroups.size === 0) suggestionGroups.add('group9DrySolid');
  if (cyanide) suggestionGroups.add('cyanide');
  if (sulfide) suggestionGroups.add('sulfide');

  return {
    hCodes: [...hCodes],
    suggestionGroups,
    traits: {
      flammable,
      corrosive,
      oxidising,
      waterReactive,
      pyrophoric,
      toxic,
      acid,
      base,
      organic,
      volatilePoison,
      halogenatedSolvent,
      cyanide,
      sulfide,
      acidGasFormer,
      peroxideFormer,
    },
  };
}
