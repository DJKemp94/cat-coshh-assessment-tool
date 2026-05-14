import { Assessment, Substance, GhsPictogram } from '@/types/assessment';

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
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Explosives/self-reactives must be isolated from combustibles, oxidisers, reducing agents, heat, friction and shock sources.' },
];

const SPILLS: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Do not allow to dry out — cover with copious water if applicable. Evacuate immediately and call specialist response. Do not attempt to absorb or sweep.' },
  { hCodes: [...SKIN_CORR, ...CORROSIVE_METALS], trigger: 'corrosive', text: 'Wear chemical PPE; ventilate; contain with absorbent; neutralise with appropriate base/acid; collect as hazardous waste.' },
  { hCodes: FLAMMABLE, pictograms: ['flammable'], trigger: 'flammable', text: 'Eliminate ignition sources; ventilate; absorb on inert vermiculite; collect in labelled flammable-waste container.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Evacuate and cordon area; use full chemical PPE and respiratory protection; follow SDS spill response.' },
  { hCodes: AQUATIC, pictograms: ['environmental'], trigger: 'aquatic hazard', text: 'Prevent release to drains and watercourses; bund and absorb; notify environmental safety officer.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'Do not use water; cover with dry sand or vermiculite and isolate; ventilate area.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric', text: 'Cover with dry sand or inert powder; do not expose to air; do not use water.' },
  { hCodes: OXIDISING, trigger: 'oxidising', text: 'Do not use combustible absorbents (paper, sawdust). Use inert mineral absorbents only.' },
  { hCodes: RESP_SENS, trigger: 'respiratory sensitiser', text: 'Use respiratory protection rated for the substance; ventilate thoroughly before re-entry.' },
];

const FIRST_AID: Rule[] = [
  { hCodes: SKIN_CORR, trigger: 'skin corrosion (H314)', text: 'Skin: remove contaminated clothing; irrigate with copious water for 15 min; seek medical attention immediately.' },
  { hCodes: SKIN_IRR, trigger: 'skin irritation (H315)', text: 'Skin: wash with soap and water; seek advice if irritation persists.' },
  { hCodes: SKIN_SENS, trigger: 'skin sensitiser (H317)', text: 'Skin sensitiser: remove exposure; wash thoroughly; report any rash or reaction to occupational health.' },
  { hCodes: EYE_DMG, trigger: 'eye damage (H318)', text: 'Eye: irrigate with eyewash for at least 15 min holding eyelids open; seek medical attention immediately.' },
  { hCodes: EYE_IRR, trigger: 'eye irritation (H319)', text: 'Eye: rinse cautiously with water for several minutes; seek advice if irritation persists.' },
  { hCodes: [...ACUTE_TOX_INH, ...RESP_IRR], trigger: 'respiratory hazard', text: 'Inhalation: move to fresh air, keep at rest; seek medical attention; do not induce vomiting.' },
  { hCodes: RESP_SENS, trigger: 'respiratory sensitiser (H334)', text: 'Respiratory sensitiser: move to fresh air, monitor for delayed asthma/wheeze; seek medical attention even if symptoms appear hours later.' },
  { hCodes: CNS_DEPRESS, trigger: 'CNS depressant (H336)', text: 'If dizziness or drowsiness: move to fresh air; do not leave alone; seek medical attention if symptoms persist.' },
  { hCodes: ACUTE_TOX_ORAL, trigger: 'acute oral toxicity', text: 'Ingestion: rinse mouth; do NOT induce vomiting; seek medical attention immediately with SDS.' },
  { hCodes: ASPIRATION, trigger: 'aspiration hazard (H304)', text: 'Aspiration hazard: do NOT induce vomiting — risk of chemical pneumonitis. Seek immediate medical attention.' },
  { hCodes: ACUTE_TOX_DERMAL, trigger: 'dermal toxicity', text: 'Skin: remove clothing; wash with soap and copious water; seek medical attention.' },
  { hCodes: TARGET_ORGAN, trigger: 'target organ toxicity', text: 'Following exposure, refer to occupational health for clinical review against the substance’s known target organ.' },
  { hCodes: CMR, trigger: 'CMR', text: 'Record exposure on the personal exposure log; refer to occupational health.' },
];

const FIRE: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Risk of detonation — evacuate area; fight fire from a safe distance; do not approach the container.' },
  { hCodes: FLAMMABLE, pictograms: ['flammable'], trigger: 'flammable', text: 'Suitable extinguishers: foam, CO₂, dry powder. Cool surrounding containers with water spray.' },
  { hCodes: OXIDISING, pictograms: ['oxidising'], trigger: 'oxidising', text: 'Oxidiser — use copious water spray; do NOT use foam (foam can fuel the fire).' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'Do NOT use water. Use dry powder or sand only.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric / self-heating', text: 'Use dry powder or sand only; do not use water or CO₂.' },
  { hCodes: PRESSURISED, pictograms: ['compressed-gas'], trigger: 'pressurised cylinder', text: 'Cylinder fire — evacuate; cool cylinders from a safe distance; do not approach.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Combustion may produce toxic fumes — full BA required; evacuate downwind.' },
  { hCodes: AQUATIC, trigger: 'aquatic hazard', text: 'Bund firefighting run-off; prevent release to drains and watercourses.' },
];

const WASTE: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Explosive waste — DO NOT place in normal hazardous waste stream; arrange specialist disposal via licensed contractor.' },
  { hCodes: CMR, trigger: 'CMR', text: 'CMR waste — segregate, label clearly with H-code, dispose via licensed hazardous waste contractor.' },
  { hCodes: AQUATIC, pictograms: ['environmental'], trigger: 'aquatic hazard', text: 'Aquatic hazard waste — segregate; do not dispose to drain; collect in sealed bunded container.' },
  { hCodes: FLAMMABLE, trigger: 'flammable', text: 'Segregate halogenated and non-halogenated solvent waste per local protocol; sealed labelled containers.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Toxic waste — collect in sealed, clearly labelled container for licensed disposal.' },
  { hCodes: [...SKIN_CORR, ...CORROSIVE_METALS], trigger: 'corrosive', text: 'Corrosive waste — neutralise where safe to do so; otherwise collect in compatible container for licensed disposal.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric / self-heating', text: 'Pyrophoric waste — quench under inert conditions before disposal; collect in sealed container under inert gas.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'Water-reactive waste — keep dry until disposal; do not mix with aqueous waste streams.' },
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
  groups: Set<StorageGroup>;
}

type StorageGroup =
  | 'group1Flammable'
  | 'group2VolatilePoison'
  | 'group3OxidisingAcid'
  | 'group4NonOxidisingAcid'
  | 'group5LiquidBase'
  | 'group6OxidiserPeroxide'
  | 'group7Poison'
  | 'group9DrySolid'
  | 'waterReactive'
  | 'pyrophoric'
  | 'cyanide'
  | 'sulfide';

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

const hasAny = (set: Set<string>, values: string[]) => values.some((v) => set.has(v));

function profileFor(c: Substance): ChemicalProfile {
  const hCodes = new Set(c.hazardStatements.map((h) => h.code));
  const pictograms = new Set(c.ghsPictograms);
  const name = c.name || c.cas || 'Unnamed substance';
  const search = `${c.name} ${c.cas ?? ''}`.toLowerCase();
  const groups = new Set<StorageGroup>();
  const isFlammable = hasAny(hCodes, FLAMMABLE) || pictograms.has('flammable');
  const isOxidiser = hasAny(hCodes, OXIDISING) || pictograms.has('oxidising');
  const isOxidisingAcid = /\b(nitric|sulphuric|sulfuric|perchloric|chromic|phosphoric)\s+acid\b/.test(search);
  const isAcid = /\b(acid|hydrochloric|trifluoroacetic|trichloroacetic|formic|acetic)\b/.test(search);
  const isBase = /\b(hydroxide|ammonia|amine|sodium carbonate|potassium carbonate|base|alkali)\b/.test(search);
  const isHalogenatedSolvent =
    /\b(chloroform|dichloromethane|methylene chloride|carbon tetrachloride|trichloro|tetrachloro|chlorinated solvent|halogenated solvent)\b/.test(search);
  const isVolatilePoison =
    isHalogenatedSolvent || /\b(mercaptoethanol|phenol|formamide)\b/.test(search);
  const isPoison =
    hasAny(hCodes, [...ALL_ACUTE_TOX, ...CMR]) ||
    /\b(cyanide|sulfide|sulphide|acrylamide|ethidium bromide|uncured epoxy)\b/.test(search);

  // FBMH table: when a substance has multiple physical hazards, consider the
  // higher physical hazard. Example given: acetic acid is both corrosive and
  // flammable; the higher physical risk is fire.
  if (hasAny(hCodes, WATER_REACTIVE)) groups.add('waterReactive');
  if (hasAny(hCodes, PYROPHORIC)) groups.add('pyrophoric');
  if (isFlammable) groups.add('group1Flammable');
  if (isVolatilePoison && !isFlammable) groups.add('group2VolatilePoison');
  if (isOxidisingAcid) groups.add('group3OxidisingAcid');
  else if (isAcid && !isFlammable) groups.add('group4NonOxidisingAcid');
  if (isBase && c.form !== 'solid' && c.form !== 'powder') groups.add('group5LiquidBase');
  if ((isOxidiser || /\b(peroxide|peracetic)\b/.test(search) || hasAny(hCodes, ['H240', 'H241', 'H242'])) && !isOxidisingAcid) {
    groups.add('group6OxidiserPeroxide');
  }
  if (isPoison && !isVolatilePoison) groups.add('group7Poison');
  if ((c.form === 'solid' || c.form === 'powder') && groups.size === 0) groups.add('group9DrySolid');
  if (/\bcyanide\b/.test(search)) groups.add('cyanide');
  if (/\b(sulfide|sulphide)\b/.test(search)) groups.add('sulfide');

  return { id: c.id, name, search, hCodes, pictograms, groups };
}

const names = (profiles: ChemicalProfile[]) =>
  profiles.map((p) => p.name).filter(Boolean).slice(0, 4).join(', ');

function groupMembers(profiles: ChemicalProfile[], group: StorageGroup) {
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
    `Store explosives/self-reactives (${names(explosive)}) isolated in original packaging, protected from heat, friction and shock; keep only minimum quantities.`,
    'Triggered by explosive/self-reactive H-codes.',
  );

  const flammableGas = profiles.filter((p) => profileHasAny(p, FLAMMABLE_GAS));
  pushStorageSuggestion(
    out,
    seen,
    flammableGas,
    `Store flammable gases (${names(flammableGas)}) in a ventilated cylinder store, upright and secured, away from oxidising gases and ignition sources.`,
    'Triggered by H220/H221 flammable gas classification.',
  );

  const pressurised = profiles.filter((p) => profileHasAny(p, PRESSURISED) || p.pictograms.has('compressed-gas'));
  pushStorageSuggestion(
    out,
    seen,
    pressurised,
    `Store pressurised gas containers (${names(pressurised)}) upright, secured, ventilated and away from heat.`,
    'Triggered by compressed-gas pictogram or H229/H280/H281.',
  );

  const group1 = groupMembers(profiles, 'group1Flammable');
  pushStorageSuggestion(
    out,
    seen,
    group1,
    `Store flammables/combustibles (${names(group1)}) in a clearly labelled fire-resistant metal flammables cabinet, or an explosion-proof fridge if temperature-controlled storage is required. Do not keep cardboard or other combustible packaging in the cabinet.`,
    fbmh('Group 1: flammables and combustibles'),
  );

  const group2 = groupMembers(profiles, 'group2VolatilePoison');
  pushStorageSuggestion(
    out,
    seen,
    group2,
    `Store volatile poisons/halogenated solvents (${names(group2)}) separately in a ventilated cabinet where practicable. If a flammables cabinet is used, keep bases out and separate by shelf/secondary containment.`,
    fbmh('Group 2: volatile poisons, halogenated/chlorinated solvents'),
  );

  const group3 = groupMembers(profiles, 'group3OxidisingAcid');
  pushStorageSuggestion(
    out,
    seen,
    group3,
    `Store oxidising inorganic acids (${names(group3)}) in a clearly labelled corrosives cabinet under the fume hood, in secondary containment. Keep oxidising acids isolated from other storage groups.`,
    fbmh('Group 3: oxidising inorganic acids'),
  );

  const group4 = groupMembers(profiles, 'group4NonOxidisingAcid');
  pushStorageSuggestion(
    out,
    seen,
    group4,
    `Store non-oxidising organic/mineral acids (${names(group4)}) in a clearly labelled corrosives cabinet, preferably under the fume hood, with compatible secondary containment.`,
    fbmh('Group 4: non-oxidising organic and mineral acids'),
  );

  const group5 = groupMembers(profiles, 'group5LiquidBase');
  pushStorageSuggestion(
    out,
    seen,
    group5,
    `Store liquid bases (${names(group5)}) in a clearly labelled corrosives cabinet with compatible secondary containment.`,
    fbmh('Group 5: liquid bases'),
  );

  const group6 = groupMembers(profiles, 'group6OxidiserPeroxide');
  pushStorageSuggestion(
    out,
    seen,
    group6,
    `Store oxidisers/organic peroxides (${names(group6)}) isolated from other storage groups. If stored near other chemicals, keep in a separate tray, tub or secondary container.`,
    fbmh('Group 6: oxidizers / organic peroxides; compatible storage groups: none'),
  );

  const group7 = groupMembers(profiles, 'group7Poison');
  pushStorageSuggestion(
    out,
    seen,
    group7,
    `Store non-volatile poisons/toxins (${names(group7)}) in a lockable toxins cabinet with waterproof secondary containment; keep liquid poisons below cyanide- or sulfide-containing solids.`,
    fbmh('Group 7: non-volatile liquid and dry poisons'),
  );

  const group9 = groupMembers(profiles, 'group9DrySolid');
  pushStorageSuggestion(
    out,
    seen,
    group9,
    `Store dry solids/powders (${names(group9)}) in a cabinet or on open shelving below eye height; keep powders above liquids and protected from liquid spills.`,
    fbmh('Group 9: dry solids'),
  );

  const waterReactive = groupMembers(profiles, 'waterReactive');
  pushStorageSuggestion(
    out,
    seen,
    waterReactive,
    `Store water-reactive substances (${names(waterReactive)}) dry, sealed and physically segregated from water, aqueous solutions, acids, bases and alcohols.`,
    'Triggered by H260/H261 water-reactive classification; check SDS sections 7 and 10.',
  );

  const pyrophoric = groupMembers(profiles, 'pyrophoric');
  pushStorageSuggestion(
    out,
    seen,
    pyrophoric,
    `Store pyrophoric/self-heating substances (${names(pyrophoric)}) under inert atmosphere or as specified by the SDS, away from air, water, oxidisers and ignition sources.`,
    'Triggered by pyrophoric/self-heating/self-reactive H-codes; check SDS sections 7 and 10.',
  );

  const aquatic = profiles.filter((p) => profileHasAny(p, AQUATIC) || p.pictograms.has('environmental'));
  pushStorageSuggestion(
    out,
    seen,
    aquatic,
    `Store aquatic/environmental hazards (${names(aquatic)}) in bunded or secondary containment to prevent release to drains or watercourses.`,
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
  pushPairSuggestion(out, seen, group3, group7,
    `Segregate oxidising inorganic acids (${names(group3)}) from poison/toxin storage (${names(group7)}).`,
    fbmh('Group 3 must be isolated from organic poisons'),
  );

  pushPairSuggestion(out, seen, group4, group5,
    `Store non-oxidising organic/mineral acids (${names(group4)}) separately from liquid bases (${names(group5)}).`,
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
