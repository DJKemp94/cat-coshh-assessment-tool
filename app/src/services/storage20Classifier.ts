import { CAMEO_GROUP_TO_CABINET, CameoMatch } from '@/services/cameoStorage';
import { classifyStorage, EXPLOSIVE_CODES, FLAMMABLE_CODES, OXIDISING_CODES, WATER_REACTIVE_CODES, PYROPHORIC_CODES } from '@/services/storageClassifier';

export type Storage20CabinetId = 'flammables' | 'corrosiveAcids' | 'corrosiveBases' | 'oxidizers' | 'toxins' | 'shelving' | 'specialReview' | 'review';

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
  | 'drySolids'
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
  | 'drySolid'
  | 'review';

export type Storage20Source = 'ghs' | 'pubchem' | 'cameo' | 'combined' | 'review';
export type Storage20Confidence = 'high' | 'medium' | 'review';

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

const STRONG_SPECIAL_GROUPS = new Set([107, 109, 108, 102, 103, 76, 21, 22, 35, 42, 51, 400, 30, 110, 106, 45, 50, 105, 99]);
const OXIDIZER_GROUPS = new Set([44, 104, 49, 27, 69]);
const OXIDIZING_ACID_GROUPS = new Set([2]);
const ORGANIC_ACID_GROUPS = new Set([3, 71]);
const ACID_GROUPS = new Set([1, 2, 3, 37, 38, 40, 55, 59, 60, 71]);
const BASE_GROUPS = new Set([7, 10, 39, 61, 68, 73]);
const TOXIN_GROUPS = new Set([6, 8, 9, 11, 12, 17, 18, 20, 25, 26, 31, 32, 33, 48, 72, 75]);
const FLAMMABLE_ORGANIC_GROUPS = new Set([4, 5, 13, 14, 16, 19, 28, 29, 34, 47, 58, 63, 64, 65, 66, 70, 71, 101, 111]);

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

function isDryBase(match: CameoMatch) {
  const chemicalText = [match.chemical.name, match.chemical.formNote].filter(Boolean).join(' ').toLowerCase();
  const cameoText = match.cameo?.name.toLowerCase() ?? '';
  const combined = `${chemicalText} ${cameoText}`;
  if (isSolid(match)) return true;
  if (!/(sodium hydroxide|potassium hydroxide|calcium hydroxide|lithium hydroxide|barium hydroxide|magnesium hydroxide)/.test(combined)) return false;
  return !/(solution|aqueous|aq\.|\b\d+\s*%|\b\d+(\.\d+)?\s*m\b|\b\d+(\.\d+)?\s*mol)/.test(chemicalText);
}

function categorySource(hasCameo: boolean, hasGhs: boolean, hasPubChem: boolean): Storage20Source {
  if (hasCameo && (hasGhs || hasPubChem)) return 'combined';
  if (hasCameo) return 'cameo';
  if (hasGhs) return 'ghs';
  if (hasPubChem) return 'pubchem';
  return 'review';
}

export function classifyStorage20(match: CameoMatch): Storage20Assignment {
  const classification = classifyStorage(match.chemical);
  const groupIds = match.groups.map((group) => group.id);
  const groupNames = match.groups.map((group) => group.name.toLowerCase());
  const cabinets = new Set(groupIds.map((id) => CAMEO_GROUP_TO_CABINET[id]).filter(Boolean));
  const text = textFor(match);
  const hasCameo = match.cameo !== null;
  const hasGhs = match.chemical.hazardStatements.length > 0 || match.chemical.ghsPictograms.length > 0;
  const hasPubChem = Boolean(match.chemical.pubchemCid || match.chemical.molecularFormula || match.chemical.canonicalSmiles || match.chemical.inchi);
  const source = categorySource(hasCameo, hasGhs, hasPubChem);
  const reasons: string[] = [];
  const requirements: string[] = [];
  const constraints = storageConstraints(match, { text, profileText: [match.cameo?.chemicalProfile, match.cameo?.airWaterReactions, match.cameo?.specialHazards].filter(Boolean).join(' ').toLowerCase(), groupNames });
  let confidence: Storage20Confidence = hasCameo || hasGhs ? 'medium' : 'review';

  const waterReactive = classification.traits.waterReactive || classification.traits.pyrophoric || hasAnyHCode(match, [...WATER_REACTIVE_CODES, ...PYROPHORIC_CODES, ...EXPLOSIVE_CODES]) || hasGroup(groupIds, STRONG_SPECIAL_GROUPS);
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
  const flammable = classification.traits.flammable || hasAnyHCode(match, FLAMMABLE_CODES) || match.chemical.ghsPictograms.includes('flammable');
  const organic = classification.traits.organic === true || hasGroup(groupIds, FLAMMABLE_ORGANIC_GROUPS) || hasGroup(groupIds, ORGANIC_ACID_GROUPS);
  const toxic = classification.traits.toxic || match.chemical.ghsPictograms.includes('toxic') || hasGroup(groupIds, TOXIN_GROUPS);

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
      reasons.push('Organic acid with flammable/organic signal; store with flammable organic materials and keep away from oxidizing acids.');
      requirements.push('secondary containment');
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

  if (toxic) {
    const volatilePoison = classification.traits.volatilePoison || /chloroform|dichloromethane|methylene chloride|chlorinated solvent/.test(text);
    const zoneId: Storage20ZoneId = volatilePoison ? 'volatilePoisonsChlorinated' : isSolid(match) ? 'dryPoisons' : 'liquidPoisons';
    reasons.push(hasCameo ? 'CAMEO toxin reactive group.' : 'GHS acute/chronic toxicity signal without CAMEO match.');
    if (zoneId === 'volatilePoisonsChlorinated') requirements.push('secondary containment');
    else if (zoneId === 'liquidPoisons') requirements.push('liquid containment');
    return assignment(match, zoneId, volatilePoison ? 'volatilePoison' : organic ? 'organicPoison' : 'inorganicPoison', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (flammable || cabinets.has('flammables')) {
    reasons.push(hasCameo ? 'CAMEO flammable organic reactive group.' : 'GHS flammable H-code or pictogram without CAMEO match.');
    return assignment(match, 'organicSolventsAcids', 'organicSolvent', source, hasCameo || hasGhs ? 'high' : confidence, reasons, requirements, constraints);
  }

  if (isSolid(match) && (cabinets.size === 0 || cabinets.has('shelving') || classification.suggestionGroups.has('group9DrySolid'))) {
    reasons.push(hasCameo ? 'CAMEO low-reactivity solid/shelving signal.' : 'Dry solid with no stronger GHS/CAMEO storage trigger.');
    requirements.push('keep dry');
    return assignment(match, 'drySolids', 'drySolid', source, hasCameo ? 'medium' : hasGhs || hasPubChem ? 'medium' : 'review', reasons, requirements, constraints);
  }

  reasons.push(hasCameo ? 'CAMEO groups do not map to a specific Storage 2.0 category.' : 'No CAMEO match and no strong GHS/PubChem storage trigger.');
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

export function cabinetForZone(zoneId: Storage20ZoneId): Storage20CabinetId {
  if (zoneId === 'organicSolventsAcids' || zoneId === 'volatilePoisonsChlorinated') return 'flammables';
  if (zoneId === 'nonOxidizingAcids' || zoneId === 'oxidizingAcids') return 'corrosiveAcids';
  if (zoneId === 'solidBases' || zoneId === 'liquidBases') return 'corrosiveBases';
  if (zoneId === 'oxidizersOnly') return 'oxidizers';
  if (zoneId === 'dryPoisons' || zoneId === 'liquidPoisons') return 'toxins';
  if (zoneId === 'drySolids') return 'shelving';
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
  return constraints;
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
  drySolids: 'Dry solids',
  specialReview: 'Hard isolation / dedicated reactive storage',
  review: 'Unassigned / assessor review',
};

export const CABINET_ORDER: Storage20CabinetId[] = ['specialReview', 'flammables', 'corrosiveAcids', 'corrosiveBases', 'oxidizers', 'toxins', 'shelving', 'review'];

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
    cabinetId: 'flammables',
    cabinetTitle: 'Flammables Cabinet',
    zoneTitle: 'Volatile poisons and chlorinated solvents',
    note: 'Requires secondary containment; keep from incompatible spill contact within the cabinet.',
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
  drySolids: {
    id: 'drySolids',
    cabinetId: 'shelving',
    cabinetTitle: 'Shelving',
    zoneTitle: 'Dry solids',
    note: 'Dry, compatible solids only; avoid shelves above/near incompatible liquids.',
    className: 'border-emerald-300 bg-emerald-100',
    textClassName: 'text-emerald-950',
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
 * Apply assessor overrides to an automatic Storage 2.0 assignment.
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
