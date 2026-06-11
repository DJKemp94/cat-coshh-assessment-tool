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
  { hCodes: EXPLOSIVE, trigger: 'explosive', text: 'Evacuate and call specialist response for explosive or self-reactive spills. Do not sweep, absorb or disturb unless the SDS and local emergency plan confirm it is safe.' },
  { hCodes: [...SKIN_CORR, ...CORROSIVE_METALS], trigger: 'corrosive', text: 'For corrosive spills, isolate the area, wear suitable chemical PPE, ventilate, contain with compatible absorbent and collect as hazardous waste. Neutralise only where the SDS and local procedure allow.' },
  { hCodes: FLAMMABLE, pictograms: ['flammable'], trigger: 'flammable', text: 'For flammable spills, remove ignition sources if safe, ventilate, prevent spread and collect with compatible non-sparking equipment and inert absorbent.' },
  { hCodes: ALL_ACUTE_TOX, trigger: 'acute toxicity', text: 'For toxic spills, keep people away, escalate to trained responders and follow the SDS spill procedure, including any respiratory protection or evacuation requirements.' },
  { hCodes: AQUATIC, pictograms: ['environmental'], trigger: 'aquatic hazard', text: 'Prevent spills entering drains or watercourses. Bund, absorb or contain the release and escalate under the local environmental procedure.' },
  { hCodes: WATER_REACTIVE, trigger: 'water-reactive', text: 'For water-reactive spills, keep dry, isolate from water and aqueous materials, ventilate if safe and follow the SDS for compatible absorbents.' },
  { hCodes: PYROPHORIC, trigger: 'pyrophoric', text: 'For pyrophoric or self-heating spills, isolate from air, water and ignition sources; use only SDS-approved inert media and call trained responders.' },
  { hCodes: OXIDISING, trigger: 'oxidising', text: 'For oxidiser spills, keep away from combustible materials and use only compatible inert absorbents or clean-up media specified by the SDS.' },
  { hCodes: RESP_SENS, trigger: 'respiratory sensitiser', text: 'For respiratory sensitiser spills, prevent inhalation exposure, ventilate or evacuate as appropriate and allow re-entry only after controls are confirmed effective.' },
  { hCodes: PRESSURISED, pictograms: ['compressed-gas'], trigger: 'gas under pressure', text: 'For a gas leak or cylinder release, evacuate the area, isolate the supply only if safe, ventilate and do not re-enter until the atmosphere is confirmed safe. Beware of oxygen depletion in enclosed or poorly ventilated spaces.' },
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
  { hCodes: PRESSURISED, pictograms: ['compressed-gas'], trigger: 'gas under pressure', text: 'Suspected asphyxiation from gas release: do not enter the area to rescue unless it is confirmed safe; move the person to fresh air, call for emergency medical help and give the SDS details to responders.' },
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
