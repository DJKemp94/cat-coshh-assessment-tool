import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Siren,
  Cross, Droplets, Flame, Trash2, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PageIntro } from '@/components/common/PageIntro';
import { appendUniqueBullet, ChipSuggestion } from '@/components/common/SuggestionChips';
import { SuggestionDisclaimer } from '@/components/common/SuggestionDisclaimer';
import { SuggestionField } from '@/components/common/SuggestionField';
import { suggestRequirements, RequirementField } from '@/services/suggestRequirements';
import { classifyStorageSignals } from '@/services/storageSignals';
import { Substance } from '@/types/assessment';

const BASE_FIRST_AID_CONSIDERATIONS = [
  'Confirm SDS Section 4 is available before work starts; it is the definitive first-aid source for the product.',
  'Confirm where the eyewash, safety shower, first-aid kit, emergency contacts and SDS access point are located.',
  'Check whether any chemical has first-aid exceptions where ordinary water flushing may be inadequate or unsafe.',
];

const BASE_FIRST_AID_SUGGESTIONS: ChipSuggestion[] = [
  { text: 'Use SDS Section 4 as the definitive first-aid instruction. Make sure the SDS can be accessed immediately and sent with the casualty if medical treatment is needed.' },
  { text: 'Eye exposure: flush immediately with gently flowing water for at least 15 minutes, hold eyelids open and remove contact lenses if easy to do without delaying irrigation.' },
  { text: 'Skin exposure: use the safety shower or running water for at least 15 minutes and remove contaminated clothing, shoes and jewellery while flushing.' },
  { text: 'Ingestion: rinse the mouth. Do not induce vomiting unless SDS Section 4 or a medical professional explicitly instructs this.' },
  { text: 'Ensure your own safety, move the person away from exposure if safe, seek urgent first-aid or medical support, and provide the SDS and exposure details.' },
];

const WATER_REACTIVE_FIRST_AID_CODES = ['H260', 'H261'];

const BASE_SPILL_CONSIDERATIONS = [
  'Define the largest spill that trained staff may tackle locally; anything larger should be escalated under the spill plan.',
  'Confirm that local response is limited to small, contained spills where the substance is known and suitable PPE/spill materials are available.',
  'Record the spill plan, SOP or local procedure that gives the detailed cleanup method.',
];

const BASE_SPILL_SUGGESTIONS: ChipSuggestion[] = [
  { text: 'Small, contained spills may be tackled by trained staff only where the substance is known, suitable PPE and spill materials are available, and the local spill procedure confirms it is safe.' },
  { text: 'For larger spills, exposure, vapours, dusts, aerosols, fire or reactivity concerns, drain risk, inadequate equipment, or uncertainty, stop work, isolate the area and escalate under the local spill plan.' },
  { text: 'Follow SDS Section 6 and the local spill response procedure for the detailed clean-up method, compatible absorbents, PPE and waste disposal route.' },
];

const BASE_FIRE_CONSIDERATIONS = [
  'Confirm SDS Section 5 is available before work starts; it gives suitable and unsuitable extinguishing media, fire hazards and firefighter precautions.',
  'Confirm local response is limited to raising the alarm, evacuating and only tackling very small incipient fires where staff are trained and it is safe.',
  'Record the fire plan, SOP or local emergency procedure that gives the detailed fire response method.',
];

const BASE_FIRE_SUGGESTIONS: ChipSuggestion[] = [
  { text: 'If fire occurs, raise the alarm, stop work if safe, evacuate by the nearest safe route and follow the local fire/emergency procedure.' },
  { text: 'Only trained staff may use firefighting equipment, and only for a very small incipient fire where they have a safe escape route and SDS Section 5 confirms the extinguishing media is suitable.' },
  { text: 'For chemical fire, explosion, reactive material, gas cylinder, toxic smoke, unsuitable extinguishing media, run-off risk or uncertainty, evacuate and escalate to emergency responders.' },
  { text: 'Provide emergency responders with SDS Section 5, chemical names, quantities, storage location and any incompatible, reactive, oxidising, flammable or pressurised-container hazards.' },
];

const BASE_WASTE_CONSIDERATIONS = [
  'Which waste streams will be generated: unused chemicals, stock solutions, reaction residues, washings, contaminated solids, sharps, absorbents or empty containers?',
  'Which waste streams must be collected separately because of chemical incompatibility or disposal restrictions, and what does the SDS confirm for each stream?',
  'Are mineral acids, organic acids, alkalis, cyanides, sulphides, oxidisers, reducing agents, halogenated solvents, non-halogenated solvents, pyrophoric/water-reactive substances, heavy metals or iodine-containing mixtures present?',
  'What container material is compatible with each waste stream according to the SDS and local procedure: glass, plastic/HDPE, steel drum, sharps bin or another specified container?',
  'Is the container intact, leak-tight, securely capped, suitable for liquids or solids as applicable, and free from residues that could react with the waste?',
  'What label information is needed on each waste container: contents, major components, concentration or solvent/water content, hazards, date and responsible person or laboratory?',
  'What secondary containment or physical separation is needed while the waste is being filled and before collection?',
  'How will full containers, obsolete chemicals and contaminated solids/sharps be removed promptly through the approved collection route?',
];

const BASE_WASTE_SUGGESTIONS: ChipSuggestion[] = [
  { text: 'Review the SDS before confirming the waste route, segregation requirements, compatible container and any special disposal precautions for each waste stream.' },
  { text: 'Collect each waste stream in a clean, intact, leak-tight container that the SDS and local procedure confirm is compatible with the waste.' },
  { text: 'Keep waste containers closed except when adding waste, store liquid waste in secondary containment, and do not fill liquid waste containers above about three-quarters full.' },
  { text: 'Label each waste container with the contents, major components, concentration or solvent/water content where relevant, hazards, date and responsible person or laboratory. Retain useful original hazard information where the original container is reused, or deface obsolete labels where a container is repurposed.' },
];

export function EmergencySection() {
  const a = useAssessment((s) => s.assessment.emergency);
  const assessment = useAssessment((s) => s.assessment);
  const update = useAssessment((s) => s.updateEmergency);

  const suggestions = useMemo(() => suggestRequirements(assessment), [assessment]);

  const allChems = useMemo(() => {
    const seen = new Set<string>();
    return assessment.processSteps
      .flatMap((st) => st.chemicals)
      .filter((c) => {
        const key = (c.cas ?? c.name).toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [assessment.processSteps]);
  const totalChems = allChems.length;

  const emergencyPrompts = useMemo(
    () => buildEmergencyPrompts(allChems, suggestions),
    [allChems, suggestions],
  );

  const field = (
    key: keyof typeof a,
    suggestionField: RequirementField | null,
    label: string,
    placeholder?: string,
    required?: boolean,
    fieldSuggestions?: ChipSuggestion[],
  ) => {
    const value = a[key] as string;
    return (
      <SuggestionField
        label={label}
        value={value}
        required={required}
        suggestions={fieldSuggestions ?? (suggestionField ? suggestions[suggestionField] ?? [] : [])}
        onAppend={(s) => update({ [key]: appendUniqueBullet(value, s) } as Partial<typeof a>)}
        onChange={(v) => update({ [key]: v } as Partial<typeof a>)}
        placeholder={placeholder}
      />
    );
  };

  return (
    <section>
      <SectionHeader
        title="Emergency Response"
        subtitle={
          totalChems > 0
            ? `Prompts and suggested wording are shown below, with hazard-specific suggestions derived from H-codes and GHS pictograms across the ${totalChems} chemical${totalChems === 1 ? '' : 's'} you've added.`
            : 'Generic prompts and suggested wording are shown below. Add chemicals in Process Steps to include hazard-specific emergency suggestions.'
        }
      />
      <SuggestionDisclaimer />

      <PageIntro
        body="Use this page to record practical emergency instructions for the task. Check the prompts, add any useful suggested wording, and amend it so it matches the SDS, local procedures, quantities and workplace arrangements."
        steps={[
          { title: '1. Review prompts', body: 'Use the prompts to check credible exposure, spill, fire and waste scenarios for the chemicals and quantities used.' },
          { title: '2. Add suggested wording', body: 'Use the suggested responses where helpful, then edit them so they reflect SDS requirements and local emergency arrangements.' },
          { title: '3. Make it actionable', body: 'Record what people must do, what equipment is needed, who to contact and when the situation must be escalated.' },
        ]}
      />

      <div className="space-y-4">
        <Card
          title="Emergency response"
          subtitle="Review prompts, add suggested wording, then tailor each response to the SDS and local procedure."
          icon={<Siren size={20} />}
          iconClass="text-red-500"
          defaultOpen
        >
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <EmergencyPromptRow
              number={1}
              title="First aid"
              hint="Exposure response and medical escalation"
              icon={<Cross size={18} />}
              iconClass="bg-accent-50 text-accent-700 ring-1 ring-accent-100"
              considerationLabel="First-aid prompts"
              considerations={emergencyPrompts.firstAid.considerations}
              field={field(
                'emergencyFirstAid',
                'emergencyFirstAid',
                'First aid',
                'Record first-aid actions for credible exposure routes, when to seek medical advice, what SDS information must go with the person and how exposure incidents are reported.',
                true,
                emergencyPrompts.firstAid.suggestions,
              )}
            />
            <EmergencyPromptRow
              number={2}
              title="Spills"
              hint="Spill control, isolation and clean-up"
              icon={<Droplets size={18} />}
              iconClass="bg-accent-50 text-accent-700 ring-1 ring-accent-100"
              considerationLabel="Spill-response prompts"
              considerations={emergencyPrompts.spills.considerations}
              field={field(
                'emergencySpills',
                'emergencySpills',
                'Spills',
                'Record spill response for foreseeable quantities, including evacuation or isolation, PPE, ventilation, absorbents, drain protection, waste collection and when to escalate.',
                true,
                emergencyPrompts.spills.suggestions,
              )}
            />
            <EmergencyPromptRow
              number={3}
              title="Fire response"
              hint="Fire, reaction and emergency responder information"
              icon={<Flame size={18} />}
              iconClass="bg-accent-50 text-accent-700 ring-1 ring-accent-100"
              considerationLabel="Fire-response prompts"
              considerations={emergencyPrompts.fire.considerations}
              field={field(
                'emergencyFire',
                'emergencyFire',
                'Fire',
                'Record relevant fire hazards, suitable extinguishing media from the SDS, substances that must not contact water, toxic fumes, cylinder risks and run-off control.',
                true,
                emergencyPrompts.fire.suggestions,
              )}
            />
            <EmergencyPromptRow
              number={4}
              title="Waste and disposal"
              hint="Waste streams, segregation and collection route"
              icon={<Trash2 size={18} />}
              iconClass="bg-accent-50 text-accent-700 ring-1 ring-accent-100"
              considerationLabel="Waste prompts"
              considerations={emergencyPrompts.waste.considerations}
              field={field(
                'wasteHandling',
                'wasteHandling',
                'Waste and disposal',
                'Record waste containers, segregation, labelling, incompatible waste streams, temporary storage, collection route and any waste that needs specialist disposal.',
                true,
                emergencyPrompts.waste.suggestions,
              )}
            />
          </div>

          <div className="rounded-md border border-zinc-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900">
                <Sparkles size={16} className="text-accent-700" />
                Other emergency arrangements <span className="text-xs font-normal text-zinc-500">(optional)</span>
              </div>
            </div>
            {field(
              'other',
              null,
              'Other arrangements',
              'Record any site-specific emergency arrangements that do not fit above, such as out-of-hours contacts, specialist responders, shutdown steps or permit conditions.',
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Card({
  title,
  subtitle,
  icon,
  iconClass,
  right,
  defaultOpen,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconClass?: string;
  right?: React.ReactNode;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 text-zinc-600">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {icon && <span className={clsx('shrink-0', iconClass)}>{icon}</span>}
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="font-semibold text-zinc-900">{title}</div>
          {subtitle && <div className="text-xs text-zinc-500">{subtitle}</div>}
        </button>
        {right && <div className="w-full sm:ml-auto sm:w-auto">{right}</div>}
      </div>
      {open && <div className="px-4 pb-4 space-y-4 border-t border-zinc-100">{children}</div>}
    </div>
  );
}

function EmergencyPromptRow({
  number,
  title,
  hint,
  icon,
  iconClass,
  considerationLabel,
  considerations,
  field,
}: {
  number: number;
  title: string;
  hint: string;
  icon: React.ReactNode;
  iconClass: string;
  considerationLabel: string;
  considerations: string[];
  field: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-zinc-200 px-4 py-4 last:border-b-0 xl:grid-cols-[3.5rem_minmax(220px,0.9fr)_minmax(520px,2.4fr)] xl:items-start">
      <div className={clsx('flex h-12 w-12 items-center justify-center rounded-full shadow-soft', iconClass)}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-zinc-900">
          {number}. {title}
          <span className="text-red-600 ml-0.5">*</span>
        </div>
        <div className="mt-1 text-xs text-zinc-500">{hint}</div>
      </div>
      <div className="min-w-0">
        <details className="group mb-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-2.5 py-1.5">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600 marker:text-zinc-400">
            {considerationLabel}
          </summary>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-600">
            {considerations.map((item) => (
              <li key={item} className="grid grid-cols-[0.5rem_1fr] gap-2">
                <span className="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-zinc-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </details>
        {field}
      </div>
    </div>
  );
}

function buildEmergencyPrompts(
  chemicals: Substance[],
  suggestions: Record<RequirementField, ChipSuggestion[]>,
) {
  const chemicalPrompt = chemicalNamesPrompt(chemicals);
  const firstAidPrompts = buildFirstAidPrompts(chemicals);
  const spillPrompts = buildSpillPrompts(chemicals, suggestions.emergencySpills);
  const firePrompts = buildFirePrompts(chemicals, suggestions.emergencyFire);
  const wastePrompts = buildWastePrompts(chemicals);
  return {
    firstAid: {
      considerations: firstAidPrompts.considerations,
      suggestions: firstAidPrompts.suggestions,
    },
    spills: {
      considerations: spillPrompts.considerations,
      suggestions: spillPrompts.suggestions,
    },
    fire: {
      considerations: firePrompts.considerations,
      suggestions: firePrompts.suggestions,
    },
    waste: {
      considerations: wastePrompts.considerations.length > 0
        ? wastePrompts.considerations
        : [
            ...(chemicalPrompt ? [chemicalPrompt] : []),
            ...BASE_WASTE_CONSIDERATIONS,
          ],
      suggestions: wastePrompts.suggestions,
    },
  };
}

function buildWastePrompts(chemicals: Substance[]) {
  if (chemicals.length === 0) {
    return {
      considerations: BASE_WASTE_CONSIDERATIONS,
      suggestions: BASE_WASTE_SUGGESTIONS,
    };
  }

  const profiles = chemicals.map((chemical) => ({
    chemical,
    classification: classifyStorageSignals(chemical),
    text: chemicalSearchText(chemical),
  }));
  const has = (predicate: (profile: typeof profiles[number]) => boolean) =>
    profiles.filter(predicate).map((profile) => profile.chemical);

  const mineralAcids = has((p) => p.classification.traits.acid && p.classification.traits.organic === false);
  const organicAcids = has((p) => p.classification.traits.acid && p.classification.traits.organic === true);
  const acids = has((p) => p.classification.traits.acid);
  const bases = has((p) => p.classification.traits.base);
  const cyanides = has((p) => p.classification.traits.cyanide);
  const sulfides = has((p) => p.classification.traits.sulfide);
  const halogenatedSolvents = has((p) => p.classification.traits.halogenatedSolvent);
  const nonHalogenatedSolvents = has((p) =>
    !p.classification.traits.halogenatedSolvent &&
    p.chemical.form === 'liquid' &&
    p.classification.traits.organic === true &&
    (p.classification.traits.flammable || /\b(solvent|acetone|ethanol|methanol|propanol|toluene|xylene|acetonitrile|ethyl acetate|hexane|pentane)\b/.test(p.text)),
  );
  const oxidisers = has((p) => p.classification.traits.oxidising);
  const reducers = has((p) => /\b(sodium borohydride|lithium aluminium hydride|lithium aluminum hydride|borohydride|hydride|reducing agent)\b/.test(p.text));
  const waterReactive = has((p) => p.classification.traits.waterReactive || p.classification.traits.pyrophoric);
  const heavyMetals = has((p) => /\b(mercury|cadmium|lead|chromium|arsenic|nickel|selenium|antimony|tellurium|thallium|barium)\b/.test(p.text));
  const iodineMixtures = has((p) => /\b(iodine|iodide)\b/.test(p.text));
  const solids = has((p) => p.chemical.form === 'solid' || p.chemical.form === 'powder');

  const considerations = [
    chemicalNamesPrompt(chemicals),
    `Confirm SDS waste and incompatibility information for: ${chemicalList(chemicals)}.`,
    'Identify the separate waste streams needed for the chemicals actually used in this task.',
    'Confirm compatible collection containers, labels, fill limits, secondary containment and collection route for each stream.',
  ].filter(Boolean) as string[];

  const suggestions: ChipSuggestion[] = [...BASE_WASTE_SUGGESTIONS];
  const add = (condition: boolean, text: string) => {
    if (condition) suggestions.push({ text });
  };

  add(
    mineralAcids.length > 0 && organicAcids.length > 0,
    `Collect mineral acid waste (${chemicalList(mineralAcids)}) separately from organic acid waste (${chemicalList(organicAcids)}), and confirm both streams against the SDS.`,
  );
  add(
    acids.length > 0 && bases.length > 0,
    `Collect acid waste (${chemicalList(acids)}) separately from alkali/base waste (${chemicalList(bases)}), using SDS-confirmed compatible containers for each stream.`,
  );
  add(
    acids.length > 0 && cyanides.length > 0,
    `Keep cyanide-containing waste (${chemicalList(cyanides)}) separate from acid waste (${chemicalList(acids)}); confirm the cyanide waste container and disposal route against the SDS before collection.`,
  );
  add(
    acids.length > 0 && sulfides.length > 0,
    `Keep sulphide/sulfide-containing waste (${chemicalList(sulfides)}) separate from acid waste (${chemicalList(acids)}); confirm the waste route against the SDS before collection.`,
  );
  add(
    halogenatedSolvents.length > 0 && nonHalogenatedSolvents.length > 0,
    `Collect halogenated solvent waste (${chemicalList(halogenatedSolvents)}) separately from non-halogenated solvent waste (${chemicalList(nonHalogenatedSolvents)}).`,
  );
  add(
    oxidisers.length > 0 && (nonHalogenatedSolvents.length > 0 || reducers.length > 0 || acids.length > 0),
    `Collect oxidising waste (${chemicalList(oxidisers)}) separately from organic solvent/material waste${reducers.length > 0 ? ` and reducing-agent waste (${chemicalList(reducers)})` : ''}; confirm segregation and container compatibility against the SDS.`,
  );
  add(
    waterReactive.length > 0,
    `Collect water-reactive or pyrophoric waste (${chemicalList(waterReactive)}) as a separate stream using the SDS-approved quench, inerting or containment method before disposal.`,
  );
  add(
    heavyMetals.length > 0 || iodineMixtures.length > 0,
    `Segregate ${heavyMetals.length > 0 ? `heavy-metal waste (${chemicalList(heavyMetals)})` : ''}${heavyMetals.length > 0 && iodineMixtures.length > 0 ? ' and ' : ''}${iodineMixtures.length > 0 ? `iodine-containing waste (${chemicalList(iodineMixtures)})` : ''} into the specific waste stream required by the SDS and local waste procedure.`,
  );
  add(
    solids.length > 0,
    `Collect contaminated solid waste from this task (${chemicalList(solids)}) in the compatible solid-waste stream specified by the SDS/local procedure; do not use solid containers for liquid waste.`,
  );

  return {
    considerations,
    suggestions: mergeSuggestions(suggestions).slice(0, 8),
  };
}

function chemicalSearchText(chemical: Substance) {
  return [
    chemical.name,
    chemical.cas,
    chemical.molecularFormula,
    chemical.canonicalSmiles,
    chemical.connectivitySmiles,
    chemical.isomericSmiles,
    chemical.inchi,
    chemical.iupacName,
    chemical.pubchemTitle,
  ].filter(Boolean).join(' ').toLowerCase();
}

function mergeSuggestions(primary: ChipSuggestion[] = [], fallback: ChipSuggestion[] = []) {
  const seen = new Set<string>();
  const out: ChipSuggestion[] = [];
  for (const suggestion of [...primary, ...fallback]) {
    const key = suggestion.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
  }
  return out;
}

function buildFirstAidPrompts(chemicals: Substance[]) {
  const exceptions = firstAidExceptions(chemicals);
  const considerations = [
    ...BASE_FIRST_AID_CONSIDERATIONS,
    ...exceptions.map((exception) => exception.prompt),
  ];
  const suggestions = mergeSuggestions(
    exceptions.map((exception) => ({ text: exception.suggestion })),
    BASE_FIRST_AID_SUGGESTIONS,
  ).slice(0, 6);
  return { considerations, suggestions };
}

function firstAidExceptions(chemicals: Substance[]) {
  const exceptions: Array<{ prompt: string; suggestion: string }> = [];
  const hydrofluoric = chemicals.filter((chemical) => matchesChemical(chemical, ['hydrofluoric acid', 'hydrogen fluoride'], ['7664-39-3']));
  const waterReactive = chemicals.filter((chemical) =>
    chemical.hazardStatements.some((h) => WATER_REACTIVE_FIRST_AID_CODES.includes(h.code)) ||
    matchesChemical(chemical, ['sodium metal', 'potassium metal', 'lithium metal'], []),
  );
  const phenol = chemicals.filter((chemical) => matchesChemical(chemical, ['phenol', 'carbolic acid'], ['108-95-2']));
  const quicklime = chemicals.filter((chemical) => matchesChemical(chemical, ['quicklime', 'calcium oxide'], ['1305-78-8']));

  if (hydrofluoric.length > 0) {
    exceptions.push({
      prompt: `Hydrofluoric acid exposure (${chemicalList(hydrofluoric)}) needs specific SDS first aid and immediate emergency medical care; standard flushing alone is not enough.`,
      suggestion: `Hydrofluoric acid exposure (${chemicalList(hydrofluoric)}): follow SDS Section 4 immediately, start emergency response, use calcium gluconate gel where required by the local HF procedure, and seek urgent medical care.`,
    });
  }
  if (waterReactive.length > 0) {
    exceptions.push({
      prompt: `Water-reactive chemicals (${chemicalList(waterReactive)}) may make ordinary water flushing unsafe until dry material is removed; check SDS Section 4 before work starts.`,
      suggestion: `Water-reactive chemical exposure (${chemicalList(waterReactive)}): follow SDS Section 4 and the local procedure. Do not apply water to dry reactive material unless the SDS/procedure confirms it is safe; remove dry material first where instructed.`,
    });
  }
  if (phenol.length > 0) {
    exceptions.push({
      prompt: `Phenol exposure (${chemicalList(phenol)}) can require specific decontamination materials; confirm availability before work starts.`,
      suggestion: `Phenol exposure (${chemicalList(phenol)}): follow SDS Section 4 and local procedure, including use of PEG where specified and available. Escalate for urgent medical advice.`,
    });
  }
  if (quicklime.length > 0) {
    exceptions.push({
      prompt: `Quicklime/calcium oxide exposure (${chemicalList(quicklime)}) may require dry particles to be removed before water flushing.`,
      suggestion: `Quicklime/calcium oxide exposure (${chemicalList(quicklime)}): follow SDS Section 4. Brush off dry particles before flushing where instructed, then use high-volume water and seek medical advice.`,
    });
  }
  return exceptions;
}

function chemicalList(chemicals: Substance[]) {
  const names = [...new Set(chemicals.map((chemical) => chemical.name || chemical.cas || 'Unnamed substance'))].slice(0, 4);
  const extra = chemicals.length - names.length;
  return `${names.join(', ')}${extra > 0 ? `, plus ${extra} more` : ''}`;
}

function matchesChemical(chemical: Substance, names: string[], casNumbers: string[]) {
  const name = (chemical.name || chemical.pubchemTitle || chemical.iupacName || '').toLowerCase();
  const cas = chemical.cas?.trim();
  return names.some((candidate) => name.includes(candidate)) || Boolean(cas && casNumbers.includes(cas));
}

function buildSpillPrompts(chemicals: Substance[], hazardSuggestions: ChipSuggestion[] = []) {
  const considerations = [
    ...BASE_SPILL_CONSIDERATIONS,
    ...spillEscalationPrompts(chemicals),
  ];
  const suggestions = mergeSuggestions(
    spillResponseStandardSuggestions(chemicals, hazardSuggestions),
    BASE_SPILL_SUGGESTIONS,
  ).slice(0, 5);
  return { considerations, suggestions };
}

function spillEscalationPrompts(chemicals: Substance[]) {
  if (chemicals.length === 0) return [];
  return [
    `For this task, set clear escalation triggers after checking the SDS for ${spillChemicalList(chemicals)}.`,
    'Escalate if there is exposure, vapour/dust/aerosol release, fire/reactivity concern, drain risk, unknown material, inadequate PPE/equipment, or uncertainty.',
  ];
}

function spillResponseStandardSuggestions(chemicals: Substance[], hazardSuggestions: ChipSuggestion[]) {
  if (chemicals.length === 0) return hazardSuggestions.slice(0, 1);
  return [
    {
      text: `For chemicals used in this task (${spillChemicalList(chemicals)}), local response is limited to small, contained spills only. Follow SDS Section 6 and the local spill plan for the detailed procedure.`,
    },
    {
      text: 'Do not attempt cleanup where respiratory protection, specialist absorbents/neutralisers, drain protection, or emergency response support is required unless this is specifically covered by the spill plan and staff are trained.',
    },
  ];
}

function spillChemicalList(chemicals: Substance[]) {
  const names = [...new Set(chemicals.map((chemical) => chemical.name || chemical.cas || 'Unnamed substance'))].slice(0, 6);
  const extra = chemicals.length - names.length;
  return `${names.join(', ')}${extra > 0 ? `, plus ${extra} more` : ''}`;
}

function buildFirePrompts(chemicals: Substance[], hazardSuggestions: ChipSuggestion[] = []) {
  const considerations = [
    ...BASE_FIRE_CONSIDERATIONS,
    ...fireEscalationPrompts(chemicals),
  ];
  const suggestions = mergeSuggestions(
    fireResponseStandardSuggestions(chemicals, hazardSuggestions),
    BASE_FIRE_SUGGESTIONS,
  ).slice(0, 5);
  return { considerations, suggestions };
}

function fireEscalationPrompts(chemicals: Substance[]) {
  if (chemicals.length === 0) return [];
  return [
    `For this task, check SDS Section 5 for ${spillChemicalList(chemicals)} before confirming any extinguisher or first-response action.`,
    'Escalate where there is chemical fire, reactive or oxidising material, gas cylinder heating, toxic smoke, unsuitable extinguishing media, contaminated run-off, or uncertainty.',
  ];
}

function fireResponseStandardSuggestions(chemicals: Substance[], hazardSuggestions: ChipSuggestion[]) {
  if (chemicals.length === 0) return hazardSuggestions.slice(0, 1);
  return [
    {
      text: `For chemicals used in this task (${spillChemicalList(chemicals)}), follow SDS Section 5 and the local fire/emergency plan for suitable extinguishing media, special hazards and firefighter precautions.`,
    },
    {
      text: 'Local response is limited to raising the alarm, evacuating, and using firefighting equipment only for a very small incipient fire where staff are trained, have a safe escape route, and the SDS confirms the extinguisher is suitable.',
    },
  ];
}

function chemicalNamesPrompt(chemicals: Substance[]) {
  const names = chemicals
    .map((c) => c.name || c.cas || 'Unnamed substance')
    .filter(Boolean)
    .slice(0, 8);
  if (names.length === 0) return '';
  const extra = chemicals.length - names.length;
  return `Chemicals to check against the SDS emergency sections: ${names.join(', ')}${extra > 0 ? `, plus ${extra} more` : ''}.`;
}
