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

const STORAGE: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive (H200–H205, H240/H241)', text: 'Explosive — store isolated in original packaging, kept wetted where applicable; do not co-store with any other material; minimise quantity held.' },
  { hCodes: FLAMMABLE, pictograms: ['flammable'], trigger: 'flammable', text: 'Store in approved flammables cabinet, away from ignition sources and oxidisers.' },
  { hCodes: FLAMMABLE_GAS, trigger: 'flammable gas (H220/H221)', text: 'Flammable gas — store in ventilated cylinder store, segregated from oxidising gases.' },
  { hCodes: PRESSURISED, pictograms: ['compressed-gas'], trigger: 'pressurised gas', text: 'Cylinders stored upright, chained, in a ventilated cylinder store away from heat.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric / self-heating / self-reactive', text: 'Store under inert atmosphere in sealed container, away from oxidisers, heat and ignition sources.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive (H260/H261)', text: 'Water-reactive — store in dry conditions; segregate from water and aqueous solutions.' },
  { hCodes: OXIDISING, pictograms: ['oxidising'], trigger: 'oxidising', text: 'Store oxidisers separately from flammables, organics, reducing agents and combustibles.' },
  { hCodes: SKIN_CORR, trigger: 'skin corrosion (H314)', text: 'Store in corrosives cabinet with bund; eyewash within 10 s travel.' },
  { hCodes: CORROSIVE_METALS, trigger: 'corrosive to metals (H290)', text: 'Use corrosion-resistant containers and shelving; segregate acids and bases.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Store in locked toxics cabinet with restricted access and inventory log.' },
  { hCodes: CMR, trigger: 'CMR (H340/H350/H360/H341/H351/H361)', text: 'CMR substance — store in dedicated CMR cabinet with documented access log and minimum-stock policy.' },
  { hCodes: RESP_SENS, trigger: 'respiratory sensitiser (H334)', text: 'Respiratory sensitiser — restrict access; ensure containment when handled.' },
  { hCodes: TARGET_ORGAN, trigger: 'target organ toxicity (H370–H373)', text: 'Store in toxics cabinet; flag target-organ hazard on container label.' },
  { hCodes: AQUATIC, pictograms: ['environmental'], trigger: 'aquatic hazard', text: 'Store in bunded area to prevent release to drainage and watercourses.' },
];

const INCOMPATIBLES: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Keep away from all combustibles, oxidisers, reducing agents, heat, friction and shock sources.' },
  { pictograms: ['oxidising'], hCodes: OXIDISING, trigger: 'oxidising', text: 'Oxidisers must not co-store with flammables, organics, reducing agents or combustibles.' },
  { hCodes: [...SKIN_CORR, ...CORROSIVE_METALS], trigger: 'acid/base', text: 'Keep acids and bases physically separated; never co-store.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'Must not contact water, aqueous solutions or hydroxides.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric', text: 'Must not contact air; keep away from oxidisers and water.' },
  { hCodes: FLAMMABLE, trigger: 'flammable', text: 'Flammables must be segregated from oxidisers, peroxides and ignition sources.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Toxic substances must not co-store with acids that could liberate toxic gases (e.g. cyanides, sulphides, hypochlorites).' },
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
  return result;
}
