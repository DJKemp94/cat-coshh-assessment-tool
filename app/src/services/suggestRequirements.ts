import { Assessment, Substance, GhsPictogram } from '@/types/assessment';
import { classifyStorage, StorageSuggestionGroup } from '@/services/storageClassifier';

export type RequirementField =
  | 'storage'
  | 'incompatibles'
  | 'emergencySpills'
  | 'emergencyFirstAid'
  | 'emergencyFire'
  | 'wasteHandling';

export interface Suggestion {
  text: string;
  hint: string;
}

interface Rule {
  hCodes?: string[];
  pictograms?: GhsPictogram[];
  trigger: string;
  text: string;
}

// H-code shorthand groups used below.
const EXPLOSIVE = ['H200','H201','H202','H203','H204','H205','H240','H241'];
const FLAMMABLE = ['H220','H221','H222','H223','H224','H225','H226','H228','H242'];
const FLAMMABLE_GAS = ['H220','H221'];
const PRESSURISED = ['H229','H280','H281'];
const PYROPHORIC = ['H250','H251','H252','H230','H231'];
const WATER_REACTIVE = ['H260','H261'];
const OXIDISING = ['H270','H271','H272'];
const CORROSIVE_METALS = ['H290'];
const ACUTE_TOX_INH = ['H330','H331','H332'];
const ACUTE_TOX_DERMAL = ['H310','H311','H312'];
const ACUTE_TOX_ORAL = ['H300','H301','H302'];
const ALL_ACUTE_TOX = [...ACUTE_TOX_INH, ...ACUTE_TOX_DERMAL, ...ACUTE_TOX_ORAL];
const SKIN_CORR = ['H314'];
const SKIN_IRR = ['H315'];
const SKIN_SENS = ['H317'];
const EYE_DMG = ['H318'];
const EYE_IRR = ['H319'];
const RESP_SENS = ['H334'];
const RESP_IRR = ['H335'];
const CNS_DEPRESS = ['H336'];
const ASPIRATION = ['H304'];
const CMR = ['H340','H341','H350','H351','H360','H361'];
const TARGET_ORGAN = ['H370','H371','H372','H373'];
const AQUATIC = ['H400','H410','H411','H412','H413'];

const STORAGE: Rule[] = [];

const INCOMPATIBLES: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Segregate explosives or self-reactives from incompatible materials, heat, friction, impact and ignition sources as specified by the SDS.' },
];

const SPILLS: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Evacuate and call specialist response for explosive or self-reactive spills. Do not sweep, absorb or disturb unless the SDS and local emergency plan confirm it is safe.' },
  { hCodes: [...SKIN_CORR, ...CORROSIVE_METALS], trigger: 'corrosive', text: 'For corrosive spills, isolate the area, wear suitable chemical PPE, ventilate, contain with compatible absorbent and collect as hazardous waste. Neutralise only where the SDS and local procedure allow.' },
  { hCodes: FLAMMABLE, pictograms: ['flammable'], trigger: 'flammable', text: 'For flammable spills, remove ignition sources if safe, ventilate, prevent spread and collect with compatible non-sparking equipment and inert absorbent.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'For toxic spills, keep people away, escalate to trained responders and follow the SDS spill procedure, including any respiratory protection or evacuation requirements.' },
  { hCodes: AQUATIC, pictograms: ['environmental'], trigger: 'aquatic hazard', text: 'Prevent spills entering drains or watercourses. Bund, absorb or contain the release and escalate under the local environmental procedure.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'For water-reactive spills, keep dry, isolate from water and aqueous materials, ventilate if safe and follow the SDS for compatible absorbents.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric', text: 'For pyrophoric or self-heating spills, isolate from air, water and ignition sources; use only SDS-approved inert media and call trained responders.' },
  { hCodes: OXIDISING, trigger: 'oxidising', text: 'For oxidiser spills, keep away from combustible materials and use only compatible inert absorbents or clean-up media specified by the SDS.' },
  { hCodes: RESP_SENS, trigger: 'respiratory sensitiser', text: 'For respiratory sensitiser spills, prevent inhalation exposure, ventilate or evacuate as appropriate and allow re-entry only after controls are confirmed effective.' },
];

const FIRST_AID: Rule[] = [
  { hCodes: SKIN_CORR, trigger: 'skin corrosion (H314)', text: 'Skin contact with corrosives: remove contaminated clothing, rinse immediately with running water and seek urgent medical advice. Follow the SDS for rinse duration and aftercare.' },
  { hCodes: SKIN_IRR, trigger: 'skin irritation (H315)', text: 'Skin contact with irritants: wash with water, remove contaminated clothing and seek advice if symptoms persist.' },
  { hCodes: SKIN_SENS, trigger: 'skin sensitiser (H317)', text: 'Skin sensitiser exposure: remove exposure, wash thoroughly and report rash, dermatitis or reaction symptoms to Occupational Health.' },
  { hCodes: EYE_DMG, trigger: 'eye damage (H318)', text: 'Eye exposure with serious eye-damage hazards: rinse immediately using eyewash while holding eyelids open and seek urgent medical attention.' },
  { hCodes: EYE_IRR, trigger: 'eye irritation (H319)', text: 'Eye exposure with irritants: rinse cautiously with water and seek advice if pain, redness or visual symptoms persist.' },
  { hCodes: [...ACUTE_TOX_INH, ...RESP_IRR], trigger: 'respiratory hazard', text: 'Inhalation exposure: move the person to fresh air if safe to do so, keep at rest and seek medical advice where symptoms, toxic exposure or respiratory irritation may have occurred.' },
  { hCodes: RESP_SENS, trigger: 'respiratory sensitiser (H334)', text: 'Respiratory sensitiser exposure: move to fresh air, monitor for delayed wheeze or asthma symptoms and seek medical advice even if symptoms develop later.' },
  { hCodes: CNS_DEPRESS, trigger: 'CNS depressant (H336)', text: 'Drowsiness or dizziness: move to fresh air, avoid leaving the person alone and seek medical advice if symptoms persist or exposure was significant.' },
  { hCodes: ACUTE_TOX_ORAL, trigger: 'acute oral toxicity', text: 'Ingestion of acutely toxic substances: rinse mouth, do not induce vomiting unless medically directed, and seek urgent medical advice with the SDS available.' },
  { hCodes: ASPIRATION, trigger: 'aspiration hazard (H304)', text: 'Aspiration hazard: do not induce vomiting. Seek urgent medical advice because liquid entering the lungs can cause serious harm.' },
  { hCodes: ACUTE_TOX_DERMAL, trigger: 'dermal toxicity', text: 'Dermal toxic exposure: remove contaminated clothing, wash exposed skin thoroughly and seek medical advice based on SDS first-aid guidance.' },
  { hCodes: TARGET_ORGAN, trigger: 'target organ toxicity', text: 'Following significant exposure to target-organ toxic substances, arrange medical or Occupational Health review against the SDS and exposure details.' },
  { hCodes: CMR, trigger: 'CMR', text: 'For suspected CMR exposure, record the incident and refer to Occupational Health or competent medical advice under the local exposure-reporting process.' },
];

const FIRE: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Explosive or self-reactive fire risk: evacuate, keep distance and tell emergency responders about the substance and SDS hazards.' },
  { hCodes: FLAMMABLE, pictograms: ['flammable'], trigger: 'flammable', text: 'Flammable substances: use extinguishing media suitable for the material and surrounding fire, and cool exposed containers from a safe distance where appropriate.' },
  { hCodes: OXIDISING, pictograms: ['oxidising'], trigger: 'oxidising', text: 'Oxidisers can intensify fire. Keep away from combustibles and use only SDS-approved firefighting media.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'Water-reactive substances: do not use water unless the SDS or emergency responder confirms it is safe; use compatible dry media specified by the SDS.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric / self-heating', text: 'Pyrophoric or self-heating substances: isolate from air and water where safe, evacuate if needed and use only SDS-approved extinguishing media.' },
  { hCodes: PRESSURISED, pictograms: ['compressed-gas'], trigger: 'pressurised cylinder', text: 'Pressurised containers: evacuate if heating or fire exposure occurs, keep distance and cool from a protected position only if safe.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Fire involving toxic substances may generate harmful fumes. Evacuate affected areas and provide SDS details to emergency responders.' },
  { hCodes: AQUATIC, trigger: 'aquatic hazard', text: 'Contain firefighting run-off where practicable and prevent release to drains or watercourses.' },
];

const WASTE: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Do not place explosive or self-reactive waste into routine waste streams. Arrange specialist disposal through the approved hazardous-waste route.' },
  { hCodes: CMR, trigger: 'CMR', text: 'Segregate CMR waste, label it clearly and dispose of it through the approved hazardous-waste route.' },
  { hCodes: AQUATIC, pictograms: ['environmental'], trigger: 'aquatic hazard', text: 'Collect environmentally hazardous waste in sealed compatible containment. Do not dispose to drain.' },
  { hCodes: FLAMMABLE, trigger: 'flammable', text: 'Collect flammable waste in sealed, labelled, compatible containers and segregate waste streams according to local procedure.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Collect toxic waste in sealed, clearly labelled compatible containers for approved hazardous-waste disposal.' },
  { hCodes: [...SKIN_CORR, ...CORROSIVE_METALS], trigger: 'corrosive', text: 'Collect corrosive waste in compatible containers. Neutralise only where the SDS and local procedure confirm it is safe and authorised.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric / self-heating', text: 'Manage pyrophoric or self-heating waste using the SDS-approved quench, inerting or containment method before disposal.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'Keep water-reactive waste dry and segregated from aqueous waste until collected through the approved disposal route.' },
];

const RULESETS: Record<RequirementField, Rule[]> = {
  storage: STORAGE,
  incompatibles: INCOMPATIBLES,
  emergencySpills: SPILLS,
  emergencyFirstAid: FIRST_AID,
  emergencyFire: FIRE,
  wasteHandling: WASTE,
};

interface ChemicalSignal {
  hCodes: Set<string>;
  pictograms: Set<GhsPictogram>;
}

interface ChemicalProfile extends ChemicalSignal {
  id: string;
  name: string;
  search: string;
  groups: Set<StorageSuggestionGroup>;
}

const collectSignals = (chems: Substance[]): { all: ChemicalSignal; byChem: Map<string, ChemicalSignal> } => {
  const all: ChemicalSignal = { hCodes: new Set(), pictograms: new Set() };
  const byChem = new Map<string, ChemicalSignal>();
  for (const c of chems) {
    const sig: ChemicalSignal = { hCodes: new Set(), pictograms: new Set() };
    c.hazardStatements.forEach((h) => { sig.hCodes.add(h.code); all.hCodes.add(h.code); });
    c.ghsPictograms.forEach((p) => { sig.pictograms.add(p); all.pictograms.add(p); });
    if (sig.hCodes.size + sig.pictograms.size > 0) byChem.set(c.name || c.cas || c.id, sig);
  }
  return { all, byChem };
};

const ruleMatchesSignal = (r: Rule, sig: ChemicalSignal): boolean => {
  if (r.hCodes && r.hCodes.some((h) => sig.hCodes.has(h))) return true;
  if (r.pictograms && r.pictograms.some((p) => sig.pictograms.has(p))) return true;
  return false;
};

function profileFor(c: Substance): ChemicalProfile {
  const classification = classifyStorage(c);
  const hCodes = new Set(classification.hCodes);
  const pictograms = new Set(c.ghsPictograms);
  const name = c.name || c.cas || 'Unnamed substance';
  const search = `${c.name} ${c.cas ?? ''}`.toLowerCase();
  const groups = new Set<StorageSuggestionGroup>(classification.suggestionGroups);

  return { id: c.id, name, search, hCodes, pictograms, groups };
}

const names = (profiles: ChemicalProfile[]) =>
  profiles.map((p) => p.name).filter(Boolean).slice(0, 4).join(', ');

function groupMembers(profiles: ChemicalProfile[], group: StorageSuggestionGroup) {
  return profiles.filter((p) => p.groups.has(group));
}

function profileHasAny(p: ChemicalProfile, hCodes: string[]) {
  return hCodes.some((h) => p.hCodes.has(h));
}

function pushStorageSuggestion(
  out: Suggestion[],
  seen: Set<string>,
  profiles: ChemicalProfile[],
  text: string,
  hint: string,
) {
  if (profiles.length === 0) return;
  if (seen.has(text)) return;
  seen.add(text);
  out.push({ text, hint });
}

function selectedStorageSuggestions(chems: Substance[]): Suggestion[] {
  const profiles = chems.filter((c) => c.name.trim() || c.cas?.trim()).map(profileFor);
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const fbmh = (group: string) => `Based on FBMH chemical storage table ${group}; check SDS sections 7 and 10.`;

  const explosive = profiles.filter((p) => profileHasAny(p, EXPLOSIVE));
  pushStorageSuggestion(
    out,
    seen,
    explosive,
    `Store explosives or self-reactives (${names(explosive)}) in approved storage, in minimum quantities, protected from heat, friction, shock and incompatible materials.`,
    'Triggered by explosive/self-reactive H-codes.',
  );

  const flammableGas = profiles.filter((p) => profileHasAny(p, FLAMMABLE_GAS));
  pushStorageSuggestion(
    out,
    seen,
    flammableGas,
    `Store flammable gases (${names(flammableGas)}) upright, secured, ventilated and segregated from oxidising gases and ignition sources.`,
    'Triggered by H220/H221 flammable gas classification.',
  );

  const pressurised = profiles.filter((p) => profileHasAny(p, PRESSURISED) || p.pictograms.has('compressed-gas'));
  pushStorageSuggestion(
    out,
    seen,
    pressurised,
    `Store pressurised gas containers (${names(pressurised)}) upright, secured, ventilated and protected from heat or physical damage.`,
    'Triggered by compressed-gas pictogram or H229/H280/H281.',
  );

  const group1 = groupMembers(profiles, 'group1Flammable');
  pushStorageSuggestion(
    out,
    seen,
    group1,
    `Store flammables and combustibles (${names(group1)}) in approved flammable storage, away from ignition sources, oxidisers and incompatible chemicals. Keep only the working quantity at the point of use.`,
    fbmh('Group 1: flammables and combustibles'),
  );

  const group2 = groupMembers(profiles, 'group2VolatilePoison');
  pushStorageSuggestion(
    out,
    seen,
    group2,
    `Store volatile poisons or halogenated solvents (${names(group2)}) separately in compatible, ventilated storage where practicable. Segregate from bases, oxidisers and reactive materials.`,
    fbmh('Group 2: volatile poisons, halogenated/chlorinated solvents'),
  );

  const group3 = groupMembers(profiles, 'group3OxidisingAcid');
  pushStorageSuggestion(
    out,
    seen,
    group3,
    `Store oxidising inorganic acids (${names(group3)}) in compatible corrosives storage with secondary containment. Segregate from organic materials, flammables, bases and other incompatible storage groups.`,
    fbmh('Group 3: oxidising inorganic acids'),
  );

  const group4 = groupMembers(profiles, 'group4NonOxidisingAcid');
  pushStorageSuggestion(
    out,
    seen,
    group4,
    `Store non-oxidising organic or mineral acids (${names(group4)}) in compatible corrosives storage with secondary containment. Segregate from bases and incompatible chemicals.`,
    fbmh('Group 4: non-oxidising organic and mineral acids'),
  );

  const group5 = groupMembers(profiles, 'group5LiquidBase');
  pushStorageSuggestion(
    out,
    seen,
    group5,
    `Store liquid bases (${names(group5)}) in compatible corrosives storage with secondary containment. Segregate from acids, halogenated solvents and incompatible chemicals.`,
    fbmh('Group 5: liquid bases'),
  );

  const group5Solid = groupMembers(profiles, 'group5SolidBase');
  pushStorageSuggestion(
    out,
    seen,
    group5Solid,
    `Store solid bases/alkalis (${names(group5Solid)}) in compatible corrosives storage, dry and protected from contact with acids, halogenated solvents and liquid spills.`,
    fbmh('Group 5: solid bases / alkalis; segregate from acids and incompatible liquids'),
  );

  const group6 = groupMembers(profiles, 'group6OxidiserPeroxide');
  pushStorageSuggestion(
    out,
    seen,
    group6,
    `Store oxidisers or organic peroxides (${names(group6)}) isolated from other storage groups, using compatible secondary containment and minimum practicable quantities.`,
    fbmh('Group 6: oxidizers / organic peroxides; compatible storage groups: none'),
  );

  const group7 = groupMembers(profiles, 'group7Poison');
  pushStorageSuggestion(
    out,
    seen,
    group7,
    `Store non-volatile poisons or toxins (${names(group7)}) in secure, clearly labelled compatible storage with secondary containment. Keep liquids below solids where practicable.`,
    fbmh('Group 7: non-volatile liquid and dry poisons'),
  );

  const group9 = groupMembers(profiles, 'group9DrySolid');
  pushStorageSuggestion(
    out,
    seen,
    group9,
    `Store dry solids or powders (${names(group9)}) in stable, labelled storage, protected from moisture, contamination and contact with liquid spills.`,
    fbmh('Group 9: dry solids'),
  );

  const waterReactive = groupMembers(profiles, 'waterReactive');
  pushStorageSuggestion(
    out,
    seen,
    waterReactive,
    `Store water-reactive substances (${names(waterReactive)}) dry, sealed and physically segregated from water, aqueous materials and incompatible chemicals.`,
    'Triggered by H260/H261 water-reactive classification; check SDS sections 7 and 10.',
  );

  const pyrophoric = groupMembers(profiles, 'pyrophoric');
  pushStorageSuggestion(
    out,
    seen,
    pyrophoric,
    `Store pyrophoric or self-heating substances (${names(pyrophoric)}) exactly as specified by the SDS, segregated from air, water, oxidisers and ignition sources.`,
    'Triggered by pyrophoric/self-heating/self-reactive H-codes; check SDS sections 7 and 10.',
  );

  const aquatic = profiles.filter((p) => profileHasAny(p, AQUATIC) || p.pictograms.has('environmental'));
  pushStorageSuggestion(
    out,
    seen,
    aquatic,
    `Store aquatic or environmental hazards (${names(aquatic)}) in suitable secondary containment to prevent release to drains, soil or watercourses.`,
    'Triggered by aquatic/environmental H-codes or environmental pictogram.',
  );

  return out;
}

function pushPairSuggestion(
  out: Suggestion[],
  seen: Set<string>,
  a: ChemicalProfile[],
  b: ChemicalProfile[],
  text: string,
  hint: string,
) {
  if (a.length === 0 || b.length === 0) return;
  const aIds = new Set(a.map((p) => p.id));
  if (b.every((p) => aIds.has(p.id))) return;
  if (seen.has(text)) return;
  seen.add(text);
  out.push({ text, hint });
}

function selectedIncompatibilitySuggestions(chems: Substance[]): Suggestion[] {
  const profiles = chems.filter((c) => c.name.trim() || c.cas?.trim()).map(profileFor);
  const out: Suggestion[] = [];
  const seen = new Set<string>();

  const group1 = groupMembers(profiles, 'group1Flammable');
  const group2 = groupMembers(profiles, 'group2VolatilePoison');
  const group3 = groupMembers(profiles, 'group3OxidisingAcid');
  const group4 = groupMembers(profiles, 'group4NonOxidisingAcid');
  const group5 = groupMembers(profiles, 'group5LiquidBase');
  const group5Solid = groupMembers(profiles, 'group5SolidBase');
  const group6 = groupMembers(profiles, 'group6OxidiserPeroxide');
  const group7 = groupMembers(profiles, 'group7Poison');
  const group9 = groupMembers(profiles, 'group9DrySolid');
  const waterReactive = groupMembers(profiles, 'waterReactive');
  const pyrophoric = groupMembers(profiles, 'pyrophoric');

  const fbmh = (groups: string) => `FBMH chemical storage table: ${groups}. Check SDS sections 7 and 10.`;

  pushPairSuggestion(out, seen, group1, group3,
    `Segregate flammables/combustibles (${names(group1)}) from oxidising inorganic acids (${names(group3)}).`,
    fbmh('Group 1 must be isolated from oxidising acids; Group 3 must be isolated from flammables and organic solvents'),
  );
  pushPairSuggestion(out, seen, group1, group5,
    `Segregate flammables/combustibles (${names(group1)}) from liquid bases (${names(group5)}).`,
    fbmh('Group 1 must be isolated from bases'),
  );
  pushPairSuggestion(out, seen, group1, group5Solid,
    `Segregate flammables/combustibles (${names(group1)}) from solid bases/alkalis (${names(group5Solid)}).`,
    fbmh('Group 1 must be isolated from bases'),
  );
  pushPairSuggestion(out, seen, group1, group6,
    `Segregate flammables/combustibles (${names(group1)}) from oxidisers/organic peroxides (${names(group6)}).`,
    fbmh('Group 1 must be isolated from oxidizers; Group 6 is isolated from all other storage groups'),
  );
  pushPairSuggestion(out, seen, group1, waterReactive,
    `Segregate flammables/combustibles (${names(group1)}) from water-reactive substances (${names(waterReactive)}).`,
    fbmh('Group 1 must be isolated from water-reactive substances'),
  );
  pushPairSuggestion(out, seen, group1, group7,
    `Do not store flammables/combustibles (${names(group1)}) with poison/toxin storage (${names(group7)}) unless SDS compatibility confirms this is acceptable.`,
    fbmh('Group 1 must be isolated from inorganic poisons'),
  );

  pushPairSuggestion(out, seen, group2, group3,
    `Segregate volatile poisons/halogenated solvents (${names(group2)}) from oxidising inorganic acids (${names(group3)}).`,
    fbmh('Group 2 must be isolated from oxidising acids'),
  );
  pushPairSuggestion(out, seen, group2, group4,
    `Segregate volatile poisons/halogenated solvents (${names(group2)}) from organic/mineral acids (${names(group4)}).`,
    fbmh('Group 2 must be isolated from inorganic and organic acids'),
  );
  pushPairSuggestion(out, seen, group2, group5,
    `Segregate volatile poisons/halogenated solvents (${names(group2)}) from liquid bases (${names(group5)}).`,
    fbmh('Group 2 must be isolated from strong bases; Group 5 must be isolated from halogenated solvents'),
  );
  pushPairSuggestion(out, seen, group2, group5Solid,
    `Segregate volatile poisons/halogenated solvents (${names(group2)}) from solid bases/alkalis (${names(group5Solid)}).`,
    fbmh('Group 2 must be isolated from strong bases; Group 5 must be isolated from halogenated solvents'),
  );
  pushPairSuggestion(out, seen, group2, group6,
    `Segregate volatile poisons/halogenated solvents (${names(group2)}) from oxidisers/organic peroxides (${names(group6)}).`,
    fbmh('Group 2 must be isolated from oxidizers; Group 6 is isolated from all other storage groups'),
  );

  pushPairSuggestion(out, seen, group3, group4,
    `Store oxidising inorganic acids (${names(group3)}) separately from non-oxidising organic/mineral acids (${names(group4)}).`,
    fbmh('Group 3 oxidising acids are highly reactive and must be isolated from organic acids'),
  );
  pushPairSuggestion(out, seen, group3, group5,
    `Store oxidising inorganic acids (${names(group3)}) separately from liquid bases (${names(group5)}).`,
    fbmh('Group 3 must be isolated from bases'),
  );
  pushPairSuggestion(out, seen, group3, group5Solid,
    `Store oxidising inorganic acids (${names(group3)}) separately from solid bases/alkalis (${names(group5Solid)}).`,
    fbmh('Group 3 must be isolated from bases'),
  );
  pushPairSuggestion(out, seen, group3, group7,
    `Segregate oxidising inorganic acids (${names(group3)}) from poison/toxin storage (${names(group7)}).`,
    fbmh('Group 3 must be isolated from organic poisons'),
  );

  pushPairSuggestion(out, seen, group4, group5,
    `Store non-oxidising organic/mineral acids (${names(group4)}) separately from liquid bases (${names(group5)}).`,
    fbmh('Group 4 must be isolated from bases'),
  );
  pushPairSuggestion(out, seen, group4, group5Solid,
    `Store non-oxidising organic/mineral acids (${names(group4)}) separately from solid bases/alkalis (${names(group5Solid)}).`,
    fbmh('Group 4 must be isolated from bases'),
  );
  pushPairSuggestion(out, seen, group4, group6,
    `Segregate non-oxidising organic/mineral acids (${names(group4)}) from oxidisers/organic peroxides (${names(group6)}).`,
    fbmh('Group 4 must be isolated from oxidizing agents; Group 6 is isolated from all other storage groups'),
  );
  pushPairSuggestion(out, seen, group4, group7,
    `Segregate non-oxidising organic/mineral acids (${names(group4)}) from poison/toxin storage (${names(group7)}).`,
    fbmh('Group 4 must be isolated from organic or inorganic poisons'),
  );

  pushPairSuggestion(out, seen, group5, group6,
    `Segregate liquid bases (${names(group5)}) from oxidisers/organic peroxides (${names(group6)}).`,
    fbmh('Group 5 must be isolated from oxidizing substances; Group 6 is isolated from all other storage groups'),
  );
  pushPairSuggestion(out, seen, group5Solid, group6,
    `Segregate solid bases/alkalis (${names(group5Solid)}) from oxidisers/organic peroxides (${names(group6)}).`,
    fbmh('Group 5 must be isolated from oxidizing substances; Group 6 is isolated from all other storage groups'),
  );

  if (group6.length && profiles.length > group6.length && !seen.has('group6Isolate')) {
    seen.add('group6Isolate');
    out.push({
      text: `Oxidisers/organic peroxides (${names(group6)}) should be isolated from all other storage groups, using separate secondary containment if stored near other chemicals.`,
      hint: fbmh('Group 6 has no compatible storage groups'),
    });
  }

  pushPairSuggestion(out, seen, waterReactive, profiles.filter((p) => !p.groups.has('waterReactive')),
    `Keep water-reactive substances (${names(waterReactive)}) dry and segregated from aqueous solutions, acids, bases and alcohols.`,
    fbmh('Group 1/2/3 guidance isolates water-reactive substances; SDS sections 7 and 10 should be checked'),
  );

  if (pyrophoric.length && !seen.has('pyrophoric')) {
    seen.add('pyrophoric');
    out.push({
      text: `Keep pyrophoric/self-heating substances (${names(pyrophoric)}) away from air, water, oxidisers and ignition sources.`,
      hint: 'Triggered by pyrophoric/self-heating/self-reactive H-codes; check SDS sections 7 and 10.',
    });
  }

  if (group9.length && profiles.some((p) => !p.groups.has('group9DrySolid')) && !seen.has('group9Liquids')) {
    seen.add('group9Liquids');
    out.push({
      text: `Keep dry solids/powders (${names(group9)}) above liquids and protect them from contact with liquid spills.`,
      hint: fbmh('Group 9 dry solids: prevent contact and potential reaction with liquids'),
    });
  }

  pushPairSuggestion(
    out,
    seen,
    [...group3, ...group4],
    groupMembers(profiles, 'cyanide'),
    'Keep cyanides away from acids: acid contact can liberate highly toxic hydrogen cyanide gas.',
    fbmh('Group 7 note: liquid contact with cyanide-containing poisons can release poisonous gas'),
  );

  pushPairSuggestion(
    out,
    seen,
    [...group3, ...group4],
    groupMembers(profiles, 'sulfide'),
    'Keep sulphides/sulfides away from acids: acid contact can liberate toxic hydrogen sulphide gas.',
    fbmh('Group 7 note: liquid contact with sulphide-containing poisons can release poisonous gas'),
  );

  return out;
}

export function suggestRequirements(a: Assessment): Record<RequirementField, Suggestion[]> {
  const chems = a.processSteps.flatMap((s) => s.chemicals);
  const { all, byChem } = collectSignals(chems);
  const result = {} as Record<RequirementField, Suggestion[]>;

  for (const field of Object.keys(RULESETS) as RequirementField[]) {
    const matched: Suggestion[] = [];
    const seen = new Set<string>();
    for (const r of RULESETS[field]) {
      if (!ruleMatchesSignal(r, all)) continue;
      if (seen.has(r.text)) continue;
      seen.add(r.text);
      const triggerChems: string[] = [];
      for (const [name, sig] of byChem) {
        if (ruleMatchesSignal(r, sig)) triggerChems.push(name);
      }
      matched.push({
        text: r.text,
        hint: `Triggered by ${r.trigger}: ${triggerChems.slice(0, 4).join(', ')}${triggerChems.length > 4 ? '…' : ''}`,
      });
    }
    result[field] = matched;
  }
  result.storage = selectedStorageSuggestions(chems);
  const pairwise = selectedIncompatibilitySuggestions(chems);
  if (pairwise.length > 0) {
    const seen = new Set(result.incompatibles.map((s) => s.text));
    result.incompatibles = [
      ...pairwise.filter((s) => !seen.has(s.text)),
      ...result.incompatibles,
    ];
  }
  return result;
}
