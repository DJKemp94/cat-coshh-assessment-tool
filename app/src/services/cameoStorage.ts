import chemicalsJson from '@/data/cameo/chemicals.json';
import chemicalGroupsJson from '@/data/cameo/chemicalGroups.json';
import metaJson from '@/data/cameo/meta.json';
import reactiveGroupsJson from '@/data/cameo/reactiveGroups.json';
import reactivityJson from '@/data/cameo/reactivity.json';
import { Storage2MatchEdit, Storage2PairEdit, Substance } from '@/types/assessment';

export type CameoCompatibility = 'Incompatible' | 'Caution' | 'Compatible' | 'Unknown';
type CameoMatchConfidence = 'exact-cas' | 'exact-name' | 'synonym' | 'manual' | 'unmatched';

/**
 * Cabinet destination determined by CAMEO reactive group membership.
 * specialReview = hard isolation, dedicated reactive storage / manual SDS review.
 */
type CabinetId = 'specialReview' | 'oxidizers' | 'flammables' | 'corrosiveAcids' | 'corrosiveBases' | 'toxins' | 'shelving';

/**
 * Maps every CAMEO reactive group ID to its recommended cabinet destination.
 * Priority order when a chemical belongs to multiple groups:
 *   specialReview > oxidizers > (solid → shelving) > corrosive/flammable/toxin.
 */
export const CAMEO_GROUP_TO_CABINET: Record<number, CabinetId> = {
  // ── Special / Review (Priority 1) ──────────────────────────────────
  107: 'specialReview', // Water-Reactive
  109: 'specialReview', // Pyrophoric
  108: 'specialReview', // Air-Reactive
  102: 'specialReview', // Explosive
  103: 'specialReview', // Polymerizable
   76: 'specialReview', // Polymerizable Compounds
   21: 'specialReview', // Metals, Alkali, Very Active
   22: 'specialReview', // Metals, Elemental and Powder, Active
   35: 'specialReview', // Metal Hydrides, Metal Alkyls, Metal Aryls, and Silanes
   42: 'specialReview', // Organometallics
   51: 'specialReview', // Nitrides, Phosphides, Carbides, and Silicides
  400: 'specialReview', // Radioactive Material
   30: 'specialReview', // Peroxides, Organic
  110: 'specialReview', // Decomposes at Elevated Temperatures (<120 deg. C)
  106: 'specialReview', // Known Catalytic Activity
   45: 'specialReview', // Reducing Agents, Strong
  105: 'specialReview', // Strong Reducing Agent
   99: 'specialReview', // Insufficient Information for Classification

  // ── Oxidizers (Priority 2) ─────────────────────────────────────────
   44: 'oxidizers',  // Oxidizing Agents, Strong
  104: 'oxidizers',  // Strong Oxidizing Agent
   49: 'oxidizers',  // Oxidizing Agents, Weak
   27: 'oxidizers',  // Nitro, Nitroso, Nitrate, and Nitrite Compounds, Organic
   69: 'oxidizers',  // Nitrate and Nitrite Compounds, Inorganic

  // ── Flammables ─────────────────────────────────────────────────────
   16: 'flammables',  // Hydrocarbons, Aromatic
   28: 'flammables',  // Hydrocarbons, Aliphatic Unsaturated
   29: 'flammables',  // Hydrocarbons, Aliphatic Saturated
    4: 'flammables',  // Alcohols and Polyols
   19: 'flammables',  // Ketones
   14: 'flammables',  // Ethers
   13: 'flammables',  // Esters, Sulfate Esters, Phosphate Esters, Thiophosphate Esters, and Borate Esters
    5: 'flammables',  // Aldehydes
   63: 'flammables',  // Alkynes, with Acetylenic Hydrogen
   64: 'flammables',  // Alkynes, with No Acetylenic Hydrogen
   71: 'flammables',  // Acrylates and Acrylic Acids
   58: 'flammables',  // Siloxanes
  111: 'flammables',  // Peroxidizable Compound
   70: 'flammables',  // Acetals, Ketals, Hemiacetals, and Hemiketals
   65: 'flammables',  // Conjugated Dienes
   34: 'flammables',  // Epoxides
  101: 'flammables',  // Highly Flammable
   66: 'flammables',  // Aryl Halides
   47: 'flammables',  // Fluorinated Organic Compounds

  // ── Corrosives — Acids ─────────────────────────────────────────────
    1: 'corrosiveAcids',   // Acids, Strong Non-oxidizing
    2: 'corrosiveAcids',   // Acids, Strong Oxidizing (double containment sub-rule)
    3: 'corrosiveAcids',   // Acids, Carboxylic
   60: 'corrosiveAcids',   // Acids, Weak
   37: 'corrosiveAcids',   // Anhydrides
   40: 'corrosiveAcids',   // Acyl Halides, Sulfonyl Halides, and Chloroformates
   55: 'corrosiveAcids',   // Chlorosilanes
   59: 'corrosiveAcids',   // Halogenating Agents
   38: 'corrosiveAcids',   // Salts, Acidic

  // ── Corrosives — Bases ─────────────────────────────────────────────
   10: 'corrosiveBases',  // Bases, Strong
   61: 'corrosiveBases',  // Bases, Weak
    7: 'corrosiveBases',  // Amines, Phosphines, and Pyridines
   68: 'corrosiveBases',  // Amines, Aromatic
   73: 'corrosiveBases',  // Quaternary Ammonium and Phosphonium Salts

  // ── Toxins ─────────────────────────────────────────────────────────
   11: 'toxins',  // Cyanides, Inorganic
   20: 'toxins',  // Sulfides, Organic
   33: 'toxins',  // Sulfides, Inorganic
   18: 'toxins',  // Isocyanates and Isothiocyanates
   26: 'toxins',  // Nitriles
    8: 'toxins',  // Azo, Diazo, Azido, Hydrazine, and Azide Compounds
   25: 'toxins',  // Diazonium Salts
   31: 'toxins',  // Phenols and Cresols
    9: 'toxins',  // Carbamates
   17: 'toxins',  // Halogenated Organic Compounds
   48: 'toxins',  // Fluoride Salts, Soluble
    6: 'toxins',  // Amides and Imides
   75: 'toxins',  // Oximes
   72: 'toxins',  // Phenolic Salts
   32: 'toxins',  // Sulfonates, Phosphonates, and Thiophosphonates, Organic
   12: 'toxins',  // Thiocarbamate Esters and Salts/Dithiocarbamate Esters and Salts

  // ── Shelving ───────────────────────────────────────────────────────
   46: 'shelving',  // Non-Redox-Active Inorganic Compounds
   62: 'shelving',  // Carbonate Salts
   39: 'shelving',  // Salts, Basic — mildly basic salts (iodides, acetates); caustic bases are group 10
   98: 'shelving',  // Not Chemically Reactive
   23: 'shelving',  // Metals, Less Reactive
   74: 'shelving',  // Sulfite and Thiosulfate Salts
   50: 'shelving',  // Reducing Agents, Weak — not hard isolation; gets a segregate-from-oxidizers constraint
  100: 'shelving',  // Water and Aqueous Solutions
};

interface CameoChemical {
  id: number;
  name: string;
  cas: string[];
  synonyms: string[];
  dotLabels: string[];
  formulas: string[];
  airWaterReactions: string;
  chemicalProfile: string;
  specialHazards: string;
  incompatibleAbsorbents: string[];
  nfpa: {
    flammability: number | null;
    health: number | null;
    reactivity: number | null;
    special: string;
  };
}

interface CameoReactiveGroup {
  id: number;
  name: string;
  special: boolean;
  description: string;
  flammability: string;
  reactivity: string;
  toxicity: string;
  characteristics: string;
  examples: string;
}

interface CameoChemicalGroup {
  chemicalId: number;
  groupId: number;
}

interface CameoReactivity {
  groupA: number;
  groupB: number;
  compatibility: CameoCompatibility;
  gasProducts: string[];
  hazardsDocumentation: string;
  hazards: Array<{ name: string; phrases: string[] }>;
}

export interface CameoMatch {
  chemical: Substance;
  cameo: CameoChemical | null;
  confidence: CameoMatchConfidence;
  reason: string;
  groups: CameoReactiveGroup[];
  confirmed: boolean;
  note: string;
}

export interface CameoPairFinding {
  key: string;
  left: CameoMatch;
  right: CameoMatch;
  compatibility: CameoCompatibility;
  effectiveCompatibility: CameoCompatibility;
  severity: number;
  groupFindings: Array<{
    leftGroup: CameoReactiveGroup;
    rightGroup: CameoReactiveGroup;
    compatibility: CameoCompatibility;
    gasProducts: string[];
    hazards: string[];
    hazardsDocumentation: string;
  }>;
  override?: Storage2PairEdit;
}

export const cameoMeta = metaJson as {
  version: string;
  importDate: string;
  extractedAt: string;
  source: string;
  counts: Record<string, number>;
};

export const cameoChemicals = chemicalsJson as CameoChemical[];
export const cameoReactiveGroups = reactiveGroupsJson as CameoReactiveGroup[];

const chemicalGroups = chemicalGroupsJson as CameoChemicalGroup[];
const reactivity = reactivityJson as CameoReactivity[];

const byChemicalId = new Map(cameoChemicals.map((chemical) => [chemical.id, chemical]));
const byGroupId = new Map(cameoReactiveGroups.map((group) => [group.id, group]));
const groupsByChemicalId = new Map<number, number[]>();
for (const row of chemicalGroups) {
  const list = groupsByChemicalId.get(row.chemicalId) ?? [];
  list.push(row.groupId);
  groupsByChemicalId.set(row.chemicalId, list);
}

const casIndex = new Map<string, CameoChemical[]>();
const nameIndex = new Map<string, CameoChemical>();
const synonymIndex = new Map<string, CameoChemical>();

for (const chemical of cameoChemicals) {
  for (const cas of chemical.cas) {
    const key = normalizeCas(cas);
    const list = casIndex.get(key) ?? [];
    list.push(chemical);
    casIndex.set(key, list);
  }
  const nameKey = normalizeName(chemical.name);
  if (nameKey && !nameIndex.has(nameKey)) nameIndex.set(nameKey, chemical);
  for (const synonym of chemical.synonyms) {
    const key = normalizeName(synonym);
    if (key && !synonymIndex.has(key)) synonymIndex.set(key, chemical);
  }
}

const reactivityIndex = new Map<string, CameoReactivity>();
for (const row of reactivity) {
  reactivityIndex.set(pairKeyForGroups(row.groupA, row.groupB), row);
}

function normalizeName(value?: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCas(value?: string) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function storage2PairKey(leftChemicalId: string, rightChemicalId: string) {
  return [leftChemicalId, rightChemicalId].sort().join('::');
}

function pairKeyForGroups(leftGroupId: number, rightGroupId: number) {
  return [leftGroupId, rightGroupId].sort((a, b) => a - b).join(':');
}

function compatibilitySeverity(value: CameoCompatibility) {
  if (value === 'Incompatible') return 3;
  if (value === 'Caution') return 2;
  if (value === 'Unknown') return 1;
  return 0;
}

function worstCompatibility(values: CameoCompatibility[]): CameoCompatibility {
  return values.reduce<CameoCompatibility>(
    (worst, value) => (compatibilitySeverity(value) > compatibilitySeverity(worst) ? value : worst),
    'Compatible',
  );
}

function cameoGroupsFor(chemicalId: number) {
  return (groupsByChemicalId.get(chemicalId) ?? [])
    .map((groupId) => byGroupId.get(groupId))
    .filter(Boolean) as CameoReactiveGroup[];
}

export function findCameoChemicalById(id: number | null | undefined) {
  return id == null ? null : byChemicalId.get(id) ?? null;
}

function chooseBestCasMatch(candidates: CameoChemical[], chemicalName: string) {
  const target = normalizeName(chemicalName);
  if (!target) return candidates[0] ?? null;
  const targetHasSpecialQualifier = /\b(red|fuming|mixture|solution|stabilized|anhydrous|aqueous)\b/.test(target);
  return [...candidates].sort((left, right) => {
    const leftName = normalizeName(left.name);
    const rightName = normalizeName(right.name);
    const leftScore = casNameScore(leftName, target, targetHasSpecialQualifier);
    const rightScore = casNameScore(rightName, target, targetHasSpecialQualifier);
    return rightScore - leftScore || left.name.length - right.name.length;
  })[0] ?? null;
}

function casNameScore(candidate: string, target: string, targetHasSpecialQualifier: boolean) {
  let score = candidate === target ? 100 : candidate.startsWith(target) || target.startsWith(candidate) ? 80 : candidate.includes(target) || target.includes(candidate) ? 60 : 0;
  if (!targetHasSpecialQualifier && /\b(red fuming|mixture|solution|stabilized)\b/.test(candidate)) score -= 20;
  if (!targetHasSpecialQualifier && /\bother than\b/.test(candidate)) score += 10;
  return score;
}

export function searchCameoChemicals(query: string, limit = 12) {
  const normalized = normalizeName(query);
  const cas = normalizeCas(query);
  if (!normalized && !cas) return [];

  const scored = cameoChemicals
    .map((chemical) => {
      let score = 0;
      if (cas && chemical.cas.some((candidate) => normalizeCas(candidate).startsWith(cas))) score = 100;
      const name = normalizeName(chemical.name);
      if (normalized && name === normalized) score = Math.max(score, 90);
      else if (normalized && name.startsWith(normalized)) score = Math.max(score, 80);
      else if (normalized && name.includes(normalized)) score = Math.max(score, 65);
      if (normalized && chemical.synonyms.some((synonym) => normalizeName(synonym).includes(normalized))) score = Math.max(score, 55);
      return { chemical, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.chemical.name.localeCompare(b.chemical.name));

  return scored.slice(0, limit).map((item) => item.chemical);
}

export function resolveCameoMatch(chemical: Substance, edit?: Storage2MatchEdit): CameoMatch {
  const manual = edit?.cameoChemicalId !== undefined;
  const manualChemical = manual ? findCameoChemicalById(edit.cameoChemicalId) : null;
  let cameo = manualChemical;
  let confidence: CameoMatchConfidence = manual ? 'manual' : 'unmatched';
  let reason = manual
    ? edit.cameoChemicalId == null
      ? 'Assessor marked this chemical as no CAMEO match.'
      : 'Assessor selected this CAMEO record.'
    : 'No CAMEO match found from CAS, name or synonyms.';

  if (!manual) {
    const cas = normalizeCas(chemical.cas);
    if (cas && casIndex.has(cas)) {
      cameo = chooseBestCasMatch(casIndex.get(cas)!, chemical.name);
      confidence = 'exact-cas';
      reason = `Matched by CAS ${chemical.cas}.`;
    } else {
      const name = normalizeName(chemical.name);
      if (name && nameIndex.has(name)) {
        cameo = nameIndex.get(name)!;
        confidence = 'exact-name';
        reason = 'Matched by exact CAMEO chemical name.';
      } else if (name && synonymIndex.has(name)) {
        cameo = synonymIndex.get(name)!;
        confidence = 'synonym';
        reason = 'Matched by CAMEO synonym.';
      }
    }
  }

  return {
    chemical,
    cameo,
    confidence,
    reason,
    groups: cameo ? cameoGroupsFor(cameo.id) : [],
    confirmed: edit?.confirmed === true,
    note: edit?.note ?? '',
  };
}

export function buildCameoPairs(matches: CameoMatch[], overrides: Record<string, Storage2PairEdit>) {
  const pairs: CameoPairFinding[] = [];
  for (let leftIndex = 0; leftIndex < matches.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < matches.length; rightIndex += 1) {
      const left = matches[leftIndex];
      const right = matches[rightIndex];
      const key = storage2PairKey(left.chemical.id, right.chemical.id);
      const groupFindings = left.groups.flatMap((leftGroup) =>
        right.groups.map((rightGroup) => {
          const finding = reactivityIndex.get(pairKeyForGroups(leftGroup.id, rightGroup.id));
          const compatibility = finding?.compatibility ?? 'Unknown';
          return {
            leftGroup,
            rightGroup,
            compatibility,
            gasProducts: finding?.gasProducts ?? [],
            hazards: finding?.hazards.flatMap((hazard) => [hazard.name, ...hazard.phrases]).filter(Boolean) ?? [],
            hazardsDocumentation: finding?.hazardsDocumentation ?? '',
          };
        }),
      );
      const compatibility = left.cameo && right.cameo && groupFindings.length > 0
        ? worstCompatibility(groupFindings.map((finding) => finding.compatibility))
        : 'Unknown';
      const override = overrides[key];
      const effectiveCompatibility = override?.assessorDecision === 'override-compatible'
        ? 'Compatible'
        : override?.assessorDecision === 'override-separate'
          ? 'Incompatible'
          : compatibility;

      pairs.push({
        key,
        left,
        right,
        compatibility,
        effectiveCompatibility,
        severity: compatibilitySeverity(effectiveCompatibility),
        groupFindings,
        override,
      });
    }
  }
  return pairs.sort((a, b) => b.severity - a.severity || a.left.chemical.name.localeCompare(b.left.chemical.name));
}
