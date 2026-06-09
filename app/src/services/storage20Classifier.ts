import { CAMEO_GROUP_TO_CABINET, CameoMatch } from '@/services/cameoStorage';
import { classifyStorageSignals, EXPLOSIVE_CODES, FLAMMABLE_CODES, OXIDISING_CODES, WATER_REACTIVE_CODES, PYROPHORIC_CODES } from '@/services/storageSignals';

export type Storage20CabinetId = 'flammables' | 'corrosiveAcids' | 'corrosiveBases' | 'oxidizers' | 'toxins' | 'volatilePoisons' | 'compressedGas' | 'shelving' | 'specialReview' | 'review';

export interface CabinetZoneDef {
  id: Storage20ZoneId;
  cabinetId: Storage20CabinetId;
  cabinetTitle: string;
  zoneTitle: string;
  note: string;
  className: string;
  textClassName: string;
}

export type Storage20ZoneId =
  | 'organicSolventsAcids'
  | 'volatilePoisonsChlorinated'
  | 'nonOxidizingAcids'
  | 'oxidizingAcids'
  | 'solidBases'
  | 'liquidBases'
  | 'oxidizersOnly'
  | 'dryPoisons'
  | 'liquidPoisons'
  | 'compressedGases'
  | 'drySolids'
  | 'generalStorage'
  | 'specialReview'
  | 'review';

export type Storage20Category =
  | 'waterReactive'
  | 'oxidizingAgent'
  | 'oxidizingAcid'
  | 'inorganicAcid'
  | 'organicAcid'
  | 'solidBase'
  | 'liquidBase'
  | 'organicSolvent'
  | 'volatilePoison'
  | 'inorganicPoison'
  | 'organicPoison'
  | 'compressedGas'
  | 'drySolid'
  | 'generalStorage'
  | 'review';

type Storage20Source = 'ghs' | 'pubchem' | 'cameo' | 'combined' | 'review';
type Storage20Confidence = 'high' | 'medium' | 'review';

export interface Storage20Assignment {
  match: CameoMatch;
  zoneId: Storage20ZoneId;
  cabinetId: Storage20CabinetId;
  category: Storage20Category;
  source: Storage20Source;
  confidence: Storage20Confidence;
  reasons: string[];
  requirements: string[];
  constraints: string[];
}

const STRONG_SPECIAL_GROUPS = new Set([107, 109, 108, 102, 103, 76, 21, 22, 35, 42, 51, 400, 30, 110, 106, 45, 105, 99]);
const OXIDIZER_GROUPS = new Set([44, 104, 49, 27, 69]);
const OXIDIZING_ACID_GROUPS = new Set([2]);
const ORGANIC_ACID_GROUPS = new Set([3, 71]);
const ACID_GROUPS = new Set([1, 2, 3, 37, 38, 40, 55, 59, 60, 71]);
const BASE_GROUPS = new Set([7, 10, 61, 68, 73]);
const TOXIN_GROUPS = new Set([6, 8, 9, 11, 12, 17, 18, 20, 25, 26, 31, 32, 33, 48, 72, 75]);
const FLAMMABLE_ORGANIC_GROUPS = new Set([4, 5, 13, 14, 16, 19, 28, 29, 34, 47, 58, 63, 64, 65, 66, 70, 71, 101, 111]);
const STRONG_FLAMMABLE_GROUPS = new Set([16, 28, 29, 63, 64, 65, 101, 111]);
const HIGH_ACUTE_TOXIC_CODES = ['H300', 'H301', 'H310', 'H311', 'H330', 'H331'];

function hasAnyHCode(match: CameoMatch, codes: string[]) {
  const wanted = new Set(codes);
  return match.chemical.hazardStatements.some((h) => wanted.has(h.code.trim().toUpperCase()));
}

function textFor(match: CameoMatch) {
  return [
    match.chemical.name,
    match.chemical.cas,
    match.chemical.formNote,
    match.chemical.molecularFormula,
    match.chemical.iupacName,
    match.chemical.pubchemTitle,
    match.cameo?.name,
  ].filter(Boolean).join(' ').toLowerCase();
}

function hasGroup(groupIds: number[], ids: Set<number>) {
  return groupIds.some((id) => ids.has(id));
}

function isSolid(match: CameoMatch) {
  return match.chemical.form === 'solid' || match.chemical.form === 'powder';
}

function isLiquidLike(match: CameoMatch) {
  return ['liquid', 'vapour', 'aerosol', 'mist'].includes(match.chemical.form);
}

function hasCameoFlammableEvidence(match: CameoMatch, groupIds: number[]) {
  const nfpa = match.cameo?.nfpa.flammability;
  const labelText = [
    ...(match.cameo?.dotLabels ?? []),
    match.cameo?.specialHazards,
  ].filter(Boolean).join(' ').toLowerCase();
  const hasPositiveLabel = /\b(flammable|combustible|spontaneously combustible)\b/.test(labelText)
    && !/\b(non[-\s]?flammable|not.{0,40}(flammable|combustible)|does not burn|will not burn)\b/.test(labelText);
  return hasPositiveLabel
    || (typeof nfpa === 'number' && nfpa >= 2)
    || hasGroup(groupIds, STRONG_FLAMMABLE_GROUPS);
}

function hasPubChemFlammableEvidence(match: CameoMatch, organic: boolean) {
  const flashPoint = match.chemical.flashPointC;
  if (typeof match.chemical.pubchemNfpa?.flammability === 'number' && match.chemical.pubchemNfpa.flammability >= 2 && isLiquidLike(match)) return true;
  if (!organic || !isLiquidLike(match) || typeof flashPoint !== 'number') return false;
  return flashPoint <= 93;
}

function hasFlammableStorageEvidence(match: CameoMatch, groupIds: number[], organic: boolean) {
  if (hasAnyHCode(match, FLAMMABLE_CODES) || match.chemical.ghsPictograms.includes('flammable')) return true;
  if (hasCameoFlammableEvidence(match, groupIds)) return true;
  return hasPubChemFlammableEvidence(match, organic);
}

function hasCompressedGasSignal(match: CameoMatch) {
  const text = textFor(match);
  const pressurePackageSignal = /\b(compressed gas|gas under pressure|gas cylinder|cylinder|liquefied gas|refrigerated liquid|cryogenic)\b/.test(text);
  const pressureHazardSignal = match.chemical.ghsPictograms.includes('compressed-gas') || hasAnyHCode(match, ['H280', 'H281']);
  const assessorGasForm = match.chemical.form === 'gas' || match.chemical.form === 'vapour';
  const acidSignal = classifyStorageSignals(match.chemical).traits.acid;
  if (pressurePackageSignal) return true;
  return assessorGasForm && pressureHazardSignal && !acidSignal;
}

function isDryBase(match: CameoMatch) {
  const chemicalText = [match.chemical.name, match.chemical.formNote].filter(Boolean).join(' ').toLowerCase();
  const cameoText = match.cameo?.name.toLowerCase() ?? '';
  const combined = `${chemicalText} ${cameoText}`;
  if (isSolid(match)) return true;
  if (!/(sodium hydroxide|potassium hydroxide|calcium hydroxide|lithium hydroxide|barium hydroxide|magnesium hydroxide)/.test(combined)) return false;
  return !/(solution|aqueous|liquor|aq\.|\b\d+\s*%|\b\d+(\.\d+)?\s*m\b|\b\d+(\.\d+)?\s*mol)/.test(chemicalText);
}

function categorySource(hasCameo: boolean, hasGhs: boolean, hasPubChem: boolean): Storage20Source {
  if (hasCameo && (hasGhs || hasPubChem)) return 'combined';
  if (hasCameo) return 'cameo';
  if (hasGhs) return 'ghs';
  if (hasPubChem) return 'pubchem';
  return 'review';
}

function flammableReason(match: CameoMatch, groupIds: number[], classification: ReturnType<typeof classifyStorageSignals>) {
  if (classification.traits.flammable) return 'GHS flammable H-code or pictogram.';
  if (hasCameoFlammableEvidence(match, groupIds)) return 'CAMEO/NFPA transport data gives flammable or combustible storage evidence.';
  if (typeof match.chemical.flashPointC === 'number') {
    return match.chemical.flashPointC <= 60
      ? `PubChem flash point ${match.chemical.flashPointC} °C supports flammable-liquid storage.`
      : `PubChem flash point ${match.chemical.flashPointC} °C supports combustible-liquid storage review.`;
  }
  if (typeof match.chemical.pubchemNfpa?.flammability === 'number') {
    return `PubChem NFPA flammability ${match.chemical.pubchemNfpa.flammability} supports flammable-storage review.`;
  }
  return 'Reference data gives flammable/combustible storage evidence.';
}

export function classifyStorage20(match: CameoMatch): Storage20Assignment {
  const classification = classifyStorageSignals(match.chemical);
  const groupIds = match.groups.map((group) => group.id);
  const groupNames = match.groups.map((group) => group.name.toLowerCase());
  const cabinets = new Set(groupIds.map((id) => CAMEO_GROUP_TO_CABINET[id]).filter(Boolean));
  const text = textFor(match);
  const hasCameo = match.cameo !== null;
  const hasGhs = match.chemical.hazardStatements.length > 0 || match.chemical.ghsPictograms.length > 0;
  const hasPubChem = Boolean(
    match.chemical.pubchemCid
    || match.chemical.molecularFormula
    || match.chemical.canonicalSmiles
    || match.chemical.inchi
    || match.chemical.flashPointC !== undefined
    || match.chemical.vapourPressureKPa !== undefined
    || match.chemical.pubchemNfpa,
  );
  const source = categorySource(hasCameo, hasGhs, hasPubChem);
  const reasons: string[] = [];
  const requirements: string[] = [];
  const constraints = storageConstraints(match, { text, profileText: [match.cameo?.chemicalProfile, match.cameo?.airWaterReactions, match.cameo?.specialHazards].filter(Boolean).join(' ').toLowerCase(), groupNames });
  let confidence: Storage20Confidence = hasCameo || hasGhs || hasPubChem ? 'medium' : 'review';

  const waterReactive = classification.traits.waterReactive || classification.traits.pyrophoric || hasAnyHCode(match, [...WATER_REACTIVE_CODES, ...PYROPHORIC_CODES, ...EXPLOSIVE_CODES, 'H242']) || hasGroup(groupIds, STRONG_SPECIAL_GROUPS);
  if (waterReactive) {
    reasons.push(hasGroup(groupIds, STRONG_SPECIAL_GROUPS) ? 'CAMEO reactive group requires hard isolation or dedicated reactive storage.' : 'GHS water-reactive, pyrophoric/self-heating or explosive H-code trigger.');
    if (classification.traits.waterReactive || groupIds.some((id) => [107, 21, 22, 35, 42, 51].includes(id))) requirements.push('isolate completely');
    requirements.push('keep dry');
    requirements.push('do not store below liquids');
    if (groupIds.includes(30)) requirements.push('temperature control / peroxide review');
    return assignment(match, 'specialReview', 'waterReactive', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  const oxidising = classification.traits.oxidising || hasAnyHCode(match, OXIDISING_CODES) || hasGroup(groupIds, OXIDIZER_GROUPS);
  const acid = classification.traits.acid || hasGroup(groupIds, ACID_GROUPS);
  const base = classification.traits.base || hasGroup(groupIds, BASE_GROUPS);
  const organic = classification.traits.organic === true || hasGroup(groupIds, FLAMMABLE_ORGANIC_GROUPS) || hasGroup(groupIds, ORGANIC_ACID_GROUPS);
  const volatilePoisonSignal = classification.traits.volatilePoison || /chloroform|dichloromethane|methylene chloride|carbon tetrachloride|chlorobenzene|dichlorobenzene|dichloroethane|trichloroethane|trichloroethylene|tetrachloroethylene|chlorinated solvent|halogenated solvent/.test(text);
  const flammable = !volatilePoisonSignal && hasFlammableStorageEvidence(match, groupIds, organic);
  const toxic = classification.traits.toxic || match.chemical.ghsPictograms.includes('toxic') || hasGroup(groupIds, TOXIN_GROUPS);
  const compressedGas = hasCompressedGasSignal(match);
  const severeToxicity = match.chemical.ghsPictograms.includes('toxic') || hasAnyHCode(match, HIGH_ACUTE_TOXIC_CODES);

  if (compressedGas) {
    reasons.push(match.chemical.ghsPictograms.includes('compressed-gas') ? 'GHS gas-under-pressure pictogram.' : 'Gas or pressure-container signal without stronger hard-isolation trigger.');
    requirements.push('secure cylinder/container');
    requirements.push('store upright and ventilated');
    if (flammable) requirements.push('segregate from ignition sources and oxidizers');
    if (toxic) requirements.push('segregate as toxic gas and confirm ventilation/emergency controls');
    if (oxidising) requirements.push('segregate as oxidising gas from flammables and combustibles');
    if (acid || base || classification.traits.corrosive) requirements.push('segregate as corrosive gas and confirm compatible valve/regulator materials');
    return assignment(match, 'compressedGases', 'compressedGas', source, hasCameo || hasGhs ? 'high' : 'medium', reasons, requirements, constraints);
  }

  const oxidizingAcid = hasGroup(groupIds, OXIDIZING_ACID_GROUPS) || (oxidising && acid && (classification.traits.corrosive || /acid/.test(text)));
  if (oxidizingAcid) {
    reasons.push(hasGroup(groupIds, OXIDIZING_ACID_GROUPS) ? 'CAMEO strong oxidizing acid group.' : 'GHS oxidizer plus corrosive/acid signal.');
    requirements.push('double containment');
    requirements.push('isolate from organics, flammables and bases');
    return assignment(match, 'oxidizingAcids', 'oxidizingAcid', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (oxidising) {
    reasons.push(hasGroup(groupIds, OXIDIZER_GROUPS) ? 'CAMEO oxidizer reactive group.' : 'GHS oxidizer H-code or pictogram.');
    requirements.push('secondary containment');
    requirements.push('separate from organics and flammables');
    return assignment(match, 'oxidizersOnly', 'oxidizingAgent', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (acid) {
    if (flammable && organic) {
      reasons.push('Organic acid with flammable/organic signal; store in the flammable/organic-acid storage group with segregation.');
      requirements.push('secondary containment');
      requirements.push('segregate from general solvents where local storage uses separate organic-acid containment');
      requirements.push('keep away from oxidizing acids and bases');
      return assignment(match, 'organicSolventsAcids', 'organicAcid', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
    }
    reasons.push(hasCameo ? 'CAMEO acid reactive group.' : 'GHS/PubChem acid signal without CAMEO match.');
    requirements.push('separate from bases');
    return assignment(match, 'nonOxidizingAcids', organic ? 'organicAcid' : 'inorganicAcid', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (base) {
    const zoneId: Storage20ZoneId = isDryBase(match) ? 'solidBases' : 'liquidBases';
    reasons.push(hasCameo ? 'CAMEO base reactive group.' : 'GHS/PubChem base signal without CAMEO match.');
    requirements.push('separate from acids');
    if (zoneId === 'solidBases') requirements.push('keep dry');
    return assignment(match, zoneId, zoneId === 'solidBases' ? 'solidBase' : 'liquidBase', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (!isSolid(match) && volatilePoisonSignal) {
    reasons.push('Volatile halogenated/chlorinated solvent signal.');
    requirements.push('secondary containment');
    return assignment(match, 'volatilePoisonsChlorinated', 'volatilePoison', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (flammable && isLiquidLike(match) && !severeToxicity) {
    reasons.push(flammableReason(match, groupIds, classification));
    return assignment(match, 'organicSolventsAcids', 'organicSolvent', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (toxic) {
    const volatilePoison = !isSolid(match) && volatilePoisonSignal;
    const zoneId: Storage20ZoneId = volatilePoison ? 'volatilePoisonsChlorinated' : isSolid(match) ? 'dryPoisons' : 'liquidPoisons';
    reasons.push(hasCameo ? 'CAMEO toxin reactive group.' : 'GHS acute/chronic toxicity signal without CAMEO match.');
    if (zoneId === 'volatilePoisonsChlorinated') requirements.push('secondary containment');
    else if (zoneId === 'liquidPoisons') requirements.push('liquid containment');
    return assignment(match, zoneId, volatilePoison ? 'volatilePoison' : organic ? 'organicPoison' : 'inorganicPoison', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (flammable) {
    reasons.push(flammableReason(match, groupIds, classification));
    return assignment(match, 'organicSolventsAcids', 'organicSolvent', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (isSolid(match)) {
    reasons.push(hasCameo ? 'Dry solid with no stronger GHS/CAMEO storage trigger.' : 'Dry solid with no stronger storage trigger.');
    requirements.push('keep dry');
    return assignment(match, 'drySolids', 'drySolid', source, hasCameo ? 'medium' : hasGhs || hasPubChem ? 'medium' : 'review', reasons, requirements, constraints);
  }

  if (cabinets.has('shelving') || !hasCameoFlammableEvidence(match, groupIds)) {
    reasons.push(hasCameo ? 'Reference data indicates low-reactivity/general storage with no stronger hazard trigger.' : 'No strong GHS/CAMEO storage trigger.');
    return assignment(match, 'generalStorage', 'generalStorage', source, hasCameo ? 'medium' : 'review', reasons, requirements, constraints);
  }

  reasons.push(hasCameo ? 'CAMEO groups do not map to a specific Storage category.' : 'No CAMEO match and no strong GHS/PubChem storage trigger.');
  confidence = 'review';
  return assignment(match, 'review', 'review', source, confidence, reasons, requirements, constraints);
}

function assignment(match: CameoMatch, zoneId: Storage20ZoneId, category: Storage20Category, source: Storage20Source, confidence: Storage20Confidence, reasons: string[], requirements: string[], constraints: string[]): Storage20Assignment {
  return {
    match,
    zoneId,
    cabinetId: cabinetForZone(zoneId),
    category,
    source,
    confidence,
    reasons: unique(reasons),
    requirements: unique(requirements),
    constraints: unique(constraints),
  };
}

function cabinetForZone(zoneId: Storage20ZoneId): Storage20CabinetId {
  if (zoneId === 'organicSolventsAcids') return 'flammables';
  if (zoneId === 'volatilePoisonsChlorinated') return 'volatilePoisons';
  if (zoneId === 'nonOxidizingAcids' || zoneId === 'oxidizingAcids') return 'corrosiveAcids';
  if (zoneId === 'solidBases' || zoneId === 'liquidBases') return 'corrosiveBases';
  if (zoneId === 'oxidizersOnly') return 'oxidizers';
  if (zoneId === 'dryPoisons' || zoneId === 'liquidPoisons') return 'toxins';
  if (zoneId === 'compressedGases') return 'compressedGas';
  if (zoneId === 'drySolids' || zoneId === 'generalStorage') return 'shelving';
  if (zoneId === 'specialReview') return 'specialReview';
  return 'review';
}

function storageConstraints(match: CameoMatch, signals: { text: string; profileText: string; groupNames: string[] }) {
  const constraints: string[] = [];
  const absorbents = match.cameo?.incompatibleAbsorbents ?? [];
  const hasGroupName = (pattern: RegExp) => signals.groupNames.some((name) => pattern.test(name));
  const specialHazards = match.cameo?.specialHazards.toLowerCase() ?? '';

  if (specialHazards.includes('water-reactive')) constraints.push('water-reactive - keep dry/review');
  if (specialHazards.includes('air-reactive')) constraints.push('air-reactive - sealed compatible container');
  if (/pyrophoric|self-heating|spontaneously ignite/.test(signals.text) || hasAnyHCode(match, ['H250', 'H251', 'H252', 'H260', 'H261'])) constraints.push('pyrophoric/self-heating review');
  if (/attacks glass|etch glass|silica|silicon compounds|silicides|concrete|quartz/.test(signals.profileText)) constraints.push('container compatibility: avoid glass/silica');
  if (absorbents.length > 0) constraints.push(`incompatible absorbents: ${absorbents.slice(0, 3).join(', ')}${absorbents.length > 3 ? '...' : ''}`);
  if (/cyanide/.test(signals.text) || hasGroupName(/cyanides/)) constraints.push('hard separate from acids - HCN risk');
  if (/(sulfide|sulphide)/.test(signals.text) || hasGroupName(/sulfides/)) constraints.push('hard separate from acids - H2S risk');
  if (/organic peroxide|peroxide-form|peroxidizable/.test(signals.text) || hasGroupName(/peroxides/)) constraints.push('peroxide/polymerization review');
  if (hasGroupName(/polymerizable/)) constraints.push('polymerization/pressure review');
  if (/sodium metal|potassium metal|lithium metal|metal hydride|hydride\b/.test(signals.text) || hasGroupName(/hydrides|alkali metals/)) constraints.push('reactive metals/hydrides review');
  if (/generate flammable hydrogen|hydrogen gas/i.test(signals.profileText) && /metal|hydride|hydrofluoric|hydrogen fluoride/.test(signals.text)) constraints.push('hydrogen generation risk');
  if (/fluoride salts, soluble/.test(signals.groupNames.join(' ')) && /acid|hydrogen fluoride|hydrofluoric/.test(signals.text)) constraints.push('HF/fluoride special review');
  if (hasPhysicalFormConflict(match)) constraints.push(`physical state check: assessor selected ${match.chemical.form}, PubChem suggests ${match.chemical.pubchemPhysicalForm}`);
  if (typeof match.chemical.vapourPressureKPa === 'number' && match.chemical.vapourPressureKPa >= 10 && hasVolatileVentilationConcern(match, signals.text)) {
    constraints.push('elevated vapour pressure - confirm ventilation and container closure');
  }
  if (typeof match.chemical.pubchemNfpa?.reactivity === 'number' && match.chemical.pubchemNfpa.reactivity >= 2) constraints.push(`NFPA reactivity ${match.chemical.pubchemNfpa.reactivity} - check SDS stability/storage`);
  if (match.chemical.pubchemNfpa?.special) constraints.push(`NFPA special: ${match.chemical.pubchemNfpa.special}`);
  return constraints;
}

function hasPhysicalFormConflict(match: CameoMatch) {
  const pubchemForm = match.chemical.pubchemPhysicalForm;
  if (!pubchemForm) return false;
  const normalize = (form: string) => {
    if (form === 'powder') return 'solid';
    if (form === 'mist' || form === 'aerosol') return 'liquid';
    if (form === 'vapour') return 'gas';
    return form;
  };
  return normalize(match.chemical.form) !== normalize(pubchemForm);
}

function hasVolatileVentilationConcern(match: CameoMatch, text: string) {
  return match.chemical.ghsPictograms.includes('toxic')
    || match.chemical.ghsPictograms.includes('health-hazard')
    || hasAnyHCode(match, HIGH_ACUTE_TOXIC_CODES)
    || /chloroform|dichloromethane|methylene chloride|carbon tetrachloride|chlorinated solvent|halogenated solvent/.test(text);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

// ── Display labels ──────────────────────────────────────────────

export const STORAGE20_ZONE_LABELS: Record<Storage20ZoneId, string> = {
  organicSolventsAcids: 'Organic solvents and organic acids',
  volatilePoisonsChlorinated: 'Volatile poisons and chlorinated solvents',
  nonOxidizingAcids: 'Non-oxidizing organic and mineral acids',
  oxidizingAcids: 'Oxidizing acids in double containment',
  solidBases: 'Solid bases',
  liquidBases: 'Liquid bases',
  oxidizersOnly: 'Oxidizers, excluding oxidizing acids or organic peroxides',
  dryPoisons: 'Non-volatile poisons - dry',
  liquidPoisons: 'Non-volatile poisons - liquid',
  compressedGases: 'Compressed gases',
  drySolids: 'Dry solids',
  generalStorage: 'General low-hazard storage',
  specialReview: 'Hard isolation / dedicated reactive storage',
  review: 'Unassigned / assessor review',
};

export const CABINET_ORDER: Storage20CabinetId[] = ['specialReview', 'compressedGas', 'flammables', 'volatilePoisons', 'corrosiveAcids', 'corrosiveBases', 'oxidizers', 'toxins', 'shelving', 'review'];

export const ZONES: Record<Storage20ZoneId, CabinetZoneDef> = {
  organicSolventsAcids: {
    id: 'organicSolventsAcids',
    cabinetId: 'flammables',
    cabinetTitle: 'Flammables Cabinet',
    zoneTitle: 'Organic solvents and organic acids',
    note: 'Use for flammable organic solvents and flammable organic acids where SDS confirms this is appropriate.',
    className: 'border-yellow-300 bg-yellow-100',
    textClassName: 'text-yellow-950',
  },
  volatilePoisonsChlorinated: {
    id: 'volatilePoisonsChlorinated',
    cabinetId: 'volatilePoisons',
    cabinetTitle: 'Volatile Poisons / Chlorinated Solvents',
    zoneTitle: 'Volatile poisons and chlorinated solvents',
    note: 'Requires secondary containment and suitable ventilation; keep away from incompatible spill contact and confirm SDS storage conditions.',
    className: 'border-sky-300 bg-sky-100',
    textClassName: 'text-sky-950',
  },
  nonOxidizingAcids: {
    id: 'nonOxidizingAcids',
    cabinetId: 'corrosiveAcids',
    cabinetTitle: 'Corrosives Cabinet',
    zoneTitle: 'Non-oxidizing organic and mineral acids',
    note: 'Keep acids separate from bases; acids and bases should not share a cabinet.',
    className: 'border-violet-300 bg-violet-100',
    textClassName: 'text-violet-950',
  },
  oxidizingAcids: {
    id: 'oxidizingAcids',
    cabinetId: 'corrosiveAcids',
    cabinetTitle: 'Corrosives Cabinet',
    zoneTitle: 'Oxidizing acids in double containment',
    note: 'Double containment required; isolate from organic solvents/acids, bases and oxidizer cabinet contents.',
    className: 'border-red-300 bg-red-100',
    textClassName: 'text-red-950',
  },
  liquidBases: {
    id: 'liquidBases',
    cabinetId: 'corrosiveBases',
    cabinetTitle: 'Corrosives Cabinet',
    zoneTitle: 'Liquid bases',
    note: 'Bases must be separate from acids; strong acids and bases should not be in the same cabinet.',
    className: 'border-orange-300 bg-orange-100',
    textClassName: 'text-orange-950',
  },
  solidBases: {
    id: 'solidBases',
    cabinetId: 'corrosiveBases',
    cabinetTitle: 'Corrosives Cabinet',
    zoneTitle: 'Solid bases',
    note: 'Dry caustic bases such as hydroxide pellets/flakes; keep dry and separate from acids.',
    className: 'border-orange-300 bg-orange-50',
    textClassName: 'text-orange-950',
  },
  oxidizersOnly: {
    id: 'oxidizersOnly',
    cabinetId: 'oxidizers',
    cabinetTitle: 'Oxidizers Cabinet',
    zoneTitle: 'Oxidizers, excluding oxidizing acids or organic peroxides',
    note: 'Temperature-dependent oxidizers or peroxide-formers need separation from all other materials in secondary containment.',
    className: 'border-amber-300 bg-amber-100',
    textClassName: 'text-amber-950',
  },
  dryPoisons: {
    id: 'dryPoisons',
    cabinetId: 'toxins',
    cabinetTitle: 'Toxins Cabinet',
    zoneTitle: 'Non-volatile poisons - dry',
    note: 'Keep dry poisons separate from liquid poison spill paths.',
    className: 'border-pink-300 bg-pink-100',
    textClassName: 'text-pink-950',
  },
  liquidPoisons: {
    id: 'liquidPoisons',
    cabinetId: 'toxins',
    cabinetTitle: 'Toxins Cabinet',
    zoneTitle: 'Non-volatile poisons - liquid',
    note: 'Store liquids below dry poisons and use compatible secondary containment.',
    className: 'border-pink-300 bg-pink-100',
    textClassName: 'text-pink-950',
  },
  compressedGases: {
    id: 'compressedGases',
    cabinetId: 'compressedGas',
    cabinetTitle: 'Compressed Gas Storage',
    zoneTitle: 'Compressed gases',
    note: 'Secure cylinders/pressure containers upright, protect valves and store in a ventilated area according to local gas-storage rules.',
    className: 'border-cyan-300 bg-cyan-100',
    textClassName: 'text-cyan-950',
  },
  drySolids: {
    id: 'drySolids',
    cabinetId: 'shelving',
    cabinetTitle: 'Shelving',
    zoneTitle: 'Dry solids',
    note: 'Dry, compatible solids only; avoid shelves above/near incompatible liquids.',
    className: 'border-emerald-300 bg-emerald-100',
    textClassName: 'text-emerald-950',
  },
  generalStorage: {
    id: 'generalStorage',
    cabinetId: 'shelving',
    cabinetTitle: 'Shelving / General Storage',
    zoneTitle: 'General low-hazard storage',
    note: 'No strong automatic storage trigger from the supplied GHS/CAMEO evidence. Store using local general chemical storage rules and SDS confirmation.',
    className: 'border-emerald-200 bg-emerald-50',
    textClassName: 'text-emerald-900',
  },
  specialReview: {
    id: 'specialReview',
    cabinetId: 'specialReview',
    cabinetTitle: 'Special / Review SDS',
    zoneTitle: 'Hard isolation / dedicated reactive storage',
    note: 'Water-reactive, pyrophoric, explosive, polymerizable, organic peroxides, radioactive. Requires dedicated cabinets, gas cabinets, or explosives lockers per SDS.',
    className: 'border-red-400 bg-red-100',
    textClassName: 'text-red-950',
  },
  review: {
    id: 'review',
    cabinetId: 'review',
    cabinetTitle: 'Review SDS',
    zoneTitle: 'Unassigned / assessor review',
    note: 'No confident cabinet assignment. Check SDS sections 7 and 10 and local storage rules.',
    className: 'border-zinc-300 bg-zinc-100',
    textClassName: 'text-zinc-800',
  },
};

// ── Override application ────────────────────────────────────────

/**
 * Apply assessor overrides to an automatic Storage assignment.
 * Mirrors `applyAssignmentEdit` in Storage20Section.tsx but uses
 * `cabinetForZone` instead of the local ZONES map.
 */
export function applyStorage20Edit(
  assignment: Storage20Assignment,
  edit?: { zoneOverride?: string; requirements?: string },
): Storage20Assignment {
  const zoneId = edit?.zoneOverride && STORAGE20_ZONE_LABELS[edit.zoneOverride as Storage20ZoneId]
    ? (edit.zoneOverride as Storage20ZoneId)
    : undefined;
  if (!zoneId && !edit?.requirements) return assignment;

  const splitRequirements = (value: string) =>
    value.split(/[;\n]/).map((item) => item.trim()).filter(Boolean);

  return {
    ...assignment,
    zoneId: zoneId ?? assignment.zoneId,
    cabinetId: zoneId ? cabinetForZone(zoneId) : assignment.cabinetId,
    category: zoneId ? 'review' : assignment.category,
    requirements: edit?.requirements !== undefined ? splitRequirements(edit.requirements) : assignment.requirements,
    source: zoneId ? 'review' : assignment.source,
    confidence: zoneId ? 'review' : assignment.confidence,
    reasons: zoneId
      ? ['User selected the storage group assignment. Verify against SDS sections 7 and 10.']
      : assignment.reasons,
  };
}

/** Collapse requirements and constraints into a concise display string. */
export function storage20RequirementsText(assignment: Storage20Assignment): string {
  return [...assignment.requirements, ...assignment.constraints]
    .slice(0, 4)
    .join('; ') || 'Check SDS sections 7 and 10';
}

export function storage20EvidenceText(assignment: Storage20Assignment): string {
  const chemical = assignment.match.chemical;
  const groups = assignment.match.groups
    .map((group) => `${group.id}: ${group.name}`)
    .slice(0, 3);
  const hCodes = chemical.hazardStatements
    .map((statement) => statement.code)
    .filter(Boolean)
    .slice(0, 6);
  const pictograms = chemical.ghsPictograms.slice(0, 4);
  const nfpa = chemical.pubchemNfpa;
  const nfpaParts = [
    typeof nfpa?.health === 'number' ? `health ${nfpa.health}` : undefined,
    typeof nfpa?.flammability === 'number' ? `flammability ${nfpa.flammability}` : undefined,
    typeof nfpa?.reactivity === 'number' ? `reactivity ${nfpa.reactivity}` : undefined,
    nfpa?.special ? `special ${nfpa.special}` : undefined,
  ].filter(Boolean);
  const physicalDescription = chemical.pubchemPhysicalDescription
    ? chemical.pubchemPhysicalDescription.replace(/\s+/g, ' ').slice(0, 120)
    : undefined;
  const evidence = [
    `Source: ${storage20SourceLabel(assignment.source)}`,
    `Confidence: ${storage20ConfidenceLabel(assignment.confidence)}`,
    ...assignment.reasons,
    groups.length > 0 ? `CAMEO groups: ${groups.join('; ')}` : undefined,
    hCodes.length > 0 ? `H-codes: ${hCodes.join(', ')}` : undefined,
    pictograms.length > 0 ? `GHS pictograms: ${pictograms.join(', ')}` : undefined,
    typeof chemical.flashPointC === 'number' ? `PubChem flash point: ${chemical.flashPointC} °C` : undefined,
    typeof chemical.vapourPressureKPa === 'number' ? `PubChem vapour pressure: ${formatKPa(chemical.vapourPressureKPa)} kPa` : undefined,
    chemical.pubchemPhysicalForm ? `PubChem physical form: ${chemical.pubchemPhysicalForm}` : undefined,
    physicalDescription ? `PubChem physical description: ${physicalDescription}` : undefined,
    nfpaParts.length > 0 ? `PubChem NFPA: ${nfpaParts.join(', ')}` : undefined,
  ].filter(Boolean);
  return evidence.join(' ');
}

function formatKPa(value: number) {
  if (value >= 10) return String(Math.round(value * 10) / 10);
  if (value >= 1) return String(Math.round(value * 100) / 100);
  return String(Math.round(value * 1000) / 1000);
}

export function storage20SourceLabel(value: Storage20Source): string {
  if (value === 'combined') return 'GHS/PubChem + CAMEO';
  if (value === 'ghs') return 'GHS';
  if (value === 'pubchem') return 'PubChem';
  if (value === 'cameo') return 'CAMEO';
  return 'User/SDS review';
}

export function storage20ConfidenceLabel(value: Storage20Confidence): string {
  if (value === 'high') return 'High';
  if (value === 'medium') return 'Medium';
  return 'Review';
}
