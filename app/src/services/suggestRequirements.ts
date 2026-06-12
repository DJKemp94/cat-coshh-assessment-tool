import { Assessment, Substance, GhsPictogram } from '@/types/assessment';

export type RequirementField =
  | 'emergencySpills'
  | 'emergencyFirstAid'
  | 'emergencyFire'
  | 'wasteHandling';

interface Suggestion {
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

const SPILLS: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Explosive or self-reactive spill ({chemicals}): evacuate, raise the alarm and call specialist responders. Do not sweep, absorb or disturb the material.' },
  { hCodes: [...SKIN_CORR, ...CORROSIVE_METALS], trigger: 'corrosive', text: 'Corrosive spill ({chemicals}): isolate the area, put on chemical-resistant PPE, ventilate, contain with a compatible absorbent and collect as hazardous waste. Do not neutralise unless the SDS and local procedure authorise it.' },
  { hCodes: FLAMMABLE, pictograms: ['flammable'], trigger: 'flammable', text: 'Flammable spill ({chemicals}): remove ignition sources if safe, ventilate, stop the spread and collect with non-sparking tools and inert absorbent.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Toxic spill ({chemicals}): clear everyone from the area and escalate to trained responders. Do not attempt cleanup without the respiratory protection specified in SDS Section 6.' },
  { hCodes: AQUATIC, pictograms: ['environmental'], trigger: 'aquatic hazard', text: 'Environmentally hazardous spill ({chemicals}): block access to drains, bund and absorb the release, and report it under the local environmental procedure.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'Water-reactive spill ({chemicals}): keep the material dry, isolate it from water and aqueous cleaners, and use only the dry absorbents listed in the SDS.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric', text: 'Pyrophoric or self-heating spill ({chemicals}): isolate from air, water and ignition sources and call trained responders. Use only SDS-approved inert media.' },
  { hCodes: OXIDISING, trigger: 'oxidising', text: 'Oxidiser spill ({chemicals}): keep combustible materials away and collect with the inert, compatible media specified in the SDS.' },
  { hCodes: RESP_SENS, trigger: 'respiratory sensitiser', text: 'Respiratory sensitiser spill ({chemicals}): stop inhalation exposure — ventilate or evacuate — and re-enter only once controls are confirmed effective.' },
  { hCodes: PRESSURISED, pictograms: ['compressed-gas'], trigger: 'gas under pressure', text: 'Gas leak or cylinder release ({chemicals}): evacuate, isolate the supply only if safe, and ventilate. Do not re-enter until the atmosphere is confirmed safe — beware oxygen depletion in enclosed spaces.' },
];

const FIRST_AID: Rule[] = [
  { hCodes: SKIN_CORR, trigger: 'skin corrosion (H314)', text: 'Skin contact with {chemicals} (corrosive): remove contaminated clothing and rinse with running water for at least 15 minutes. Get urgent medical attention.' },
  { hCodes: SKIN_IRR, trigger: 'skin irritation (H315)', text: 'Skin contact with {chemicals}: wash with water and remove contaminated clothing. Get medical advice if symptoms persist.' },
  { hCodes: SKIN_SENS, trigger: 'skin sensitiser (H317)', text: 'Skin contact with {chemicals} (sensitiser): wash thoroughly. Report any rash, dermatitis or reaction to Occupational Health.' },
  { hCodes: EYE_DMG, trigger: 'eye damage (H318)', text: 'Eye contact with {chemicals} (serious eye damage): rinse at the eyewash immediately for at least 15 minutes, holding eyelids open. Get urgent medical attention.' },
  { hCodes: EYE_IRR, trigger: 'eye irritation (H319)', text: 'Eye contact with {chemicals}: rinse with water for several minutes, removing contact lenses if easy. Get medical advice if pain or redness persists.' },
  { hCodes: [...ACUTE_TOX_INH, ...RESP_IRR], trigger: 'respiratory hazard', text: 'Inhalation of {chemicals}: move the person to fresh air and keep them at rest. Get medical advice if there are any symptoms.' },
  { hCodes: RESP_SENS, trigger: 'respiratory sensitiser (H334)', text: 'Inhalation of {chemicals} (respiratory sensitiser): move to fresh air. Get medical advice even if the person feels fine — wheeze or asthma symptoms can develop hours later.' },
  { hCodes: CNS_DEPRESS, trigger: 'CNS depressant (H336)', text: 'Drowsiness or dizziness after exposure to {chemicals}: move to fresh air and stay with the person. Get medical advice if symptoms persist.' },
  { hCodes: ACUTE_TOX_ORAL, trigger: 'acute oral toxicity', text: 'Ingestion of {chemicals} (toxic): rinse the mouth. Do not induce vomiting. Get urgent medical help and have the SDS ready.' },
  { hCodes: ASPIRATION, trigger: 'aspiration hazard (H304)', text: 'Ingestion of {chemicals} (aspiration hazard): do not induce vomiting — liquid entering the lungs can cause serious harm. Get urgent medical attention.' },
  { hCodes: ACUTE_TOX_DERMAL, trigger: 'dermal toxicity', text: 'Skin contact with {chemicals} (toxic): remove contaminated clothing and wash the skin thoroughly. Get medical advice.' },
  { hCodes: TARGET_ORGAN, trigger: 'target organ toxicity', text: 'Significant exposure to {chemicals} (target-organ toxicity): arrange a medical or Occupational Health review with the SDS and exposure details.' },
  { hCodes: CMR, trigger: 'CMR', text: 'Exposure to {chemicals} (CMR): record the incident and refer the person to Occupational Health under the local exposure-reporting process.' },
  { hCodes: PRESSURISED, pictograms: ['compressed-gas'], trigger: 'gas under pressure', text: 'Suspected asphyxiation from a gas release ({chemicals}): do not enter the area until it is confirmed safe. Move the person to fresh air, call emergency medical help and give responders the SDS.' },
];

const FIRE: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Fire risk from {chemicals} (explosive/self-reactive): evacuate and keep your distance. Do not fight the fire — tell responders the substance and its location.' },
  { hCodes: FLAMMABLE, pictograms: ['flammable'], trigger: 'flammable', text: 'Fire involving {chemicals} (flammable): use only the extinguishing media listed in SDS Section 5 — do not assume water is safe. Cool exposed containers from a protected position only if safe.' },
  { hCodes: OXIDISING, pictograms: ['oxidising'], trigger: 'oxidising', text: 'Fire involving {chemicals} (oxidiser): expect the fire to intensify. Keep combustibles clear and use only SDS-approved firefighting media.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'Fire involving {chemicals} (water-reactive): do not use water. Use the compatible dry media specified in SDS Section 5.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric / self-heating', text: 'Fire involving {chemicals} (pyrophoric/self-heating): evacuate and use only SDS-approved extinguishing media. Do not use water.' },
  { hCodes: PRESSURISED, pictograms: ['compressed-gas'], trigger: 'pressurised cylinder', text: 'Cylinders or pressurised containers ({chemicals}) exposed to heat or fire: evacuate and keep your distance. Cool from a protected position only if safe.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Fire involving {chemicals} (toxic): expect harmful fumes. Evacuate affected areas and give responders the SDS.' },
  { hCodes: AQUATIC, trigger: 'aquatic hazard', text: 'Fire involving {chemicals} (environmental hazard): contain firefighting run-off and keep it out of drains and watercourses.' },
];

const WASTE: Rule[] = [
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Explosive or self-reactive waste ({chemicals}): never place in routine waste streams — arrange specialist disposal through the approved hazardous-waste route.' },
  { hCodes: CMR, trigger: 'CMR', text: 'CMR waste ({chemicals}): segregate, label clearly and dispose of it through the approved hazardous-waste route.' },
  { hCodes: AQUATIC, pictograms: ['environmental'], trigger: 'aquatic hazard', text: 'Environmentally hazardous waste ({chemicals}): collect in sealed, compatible containers. Never dispose of it to drain.' },
  { hCodes: FLAMMABLE, trigger: 'flammable', text: 'Flammable waste ({chemicals}): collect in sealed, labelled, compatible containers, segregated from other waste streams per the local procedure.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'Toxic waste ({chemicals}): collect in sealed, clearly labelled, compatible containers for approved hazardous-waste disposal.' },
  { hCodes: [...SKIN_CORR, ...CORROSIVE_METALS], trigger: 'corrosive', text: 'Corrosive waste ({chemicals}): collect in compatible containers. Do not neutralise unless the SDS and local procedure authorise it.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric / self-heating', text: 'Pyrophoric or self-heating waste ({chemicals}): quench, inert or contain using the SDS-approved method before disposal.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'Water-reactive waste ({chemicals}): keep dry and segregated from aqueous waste until collected through the approved disposal route.' },
];

const RULESETS: Record<RequirementField, Rule[]> = {
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
      const chemList =
        triggerChems.slice(0, 4).join(', ') +
        (triggerChems.length > 4 ? `, plus ${triggerChems.length - 4} more` : '');
      matched.push({
        // Name the triggering chemicals in the inserted wording itself, so the
        // recorded assessment is specific rather than generic boilerplate.
        text: chemList
          ? r.text.replace('{chemicals}', chemList)
          : r.text.replace(/\s*\(\{chemicals\}\)|\{chemicals\}\s*/g, '').replace(/\s{2,}/g, ' '),
        hint: `Triggered by ${r.trigger}: ${chemList}`,
      });
    }
    result[field] = matched;
  }
  return result;
}
