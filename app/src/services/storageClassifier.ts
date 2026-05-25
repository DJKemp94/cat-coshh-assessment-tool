import { GhsPictogram, Substance, SubstanceForm } from '@/types/assessment';

export const FLAMMABLE_CODES = ['H220', 'H221', 'H222', 'H223', 'H224', 'H225', 'H226', 'H228', 'H242'];
export const CORROSIVE_CODES = ['H290', 'H314', 'H318'];
export const ACUTE_TOXIC_CODES = ['H300', 'H301', 'H310', 'H311', 'H330', 'H331'];
export const CHRONIC_TOXIC_CODES = ['H340', 'H341', 'H350', 'H351', 'H360', 'H361', 'H370', 'H371', 'H372', 'H373'];
export const OXIDISING_CODES = ['H270', 'H271', 'H272'];
export const WATER_REACTIVE_CODES = ['H260', 'H261'];
export const PYROPHORIC_CODES = ['H250', 'H251', 'H252', 'H230', 'H231'];
export const EXPLOSIVE_CODES = ['H200', 'H201', 'H202', 'H203', 'H204', 'H205', 'H240', 'H241'];

export type StorageGroupId = '1' | '2a' | '2b' | '3' | '4' | '5a' | '5b' | '5c' | '6';

export type StorageSuggestionGroup =
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

export type StorageConfidence = 'high' | 'medium' | 'review';

export interface StorageClassification {
  groupId: StorageGroupId | null;
  hCodes: string[];
  primaryHazards: string[];
  reason: string;
  confidence: StorageConfidence;
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
  };
}

export const codeList = (c: Substance) =>
  c.hazardStatements.map((h) => h.code.trim().toUpperCase()).filter(Boolean);

export const hasHCode = (c: Substance, codes: string[]) =>
  codeList(c).some((code) => codes.includes(code));

export const hasPictogram = (c: Substance, p: GhsPictogram) =>
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
  if (/\b(carbonate|bicarbonate|hydrogen carbonate|cyanide|cyanate|thiocyanate|carbide|carbon dioxide|carbon monoxide|carbonic acid)\b/.test(text)) {
    return true;
  }
  if (hasMetal(formula) && !formula.has('H')) return true;
  return false;
}

export function inferOrganic(c: Substance): boolean | null {
  const formula = parseFormula(c.molecularFormula);
  const text = textFor(c);
  if (formula.has('C')) {
    if (isInorganicCarbonException(formula, text)) return false;
    return true;
  }
  if (/\b(acet|ethyl|methyl|propyl|butyl|benz|phenyl|phenol|formic|acetic|citric|oxalic|ethidium|acrylamide|chloroform|dichloromethane|methylene chloride|carbon tetrachloride|trichloro|tetrachloro|organic)\b/.test(text)) {
    return true;
  }
  if (c.molecularFormula || c.canonicalSmiles || c.connectivitySmiles || c.inchi) return false;
  return null;
}

function isAcid(text: string) {
  return /\b(acid|hydrochloric|hydrobromic|hydroiodic|trifluoroacetic|trichloroacetic|formic|acetic)\b/.test(text);
}

function isOxidisingAcid(text: string) {
  return /\b(nitric|sulphuric|sulfuric|perchloric|chromic|permanganic)\s+acid\b/.test(text);
}

function isBase(text: string) {
  return /\b(hydroxide|ammonia|ammonium hydroxide|amine|sodium carbonate|potassium carbonate|base|alkali)\b/.test(text);
}

function isSolidLike(form: SubstanceForm) {
  return form === 'solid' || form === 'powder';
}

function confidenceFor(c: Substance, organic: boolean | null, acid: boolean, base: boolean): StorageConfidence {
  const hasStructure = Boolean(c.molecularFormula || c.canonicalSmiles || c.connectivitySmiles || c.inchi);
  if (organic === null || ((acid || base) && !hasStructure && !c.pubchemCid)) return 'review';
  if (hasStructure && c.form && c.form !== 'other') return 'high';
  return 'medium';
}

export function classifyStorage(c: Substance): StorageClassification {
  const hCodes = new Set(codeList(c));
  const text = textFor(c);
  const flammable = hasAny(hCodes, FLAMMABLE_CODES) || hasPictogram(c, 'flammable');
  const corrosive = hasAny(hCodes, CORROSIVE_CODES) || hasPictogram(c, 'corrosive');
  const oxidising = hasAny(hCodes, OXIDISING_CODES) || hasPictogram(c, 'oxidising');
  const waterReactive = hasAny(hCodes, WATER_REACTIVE_CODES);
  const pyrophoric = hasAny(hCodes, PYROPHORIC_CODES);
  const toxic = hasPictogram(c, 'toxic') || hasAny(hCodes, ACUTE_TOXIC_CODES) || hasAny(hCodes, CHRONIC_TOXIC_CODES);
  const acid = isAcid(text);
  const base = isBase(text);
  const organic = inferOrganic(c);
  const halogenatedSolvent = /\b(chloroform|dichloromethane|methylene chloride|carbon tetrachloride|trichloro|tetrachloro|chlorinated solvent|halogenated solvent)\b/.test(text);
  const volatilePoison = halogenatedSolvent || /\b(mercaptoethanol|phenol|formamide)\b/.test(text);
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
  if ((oxidising || /\b(peroxide|peracetic)\b/.test(text) || hasAny(hCodes, ['H240', 'H241', 'H242'])) && !isOxidisingAcid(text)) {
    suggestionGroups.add('group6OxidiserPeroxide');
  }
  if (toxic && !volatilePoison) suggestionGroups.add('group7Poison');
  if (isSolidLike(c.form) && suggestionGroups.size === 0) suggestionGroups.add('group9DrySolid');
  if (cyanide) suggestionGroups.add('cyanide');
  if (sulfide) suggestionGroups.add('sulfide');

  const primaryHazards = [
    flammable && (c.form === 'solid' || c.form === 'powder' ? 'Flammable solid' : 'Flammable'),
    corrosive && (base ? 'Corrosive base' : acid ? 'Corrosive acid' : 'Corrosive'),
    oxidising && 'Oxidising',
    waterReactive && 'Water reactive',
    pyrophoric && 'Pyrophoric/self-heating',
    toxic && 'Toxic',
  ].filter(Boolean) as string[];

  let groupId: StorageGroupId | null = null;
  let reason = 'No recognised storage trigger in current GHS/H-code, structural or physical-state data.';
  if (waterReactive || pyrophoric) {
    groupId = '6';
    reason = `${waterReactive ? 'H260/H261 water-reactive' : 'Pyrophoric/self-heating'} trigger.`;
  } else if (oxidising || suggestionGroups.has('group6OxidiserPeroxide')) {
    groupId = '4';
    reason = 'Oxidising pictogram, oxidising H-code or peroxide trigger.';
  } else if (flammable) {
    groupId = '1';
    reason = 'Flammable pictogram or flammable H-code trigger.';
  } else if (acid) {
    groupId = organic ? '2b' : '2a';
    reason = `${organic ? 'Organic' : 'Inorganic/mineral'} acid from corrosive hazard plus PubChem structural/name data.`;
  } else if (base) {
    groupId = '3';
    reason = `${isSolidLike(c.form) ? 'Solid/powder' : 'Liquid or non-solid'} base/alkali from corrosive hazard plus PubChem structural/name data.`;
  } else if (toxic) {
    groupId = organic ? '5b' : '5a';
    reason = `${organic ? 'Organic' : 'Inorganic'} toxic substance from GHS toxicity plus PubChem structural/name data.`;
  } else if (corrosive) {
    groupId = null;
    reason = 'Corrosive hazard detected, but acid/base family is not explicit. Review SDS sections 7 and 10.';
  }

  return {
    groupId,
    hCodes: [...hCodes],
    primaryHazards,
    reason,
    confidence: confidenceFor(c, organic, acid, base),
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
    },
  };
}
