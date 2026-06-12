import {
  Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, ChevronUp, ExternalLink,
  AlertCircle, FlaskConical, Wand2, Loader2, CheckCircle2, Copy, MoreVertical,
  GripVertical, Wind, Package, Hand, Glasses, Shirt,
  Shield, Footprints, Info, CircleCheck, X,
} from 'lucide-react';
import { useMemo, useState, useRef, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PageIntro } from '@/components/common/PageIntro';
import { GhsRow, GhsIcon, GHS_LABELS } from '@/components/common/GhsPictograms';
import { ChemicalAutocomplete } from '@/components/common/ChemicalAutocomplete';
import { lookupChemical } from '@/services/pubchem';
import { volatilityFromBP } from '@/services/coshhEssentials';
import { extractChemicals, ExtractMatch } from '@/services/extractChemicals';
import { GHS_HAZARD_STATEMENTS, findHazardStatement } from '@/data/ghsHazardStatements';
import {
  diffPubChemHazards,
  hazardSourceAfterEdit,
  hCodeKey,
  pubChemHazardSource,
  uniqueHCodes,
  uniquePictograms,
} from '@/services/hazardEdits';
import {
  Substance, SubstanceForm, ExposureRoutes, ProcessStep, HCode, GhsPictogram,
  StepControls, isChemicalIncomplete,
} from '@/types/assessment';

const FORMS: SubstanceForm[] = [
  'solid', 'liquid', 'gas', 'other',
];

function simplifiedForm(form: SubstanceForm | '' | undefined): SubstanceForm | '' {
  if (!form) return '';
  if (form === 'powder') return 'solid';
  if (form === 'vapour' || form === 'aerosol' || form === 'mist') return 'gas';
  if (form === 'solid' || form === 'liquid' || form === 'gas') return form;
  return 'other';
}

const ROUTES: { key: keyof ExposureRoutes; label: string }[] = [
  { key: 'inhalation', label: 'Inhalation' },
  { key: 'skin', label: 'Skin' },
  { key: 'ingestion', label: 'Ingestion' },
  { key: 'eye', label: 'Eye' },
  { key: 'none', label: 'None' },
];

// "None" (non-hazardous substance) is mutually exclusive with the real routes.
function toggledExposureRoutes(routes: ExposureRoutes, key: keyof ExposureRoutes): ExposureRoutes {
  if (key === 'none') {
    return { inhalation: false, skin: false, ingestion: false, eye: false, none: !routes.none };
  }
  return { ...routes, [key]: !routes[key], none: false };
}

const GHS_PICKER: GhsPictogram[] = [
  'explosive',
  'flammable',
  'oxidising',
  'compressed-gas',
  'corrosive',
  'toxic',
  'harmful',
  'health-hazard',
  'environmental',
];

const ENGINEERING_CONTROLS = [
  { id: 'Fume hood', label: 'Fume hood', Icon: Wind },
  { id: 'Glove box', label: 'Glove box', Icon: Package },
  { id: 'Inert atmosphere', label: 'Inert atmosphere', Icon: FlaskConical },
  { id: 'None', label: 'None', Icon: X },
];

const PPE_CONTROLS = [
  { id: 'Gloves', label: 'Gloves', Icon: Hand },
  { id: 'Goggles', label: 'Goggles', Icon: Glasses },
  { id: 'Lab coat', label: 'Lab coat', Icon: Shirt },
  { id: 'Face shield', label: 'Face shield', Icon: Shield },
  { id: 'Respirator', label: 'Respirator', Icon: Shield },
  { id: 'Safety footwear', label: 'Safety footwear', Icon: Footprints },
  { id: 'None', label: 'None', Icon: X },
];

const Req = () => <span className="text-red-600 ml-0.5" aria-label="required">*</span>;

function formatAutoVolatility(bpC: number): string {
  if (bpC > 150) return 'low';
  if (bpC >= 50) return 'medium';
  return 'high';
}

const UNITS_BY_FORM: Record<SubstanceForm, readonly string[]> = {
  liquid:  ['mL', 'L', 'µL'],
  gas:     ['L', 'm³', 'mL'],
  vapour:  ['L', 'm³', 'mL'],
  aerosol: ['mL', 'L', 'g'],
  mist:    ['mL', 'L'],
  solid:   ['g', 'kg', 'mg'],
  powder:  ['g', 'kg', 'mg'],
  other:   ['g', 'mL', 'L', 'kg'],
};

function defaultUnit(form: SubstanceForm | ''): string {
  return form ? UNITS_BY_FORM[form][0] : '';
}

function splitQuantity(raw: string): { value: string; unit: string } {
  const m = raw.trim().match(/^([0-9.,\s]*)\s*(.*)$/);
  return { value: (m?.[1] ?? '').trim(), unit: (m?.[2] ?? '').trim() };
}

function joinQuantity(value: string, unit: string): string {
  const v = value.trim();
  if (!v) return '';
  return unit ? `${v} ${unit}` : v;
}

const CONNECTOR_WORDS = new Set([
  'and', 'or', 'with', 'in', 'into', 'to', 'from', 'for', 'of', 'the', 'a', 'an',
  'then', 'after', 'before', 'followed', 'using', 'use', 'add', 'adding',
]);

const DESCRIPTOR_WORDS = new Set([
  'metal', 'powder', 'solid', 'liquid', 'gas', 'solution', 'aqueous', 'anhydrous',
  'buffer', 'mixture', 'slurry', 'suspension', 'pellets', 'granules', 'crystals',
  'reagent', 'sample',
]);

const BREAK_WORDS = new Set([...CONNECTOR_WORDS, ...DESCRIPTOR_WORDS]);

// Suffixes typical of chemical nomenclature (glycinate, chloride, peroxide,
// nitrite, ethanol, dodecyl, heptahydrate, ...). A following word must look
// chemical before it is allowed to extend a matched name into a phrase, so
// "magnesium glycinate" is offered but "magnesium stirrer bar" is not.
const CHEMICAL_WORD_RE =
  /(ate|ide|ite|ol|ine|ane|ene|yne|yl|amine|amide|oxide|acid|ose|ium|hydrate)s?$/;

function looksChemicalWord(word: string): boolean {
  if (word.length < 4 || BREAK_WORDS.has(word)) return false;
  return CHEMICAL_WORD_RE.test(word);
}

function expandedChemicalPhrases(text: string, matches: ExtractMatch[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const tokens = text
    .toLowerCase()
    .replace(/[\n;,]+/g, ' ; ')
    .replace(/[.]+/g, ' . ')
    .split(/\s+/)
    .filter(Boolean);

  for (const match of matches) {
    const term = match.matchedTerm.trim();
    if (term.split(/\s+/).length > 1) continue;
    const termKey = term.toLowerCase();

    tokens.forEach((token, index) => {
      if (token !== termKey) return;
      const words: string[] = [];
      for (const word of tokens.slice(index + 1, index + 4)) {
        if (!looksChemicalWord(word)) break;
        words.push(word);
      }
      if (words.length === 0) return;

      // Offer only the longest gated phrase: intermediate prefixes such as
      // "sodium dodecyl" (from "sodium dodecyl sulfate") are rarely compounds.
      const phrase = [term, ...words.slice(0, 3)].join(' ').replace(/\s+/g, ' ');
      const key = phrase.toLowerCase();
      if (phrase.length < 3 || phrase.length > 80 || seen.has(key)) return;
      seen.add(key);
      out.push(phrase);
    });
  }

  return out;
}

function displayChemicalPhrase(phrase: string): string {
  const trimmed = phrase.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

function isUnavailableExposureLimit(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase().replace(/[.\s/]+/g, '') ?? '';
  return !normalized || normalized === 'na' || normalized === '-' || normalized === '—';
}

function collapsedWelSummary(wel: Substance['wel']): { label: 'WEL' | 'STEL'; value: string } | null {
  if (!isUnavailableExposureLimit(wel.twa)) return { label: 'WEL', value: wel.twa!.trim() };
  if (!isUnavailableExposureLimit(wel.stel)) return { label: 'STEL', value: wel.stel!.trim() };
  return null;
}

function splitOtherControls(value: string): string[] {
  const lines = value.split('\n');
  return lines.length > 0 ? lines : [''];
}

function isProcessStepReady(step: ProcessStep): boolean {
  return Boolean(
    step.step.trim() &&
      step.description.trim() &&
      step.exposureDuration.trim() &&
      step.controls?.engineering?.length > 0 &&
      step.controls?.ppe?.length > 0,
  );
}

function processStepMissingItems(step: ProcessStep): string[] {
  const missing: string[] = [];
  if (!step.step.trim()) missing.push('step name');
  if (!step.description.trim()) missing.push('description');
  if (!step.exposureDuration.trim()) missing.push('step duration');
  if (step.chemicals.length === 0) missing.push('at least one chemical');
  else if (step.chemicals.some(isChemicalIncomplete)) missing.push('chemical details');
  if ((step.controls?.engineering?.length ?? 0) === 0) missing.push('engineering controls');
  if ((step.controls?.ppe?.length ?? 0) === 0) missing.push('PPE');
  return missing;
}

function addStepBlockerMessage(step: ProcessStep | undefined, index: number | undefined): string {
  if (!step || index === undefined) return '';
  const missing = processStepMissingItems(step);
  if (missing.length === 0) return '';
  return `Complete step ${index + 1} first: ${missing.join(', ')}.`;
}

export function SubstancesSection() {
  const steps = useAssessment((s) => s.assessment.processSteps);
  const addStep = useAssessment((s) => s.addProcessStep);
  const reorder = useAssessment((s) => s.reorderProcessSteps);
  const canAddStep =
    steps.length === 0 ||
    steps.every(
      (step) =>
        isProcessStepReady(step) &&
        step.chemicals.length > 0 &&
        step.chemicals.every((chemical) => !isChemicalIncomplete(chemical)),
    );
  const blockedStepIndex = steps.findIndex((step) => processStepMissingItems(step).length > 0);
  const addStepBlocker = addStepBlockerMessage(
    blockedStepIndex >= 0 ? steps[blockedStepIndex] : undefined,
    blockedStepIndex >= 0 ? blockedStepIndex : undefined,
  );

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [openStepId, setOpenStepId] = useState<string | null>(null);

  const handleDragStart = (_e: React.DragEvent, index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (_e: React.DragEvent, index: number) => {
    if (dragIndex !== null && dragIndex !== index) {
      reorder(dragIndex, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <section>
      <SectionHeader
        title="Process steps"
        subtitle="Break the activity into repeatable steps, then add the chemicals used in each one. Chemical names in step text can be recognised automatically, and chemicals already added in earlier steps can be reused without re-entering their safety data."
        right={
          <div className="flex flex-col items-end gap-1">
            <button
              className="btn-primary"
              onClick={addStep}
              disabled={!canAddStep}
              title={!canAddStep ? addStepBlocker : undefined}
            >
              <Plus size={14} /> Add step
            </button>
            {!canAddStep && addStepBlocker && (
              <div className="max-w-xs text-right text-[11px] leading-4 text-amber-800">
                {addStepBlocker}
              </div>
            )}
          </div>
        }
      />

      <PageIntro
        body="Use this page to break the job into practical steps, then record the chemicals, quantities, exposure routes, engineering controls and PPE for each step."
        steps={[
          { title: '1. Add the step', body: 'Describe what happens in the order the task is carried out.' },
          { title: '2. Add chemicals', body: 'Enter each chemical used in that step and complete its hazard and exposure details.' },
          { title: '3. Record step controls', body: 'Select the engineering controls and PPE required before the step can be done safely.' },
        ]}
      />

      {steps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-500 flex flex-col items-center gap-2">
          <FlaskConical size={24} className="text-zinc-400" />
          No process steps yet. Add one to begin.
        </div>
      ) : (
        <div className="card overflow-hidden">
          {steps.map((step, idx) => (
            <ProcessStepCard
              key={step.id}
              step={step}
              index={idx}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragging={dragIndex === idx}
              isDragOver={dragOverIndex === idx}
              isOpen={openStepId === step.id}
              onToggleOpen={() => setOpenStepId(openStepId === step.id ? null : step.id)}
              onOpen={() => setOpenStepId(step.id)}
              onClose={() => setOpenStepId(null)}
              onAddStep={addStep}
              canAddStep={canAddStep}
              addStepBlocker={addStepBlocker}
            />
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-white px-4 py-3">
            <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
              <GripVertical size={15} className="text-zinc-400" />
              Drag steps to reorder
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ProcessStepCard({
  step,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDragOver,
  isOpen,
  onToggleOpen,
  onOpen,
  onClose,
  onAddStep,
  canAddStep,
  addStepBlocker,
}: {
  step: ProcessStep;
  index: number;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDragOver: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpen: () => void;
  onClose: () => void;
  onAddStep: () => void;
  canAddStep: boolean;
  addStepBlocker: string;
}) {
  const updateStep = useAssessment((s) => s.updateProcessStep);
  const removeStep = useAssessment((s) => s.removeProcessStep);
  const addChemical = useAssessment((s) => s.addChemical);
  const allSteps = useAssessment((s) => s.assessment.processSteps);
  const [showSuggest, setShowSuggest] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [focusHighlight, setFocusHighlight] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const prevTotalSteps = useRef(allSteps.length);

  // Auto-expand when this step is newly created (added to the end).
  useEffect(() => {
    if (allSteps.length > prevTotalSteps.current && index === allSteps.length - 1) {
      onOpen();
    }
    prevTotalSteps.current = allSteps.length;
  }, [allSteps.length, index, onOpen]);

  useEffect(() => {
    let targetStepId: string | null = null;
    try {
      targetStepId =
        sessionStorage.getItem('labcat.focusProcessStep') ??
        sessionStorage.getItem('cat.focusProcessStep');
    } catch {
      return;
    }
    if (targetStepId !== step.id) return;

    try {
      sessionStorage.removeItem('labcat.focusProcessStep');
      sessionStorage.removeItem('cat.focusProcessStep');
    } catch {
      // Non-critical: the navigation still works without clearing storage.
    }

    onOpen();
    setFocusHighlight(true);
    window.setTimeout(() => setFocusHighlight(false), 1600);
    window.requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [onOpen, step.id]);

  const [showReuse, setShowReuse] = useState(false);
  const [showControlsInfo, setShowControlsInfo] = useState(false);
  const [showDurationInfo, setShowDurationInfo] = useState(false);
  const [openChemIndex, setOpenChemIndex] = useState<number | null>(null);
  const prevChemCount = useRef(step.chemicals.length);

  // When a new chemical is added, expand it; otherwise keep accordion closed by default.
  useEffect(() => {
    if (step.chemicals.length > prevChemCount.current) {
      setOpenChemIndex(step.chemicals.length - 1);
    }
    prevChemCount.current = step.chemicals.length;
  }, [step.chemicals.length]);

  // Build a unique catalogue of chemicals from prior steps for the "copy
  // from previous step" affordance. Deduplicated by CAS/name+CID so adding
  // acetone in step 1 only shows it once even if it appears in step 2.
  const reusableChemicals = useMemo(() => {
    if (index === 0) return [] as { key: string; from: string; chem: Substance }[];
    const seen = new Set<string>();
    const existing = new Set(
      step.chemicals.map((c) => (c.cas ?? c.name).toLowerCase()).filter(Boolean),
    );
    const out: { key: string; from: string; chem: Substance }[] = [];
    for (let i = 0; i < index; i++) {
      const prev = allSteps[i];
      for (const ch of prev.chemicals) {
        const key = (ch.cas ?? `${ch.name}|${ch.pubchemCid ?? ''}`).toLowerCase();
        if (!key || seen.has(key)) continue;
        if (existing.has((ch.cas ?? ch.name).toLowerCase())) continue;
        seen.add(key);
        out.push({ key, from: `Step ${i + 1}`, chem: ch });
      }
    }
    return out;
  }, [allSteps, index, step.chemicals]);

  const incompleteCount = step.chemicals.filter(isChemicalIncomplete).length;
  const missingItemCount = processStepMissingItems(step).length;
  const lastChemicalIncomplete =
    step.chemicals.length > 0 && isChemicalIncomplete(step.chemicals[step.chemicals.length - 1]);
  const addChemicalTitle = lastChemicalIncomplete ? 'Complete the last chemical first' : 'Add a chemical to this step';
  const isStepComplete =
    isProcessStepReady(step) && step.chemicals.length > 0 && incompleteCount === 0;
  const aggregatedPictograms = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof step.chemicals[number]['ghsPictograms'] = [];
    for (const c of step.chemicals) {
      for (const p of c.ghsPictograms) {
        if (!seen.has(p)) { seen.add(p); out.push(p); }
      }
    }
    return out;
  }, [step.chemicals]);

  const suggestions = useMemo<ExtractMatch[]>(() => {
    const searchableText = [step.step, step.description].filter(Boolean).join(' ');
    if (!searchableText.trim()) return [];
    const existing = new Set(
      step.chemicals.map((c) => (c.cas ?? c.name).toLowerCase()).filter(Boolean),
    );
    const localMatches = extractChemicals(searchableText);
    const local = localMatches.filter(
      (m) => !existing.has((m.cas ?? m.name).toLowerCase()),
    );
    const localNames = new Set(local.map((m) => m.name.toLowerCase()));
    const localTerms = new Set(local.map((m) => m.matchedTerm.toLowerCase()));
    const phraseMatches = expandedChemicalPhrases(searchableText, localMatches).map((phrase) => ({
      name: displayChemicalPhrase(phrase),
      cas: undefined,
      matchedTerm: phrase,
    }));
    const filteredPhrases = phraseMatches.filter((m) => {
      const name = m.name.toLowerCase();
      return !(existing.has(name) || localNames.has(name) || localTerms.has(name));
    });
    // Phrases first: "Magnesium glycinate" is the more likely intent than the
    // bare "Magnesium" it was expanded from. Both stay available to click.
    return [
      ...filteredPhrases,
      ...local,
    ];
  }, [step.description, step.step, step.chemicals]);

  const controls: StepControls = {
    ...step.controls,
    engineering: step.controls?.engineering ?? [],
    ppe: step.controls?.ppe ?? [],
    other: step.controls?.other ?? '',
  };
  const updateControls = (patch: Partial<StepControls>) =>
    updateStep(step.id, { controls: { ...controls, ...patch } });
  const toggleControl = (group: 'engineering' | 'ppe', id: string) => {
    const current = controls[group];
    if (id === 'None') {
      updateControls({ [group]: current.includes('None') ? [] : ['None'] });
      return;
    }
    updateControls({
      [group]: current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current.filter((item) => item !== 'None'), id],
    });
  };
  const controlsMissing = {
    engineering: controls.engineering.length === 0,
    ppe: controls.ppe.length === 0,
  };
  const otherControlLines = splitOtherControls(controls.other);
  const updateOtherControlLine = (lineIndex: number, value: string) => {
    const next = [...otherControlLines];
    next[lineIndex] = value;
    updateControls({ other: next.join('\n') });
  };
  const addOtherControlLine = () => {
    updateControls({ other: [...otherControlLines, ''].join('\n') });
  };
  const removeOtherControlLine = (lineIndex: number) => {
    if (otherControlLines.length === 1) {
      updateControls({ other: '' });
      return;
    }
    updateControls({ other: otherControlLines.filter((_, idx) => idx !== lineIndex).join('\n') });
  };

  const addSuggested = async (m: ExtractMatch) => {
    const key = (m.cas ?? m.name).toLowerCase();
    setAdding(key);
    try {
      const r = await lookupChemical(m.cas ?? m.name);
      addChemical(step.id, {
        pubchemCid: r.cid,
        cas: r.cas ?? m.cas,
        casNotApplicable: false,
        name: r.name,
        hazardStatements: r.hazardStatements,
        ghsPictograms: r.pictograms,
        hazardSource: pubChemHazardSource(r.cid, r.fetchedAt, r.hazardStatements, r.pictograms),
        wel: {
          twa: r.wel.twa ?? 'n/a',
          stel: r.wel.stel ?? 'n/a',
          source: r.wel.source ?? 'Manual',
        },
        form: simplifiedForm(r.pubchemPhysicalForm ?? r.form),
        sdsUrl: r.sdsUrl,
        sdsSource: r.sdsSource,
        boilingPointC: r.boilingPointC,
        flashPointC: r.flashPointC,
        vapourPressureKPa: r.vapourPressureKPa,
        phValue: r.phValue,
        pubchemPhysicalForm: r.pubchemPhysicalForm,
        pubchemPhysicalDescription: r.pubchemPhysicalDescription,
        pubchemNfpa: r.pubchemNfpa,
        molecularFormula: r.molecularFormula,
        canonicalSmiles: r.canonicalSmiles,
        connectivitySmiles: r.connectivitySmiles,
        isomericSmiles: r.isomericSmiles,
        inchi: r.inchi,
        iupacName: r.iupacName,
        pubchemTitle: r.title,
        xlogp: r.xlogp,
        pubchemFetchedAt: r.fetchedAt,
      });
    } catch {
      // Fallback: PubChem unreachable. Seed the row with the EH40 data so the
      // user can refresh later. Row will remain red-starred until they do.
      addChemical(step.id, { name: m.name, cas: m.cas });
    } finally {
      setAdding(null);
    }
  };

  if (!isOpen) {
    return (
      <div
        ref={rootRef}
        data-process-step-id={step.id}
        className={clsx(
          'border-b border-zinc-200 last:border-b-0 bg-white transition-colors',
          isDragging && 'opacity-50',
          isDragOver && 'border-t-2 border-t-accent-500',
          focusHighlight && 'bg-accent-50/50 ring-2 ring-inset ring-accent-300',
        )}
        draggable
        onDragStart={(e) => onDragStart(e, index)}
        onDragOver={(e) => onDragOver(e, index)}
        onDrop={(e) => onDrop(e, index)}
        onDragEnd={onDragEnd}
      >
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-zinc-50 border-l-4 border-l-accent-600"
        >
          <div
            className={clsx(
              'shrink-0 w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center shadow-soft',
              'bg-accent-600 text-white',
            )}
          >
            {index + 1}
          </div>
          <span className="text-sm font-semibold text-accent-700 truncate">
            {step.step.trim() || <span className="italic text-zinc-400">No description</span>}
          </span>
          <span className="text-sm text-zinc-500">
            {step.chemicals.length} chemical{step.chemicals.length === 1 ? '' : 's'}
          </span>
          {aggregatedPictograms.length > 0 && <GhsRow ids={aggregatedPictograms} size={20} />}
          <div className="flex-1" />
          {isStepComplete ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-emerald-700 text-[11px] font-medium shrink-0">
              <CheckCircle2 size={14} /> Complete
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 text-amber-700 text-[11px] font-medium shrink-0">
              <AlertCircle size={14} />
              {!step.step.trim() || step.chemicals.length === 0
                ? 'Incomplete'
                : `${missingItemCount} to finish`}
            </span>
          )}
          <ChevronDown size={16} className="text-zinc-600 shrink-0" />
          <MoreVertical size={17} className="text-zinc-500 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-process-step-id={step.id}
      className={clsx(
        'border-b border-zinc-200 last:border-b-0 bg-white transition-colors',
        isDragging && 'opacity-50',
        isDragOver && 'border-t-2 border-t-accent-500',
        focusHighlight && 'bg-accent-50/50 ring-2 ring-inset ring-accent-300',
      )}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      <div
        className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-zinc-50 border-l-4 border-l-accent-600"
        onClick={onToggleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleOpen();
          }
        }}
      >
        <div
          className={clsx(
            'shrink-0 w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center shadow-soft',
            'bg-accent-600 text-white',
          )}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-accent-700">
              {step.step.trim() || <span className="italic text-zinc-400">New process step</span>}
            </span>
            <span className="text-sm text-zinc-500">
              {step.chemicals.length} chemical{step.chemicals.length === 1 ? '' : 's'}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              {suggestions.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost text-xs px-2 py-1 text-accent-700 hover:bg-accent-50"
                  onClick={(e) => { e.stopPropagation(); setShowSuggest((v) => !v); }}
                >
                  <Wand2 size={12} />
                  Suggest {suggestions.length} chemical{suggestions.length === 1 ? '' : 's'}
                </button>
              )}
              <button
                type="button"
                className="btn-ghost !px-2 !py-1 text-zinc-600 hover:bg-zinc-100"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                title="Collapse step"
              >
                <ChevronUp size={16} />
              </button>
              <button
                className="btn-ghost text-red-600 hover:bg-red-50 !px-2 !py-1"
                onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                aria-label="Remove step"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-100 bg-white px-4 py-3">
        <div className="mb-1.5 text-sm font-semibold text-zinc-900">Step details</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(12rem,0.6fr)_1fr_minmax(13rem,0.65fr)]">
          <label className="block">
            <span className="field-label">Step name<Req /></span>
            <input
              className={clsx('field-input', !step.step.trim() && 'field-missing')}
              value={step.step}
              onChange={(e) => updateStep(step.id, { step: e.target.value })}
              placeholder="e.g. Reaction"
            />
          </label>
          <label className="block">
            <span className="field-label">Description<Req /></span>
            <textarea
              className={clsx(
                'field-textarea !min-h-[78px] bg-white text-sm',
                !step.description.trim() && 'field-missing',
              )}
              value={step.description ?? ''}
              onChange={(e) => updateStep(step.id, { description: e.target.value })}
              placeholder="e.g. Add slowly with stirring"
            />
          </label>
          <div className="relative">
            <button
              type="button"
              className="absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              onClick={() => setShowDurationInfo((v) => !v)}
              aria-label="Step duration guidance"
              aria-expanded={showDurationInfo}
            >
              <Info size={13} />
            </button>
            {showDurationInfo && (
              <div className="absolute right-0 top-6 z-20 w-72 rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600 shadow-lg">
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  onClick={() => setShowDurationInfo(false)}
                  aria-label="Close step duration guidance"
                >
                  <X size={13} />
                </button>
                Estimate the time someone could be exposed to the chemicals in this step. Focus on
                hands-on time near the experiment, transfer, weighing, sampling or cleanup. Do not
                include unattended waiting time such as refluxing or incubation where nobody is
                near the process.
              </div>
            )}
            <ChipPickerInput
              label="Step duration"
              required
              invalid={!step.exposureDuration.trim()}
              value={step.exposureDuration}
              onChange={(v) => updateStep(step.id, { exposureDuration: v })}
              options={['<1 min', '5 min', '15 min', '30 min', '1h', '2h', '4h', '8h']}
              placeholder="e.g. 30 min"
              gridColumns={4}
            />
          </div>
        </div>
      </div>

      {showSuggest && suggestions.length > 0 && (
        <div className="border-t border-zinc-100 bg-accent-50/40 px-4 py-3">
          <div className="text-[11px] text-zinc-600 mb-2">
            These chemicals best match the description of your task. Select any matches, or manually enter details for chemicals not found below.
          </div>
          {(adding !== null || lastChemicalIncomplete) && (
            <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
              {adding !== null
                ? 'Adding a chemical now. Suggestions are paused until that lookup finishes.'
                : 'Complete the current chemical details before adding another suggested chemical.'}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((m) => {
              const key = (m.cas ?? m.name).toLowerCase();
              const loading = adding === key;
              const disabledReason = adding !== null
                ? loading
                  ? 'Adding this chemical from PubChem'
                  : 'Wait for the current chemical lookup to finish'
                : lastChemicalIncomplete
                  ? 'Complete the current chemical details before adding another suggestion'
                  : m.cas
                    ? `CAS ${m.cas} - adds with PubChem details`
                    : undefined;
              return (
                <button
                  key={(m.cas ?? m.name) + m.matchedTerm}
                  type="button"
                  disabled={adding !== null || lastChemicalIncomplete}
                  onClick={() => addSuggested(m)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-accent-200 text-accent-800 text-xs hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
                  title={disabledReason}
                >
                  {loading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  {m.name}
                  {m.cas && <span className="font-mono text-[10px] text-zinc-500">· {m.cas}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-100 bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <span className="text-sm font-semibold text-zinc-900">
            Chemicals in this step
          </span>
          <div className="flex items-center gap-1">
            {reusableChemicals.length > 0 && (
              <button
                className="btn-ghost text-xs px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                onClick={() => setShowReuse((v) => !v)}
                title="Copy a chemical from an earlier step"
              >
                <Copy size={12} /> Reuse from earlier ({reusableChemicals.length})
              </button>
            )}
            <button
              className="btn-primary text-xs !px-3 !py-1.5 shadow-soft disabled:opacity-40"
              onClick={() => addChemical(step.id)}
              disabled={lastChemicalIncomplete}
              title={addChemicalTitle}
            >
              <Plus size={12} /> Add chemical
            </button>
          </div>
        </div>
        {showReuse && reusableChemicals.length > 0 && (
          <div className="mb-2 rounded-md border border-zinc-200 bg-white p-2">
            <div className="text-[10px] text-zinc-500 mb-1.5">
              Click a chemical to copy it into this step. Quantity, duration and frequency are not copied; set them for this step.
            </div>
            <div className="flex flex-wrap gap-1.5">
              {reusableChemicals.map(({ key, from, chem }) => (
                <button
                  key={key}
                  type="button"
                  disabled={lastChemicalIncomplete}
                  onClick={() => {
                    addChemical(step.id, {
                      pubchemCid: chem.pubchemCid,
                      cas: chem.cas,
                      casNotApplicable: chem.casNotApplicable,
                      name: chem.name,
                      hazardStatements: chem.hazardStatements,
                      ghsPictograms: chem.ghsPictograms,
                      hazardSource: chem.hazardSource,
                      wel: { ...chem.wel },
                      form: chem.form,
                      exposureRoutes: { ...chem.exposureRoutes },
                      sdsUrl: chem.sdsUrl,
                      sdsSource: chem.sdsSource,
                      boilingPointC: chem.boilingPointC,
                      volatility: chem.volatility,
                      dustiness: chem.dustiness,
                      pubchemFetchedAt: chem.pubchemFetchedAt,
                    });
                    setShowReuse(false);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-zinc-200 text-zinc-700 text-xs hover:bg-accent-50 hover:border-accent-200"
                >
                  <Plus size={11} className="text-zinc-400" />
                  {chem.name}
                  {chem.cas && <span className="font-mono text-[10px] text-zinc-500">· {chem.cas}</span>}
                  <span className="text-[10px] text-zinc-400">· {from}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step.chemicals.length === 0 ? (
          <div className="text-xs text-zinc-400 italic px-1 py-2">
            No chemicals added yet. Use "Add chemical" or, if you've described the step above, try
            "Suggest".
          </div>
        ) : (
          <div className="space-y-1.5">
            {step.chemicals.map((c, chemIndex) => (
              <ChemicalRow
                key={c.id}
                stepId={step.id}
                chemical={c}
                index={chemIndex}
                isOpen={chemIndex === openChemIndex}
                onToggle={() =>
                  setOpenChemIndex(chemIndex === openChemIndex ? null : chemIndex)
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 bg-white px-4 py-3">
        <div className="relative mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900">
            Controls required for this step
          </span>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            onClick={() => setShowControlsInfo((v) => !v)}
            aria-label="Controls guidance"
            aria-expanded={showControlsInfo}
          >
            <Info size={14} />
          </button>
          {showControlsInfo && (
            <div className="absolute left-0 top-7 z-20 w-full max-w-md rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-600 shadow-lg">
              <button
                type="button"
                className="absolute right-2 top-2 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => setShowControlsInfo(false)}
                aria-label="Close controls guidance"
              >
                <X size={13} />
              </button>
              Select the engineering controls and PPE that are required for this specific step.
              Use Other control for instructions that are not covered by the buttons, such as
              supervision, restricted access, monitoring, disposal limits or step-specific safe
              working rules.
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div>
              <div className="mb-1.5 text-xs font-semibold text-zinc-600">
                Engineering controls<Req />
              </div>
              <div className={clsx('flex flex-wrap gap-1.5 rounded-md', controlsMissing.engineering && 'field-missing p-2')}>
                {ENGINEERING_CONTROLS.map(({ id, label, Icon }) => (
                  <StepControlToggle
                    key={id}
                    active={controls.engineering.includes(id)}
                    label={label}
                    Icon={Icon}
                    onClick={() => toggleControl('engineering', id)}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-semibold text-zinc-600">
                PPE<Req />
              </div>
              <div className={clsx('flex flex-wrap gap-1.5 rounded-md', controlsMissing.ppe && 'field-missing p-2')}>
                {PPE_CONTROLS.map(({ id, label, Icon }) => (
                  <StepControlToggle
                    key={id}
                    active={controls.ppe.includes(id)}
                    label={label}
                    Icon={Icon}
                    onClick={() => toggleControl('ppe', id)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-[12rem_1fr]">
            <div className="pt-2 text-xs font-semibold text-zinc-600">Other controls</div>
            <div className="space-y-2">
              {otherControlLines.map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                >
                  <input
                    className="field-input !py-2 text-sm"
                    value={line}
                    onChange={(e) => updateOtherControlLine(lineIndex, e.target.value)}
                    placeholder="e.g. Use peroxide-tested solvents only"
                    aria-label={`Other control ${lineIndex + 1} for step ${index + 1}`}
                  />
                  <button
                    type="button"
                    className="btn-ghost !px-2 !py-2 text-red-600 hover:bg-red-50"
                    onClick={() => removeOtherControlLine(lineIndex)}
                    aria-label={`Remove other control ${lineIndex + 1}`}
                    title="Remove other control"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost text-xs px-2 py-1 text-accent-700 hover:bg-accent-50"
                onClick={addOtherControlLine}
              >
                <Plus size={12} /> Add another control
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2">
        <div className="text-xs text-amber-800">
          {!canAddStep && (addStepBlocker || 'Complete this step before adding the next one.')}
        </div>
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={onAddStep}
          disabled={!canAddStep}
          title={!canAddStep ? addStepBlocker : undefined}
        >
          <Plus size={13} /> Add step
        </button>
      </div>

    </div>
  );
}

function StepControlToggle({
  active,
  label,
  Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex h-8 min-w-[7.25rem] items-center justify-between gap-1.5 rounded-md border px-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2',
        active
          ? 'border-accent-700 bg-accent-600 text-white shadow-soft'
          : 'border-zinc-200 bg-white text-zinc-600 hover:border-accent-200 hover:bg-accent-50 hover:text-accent-800',
      )}
      aria-pressed={active}
    >
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Icon size={14} className={active ? 'text-white' : 'text-zinc-500'} />
        <span className="truncate">{label}</span>
      </span>
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        {active && <CircleCheck size={13} className="text-white" />}
      </span>
    </button>
  );
}

function ChemicalRow({
  stepId,
  chemical: c,
  index,
  isOpen,
  onToggle,
}: {
  stepId: string;
  chemical: Substance;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const update = useAssessment((st) => st.updateChemical);
  const remove = useAssessment((st) => st.removeChemical);
  const incomplete = isChemicalIncomplete(c);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchWarning, setMatchWarning] = useState<string | null>(null);
  const [hCodeQuery, setHCodeQuery] = useState('');
  const [showHazardEditor, setShowHazardEditor] = useState(false);

  const onChange = (patch: Partial<Substance>) => update(stepId, c.id, patch);
  const welSummary = collapsedWelSummary(c.wel);
  const hazardDiff = diffPubChemHazards(c);

  const updateHazards = (hazardStatements: HCode[], ghsPictograms: GhsPictogram[]) => {
    const nextHCodes = uniqueHCodes(hazardStatements);
    const nextPictograms = uniquePictograms(ghsPictograms);
    onChange({
      hazardStatements: nextHCodes,
      ghsPictograms: nextPictograms,
      hazardSource: hazardSourceAfterEdit(c, nextHCodes, nextPictograms),
    });
  };

  const togglePictogram = (id: GhsPictogram) => {
    updateHazards(
      c.hazardStatements,
      c.ghsPictograms.includes(id)
        ? c.ghsPictograms.filter((p) => p !== id)
        : [...c.ghsPictograms, id],
    );
  };

  const addHCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const known = findHazardStatement(trimmed);
    const next = known ?? { code: trimmed.toUpperCase(), text: '' };
    if (c.hazardStatements.some((h) => hCodeKey(h.code) === hCodeKey(next.code))) return;
    updateHazards([...c.hazardStatements, next], c.ghsPictograms);
  };

  const removeHCode = (code: string) => {
    updateHazards(c.hazardStatements.filter((h) => hCodeKey(h.code) !== hCodeKey(code)), c.ghsPictograms);
  };

  const lookup = async (force = false, override?: string | number) => {
    const query = typeof override === 'number' ? override : (override ?? (c.name || (c.cas ?? ''))).trim();
    if (!query) { setError('Enter a chemical name or CAS number first.'); return; }
    setBusy(true); setError(null); setMatchWarning(null);
    try {
      const r = await lookupChemical(query, { force });
      // PubChem's name endpoint matches loosely: a typo can resolve to an
      // unrelated compound. Warn when the result doesn't resemble the query.
      if (typeof query === 'string' && !/^\d{2,7}-\d{2}-\d$/.test(query)) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
        const q = norm(query);
        const candidates = [r.name, r.title, r.iupacName].filter(Boolean) as string[];
        const matches = candidates.some((cand) => {
          const n = norm(cand);
          return n.includes(q) || (q.length >= 3 && q.includes(n));
        });
        if (!matches) {
          setMatchWarning(
            `PubChem matched "${r.name}" for "${query}". Check this is the substance you meant.`,
          );
        }
      }
      const isDifferentChemical = c.pubchemCid !== undefined && r.cid !== c.pubchemCid;
      // When switching to a different compound, clear stale fields from the
      // previous chemical rather than carrying them over. An assessor-chosen
      // state stays authoritative; otherwise adopt the PubChem-reported one.
      const form = isDifferentChemical
        ? simplifiedForm(r.pubchemPhysicalForm)
        : simplifiedForm(c.form || r.pubchemPhysicalForm);
      const bp = r.boilingPointC ?? (isDifferentChemical ? undefined : c.boilingPointC);
      // On a fresh lookup, set volatility from BP for liquids — user can still
      // override afterwards. This keeps the dropdown in sync with the BP shown.
      const derivedVolatility =
        form === 'liquid' && typeof bp === 'number'
          ? volatilityFromBP(bp)
          : isDifferentChemical
            ? undefined
            : c.volatility;
      onChange({
        pubchemCid: r.cid,
        cas: r.cas,
        casNotApplicable: false,
        name: r.name,
        hazardStatements: r.hazardStatements,
        ghsPictograms: r.pictograms,
        hazardSource: pubChemHazardSource(r.cid, r.fetchedAt, r.hazardStatements, r.pictograms),
        wel: {
          twa: r.wel.twa ?? 'n/a',
          stel: r.wel.stel ?? 'n/a',
          source: r.wel.source ?? 'Manual',
        },
        form,
        sdsUrl: r.sdsUrl ?? (isDifferentChemical ? undefined : c.sdsUrl),
        sdsSource: r.sdsSource ?? (isDifferentChemical ? undefined : c.sdsSource),
        boilingPointC: bp,
        flashPointC: r.flashPointC ?? (isDifferentChemical ? undefined : c.flashPointC),
        vapourPressureKPa: r.vapourPressureKPa ?? (isDifferentChemical ? undefined : c.vapourPressureKPa),
        phValue: r.phValue ?? (isDifferentChemical ? undefined : c.phValue),
        pubchemPhysicalForm: r.pubchemPhysicalForm ?? (isDifferentChemical ? undefined : c.pubchemPhysicalForm),
        pubchemPhysicalDescription: r.pubchemPhysicalDescription ?? (isDifferentChemical ? undefined : c.pubchemPhysicalDescription),
        pubchemNfpa: r.pubchemNfpa ?? (isDifferentChemical ? undefined : c.pubchemNfpa),
        molecularFormula: r.molecularFormula ?? (isDifferentChemical ? undefined : c.molecularFormula),
        canonicalSmiles: r.canonicalSmiles ?? (isDifferentChemical ? undefined : c.canonicalSmiles),
        connectivitySmiles: r.connectivitySmiles ?? (isDifferentChemical ? undefined : c.connectivitySmiles),
        isomericSmiles: r.isomericSmiles ?? (isDifferentChemical ? undefined : c.isomericSmiles),
        inchi: r.inchi ?? (isDifferentChemical ? undefined : c.inchi),
        iupacName: r.iupacName ?? (isDifferentChemical ? undefined : c.iupacName),
        pubchemTitle: r.title ?? (isDifferentChemical ? undefined : c.pubchemTitle),
        xlogp: r.xlogp ?? (isDifferentChemical ? undefined : c.xlogp),
        volatility: derivedVolatility,
        dustiness: isDifferentChemical ? undefined : c.dustiness,
        pubchemFetchedAt: r.fetchedAt,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        /failed to fetch|networkerror|load failed/i.test(msg)
          ? 'PubChem could not be reached. Check your connection or enter the details manually.'
          : msg || 'Lookup failed',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={clsx(
        'rounded-md border bg-white',
        isOpen ? 'border-accent-200 ring-1 ring-accent-100' : 'border-zinc-200',
        incomplete && !isOpen && 'border-red-200 bg-red-50/40',
      )}
    >
      <div
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 hover:bg-zinc-50 cursor-pointer xl:grid-cols-[minmax(16rem,1.4fr)_8rem_minmax(8.5rem,0.8fr)_4rem_minmax(10rem,1fr)_3rem_auto]"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="flex min-w-0 items-center gap-2 text-left pointer-events-none"
        >
          <span className="text-zinc-400">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span
            className={clsx(
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
              incomplete ? 'bg-red-500 text-white' : 'bg-accent-600 text-white',
            )}
          >
            {index + 1}
          </span>
          <span className="min-w-0 truncate">
            {incomplete ? (
              <span
                className="text-red-600 font-medium text-sm"
                title="Click to add details"
              >
                {c.name.trim() ? c.name : 'New chemical'}
              </span>
            ) : (
              <span className="text-sm text-accent-700 font-semibold">{c.name}</span>
            )}
          </span>
        </button>

        <span className="hidden text-[11px] text-zinc-500 font-mono xl:block">
          {c.casNotApplicable ? 'CAS N/A' : c.cas || '-'}
        </span>
        <div className="hidden min-h-[22px] min-w-0 items-center overflow-hidden xl:flex">
          {c.ghsPictograms.length > 0 ? (
            <GhsRow ids={c.ghsPictograms} size={22} />
          ) : (
            <span className="text-xs text-zinc-300">-</span>
          )}
        </div>
        <div className="hidden xl:block">
          {c.hazardStatements.length > 0 ? (
            <span className="pill">{c.hazardStatements.length} H</span>
          ) : (
            <span className="text-xs text-zinc-300">-</span>
          )}
        </div>
        <div className="hidden min-w-0 xl:block">
          {welSummary ? (
            <span
              className="pill max-w-full truncate"
              title={c.wel.source ? `Source: ${c.wel.source}` : undefined}
            >
              {welSummary.label} {welSummary.value}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">N/A</span>
          )}
        </div>
        <div className="hidden xl:block">
          {c.sdsUrl ? (
            <a
              href={c.sdsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-accent-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              SDS <ExternalLink size={10} />
            </a>
          ) : (
            <span className="text-xs text-zinc-300">-</span>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:hidden">
          {(c.cas || c.casNotApplicable) && (
            <span className="text-[11px] text-zinc-500 font-mono">
              · {c.casNotApplicable ? 'CAS N/A' : c.cas}
            </span>
          )}
          {c.ghsPictograms.length > 0 && (
            <GhsRow ids={c.ghsPictograms} size={22} />
          )}
          {c.hazardStatements.length > 0 && (
            <span className="pill">{c.hazardStatements.length} H</span>
          )}
          {welSummary ? (
            <span className="pill" title={c.wel.source ? `Source: ${c.wel.source}` : undefined}>
              {welSummary.label} {welSummary.value}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">N/A</span>
          )}
          {c.sdsUrl && (
            <a
              href={c.sdsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-accent-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              SDS <ExternalLink size={10} />
            </a>
          )}
        </div>

        <div className="flex items-center gap-1 justify-self-end">
          <button
            type="button"
            className="text-red-500 hover:bg-red-50 p-1 rounded shrink-0"
            onClick={(e) => { e.stopPropagation(); remove(stepId, c.id); }}
            aria-label="Remove chemical"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isOpen && (() => {
        const miss = {
          name: !c.name.trim(),
          form: !c.form,
          cas: !c.casNotApplicable && !c.cas?.trim(),
          quantity: !splitQuantity(c.quantity).value,
          wel: !c.wel.twa?.trim() && !c.wel.stel?.trim(),
          routes: !Object.values(c.exposureRoutes).some(Boolean),
        };
        const hCodeTerm = hCodeQuery.trim().toLowerCase();
        const selectedHCodes = new Set(c.hazardStatements.map((h) => hCodeKey(h.code)));
        const hCodeMatches = GHS_HAZARD_STATEMENTS.filter((h) => {
          if (selectedHCodes.has(hCodeKey(h.code))) return false;
          if (!hCodeTerm) return true;
          return h.code.toLowerCase().includes(hCodeTerm) || h.text.toLowerCase().includes(hCodeTerm);
        }).slice(0, 8);
        const formValue = simplifiedForm(c.form);
        return (
        <div className="border-t border-zinc-100 px-4 py-3 bg-white">
          <div className="mb-2 text-[11px] text-zinc-500">
            All fields marked <span className="text-red-600">*</span> are required.
          </div>
          {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
          {matchWarning && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mb-2">
              {matchWarning}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <span className="field-label">Chemical name<Req /></span>
              <ChemicalAutocomplete
                value={c.name}
                onChange={(v) => onChange({ name: v })}
                onSelect={(selection) => {
                  onChange({ name: selection.name });
                  lookup(false, selection.cid ?? selection.name);
                }}
                placeholder="e.g. acetone or 67-64-1"
                disabled={busy}
                invalid={miss.name}
              />
            </div>
            <div>
              <span className="field-label">CAS<Req /></span>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                <input
                  className={clsx('field-input font-mono', miss.cas && 'field-missing')}
                  value={c.cas ?? ''}
                  disabled={c.casNotApplicable}
                  onChange={(e) => onChange({ cas: e.target.value, casNotApplicable: false })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder={c.casNotApplicable ? 'N/A' : '67-64-1'}
                />
                <button
                  type="button"
                  className={clsx(
                    'inline-flex h-[42px] items-center justify-center rounded-md border px-3 text-xs font-semibold transition',
                    c.casNotApplicable
                      ? 'border-accent-300 bg-accent-100 text-accent-900'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
                  )}
                  onClick={() => onChange({
                    cas: c.casNotApplicable ? '' : undefined,
                    casNotApplicable: !c.casNotApplicable,
                  })}
                  aria-pressed={Boolean(c.casNotApplicable)}
                >
                  N/A
                </button>
                <button
                  type="button"
                  className="btn-secondary h-[42px] px-3 text-xs"
                  disabled={busy || (!c.name.trim() && !c.cas?.trim())}
                  onClick={() => lookup(true)}
                >
                  <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
                  Lookup
                </button>
              </div>
            </div>

            <label>
              <span className="field-label">Physical state<Req /></span>
              <select
                className={clsx('field-input', miss.form && 'field-missing')}
                value={formValue}
                onChange={(e) => {
                  const nextForm = e.target.value as SubstanceForm;
                  const { value, unit } = splitQuantity(c.quantity);
                  const allowed = UNITS_BY_FORM[nextForm];
                  const nextUnit = allowed.includes(unit) ? unit : defaultUnit(nextForm);
                  onChange({
                    form: nextForm,
                    quantity: joinQuantity(value, nextUnit),
                  });
                }}
              >
                {!c.form && <option value="" disabled>- select -</option>}
                {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>

            {formValue === 'liquid' ? (
              <label>
                <span className="field-label">Volatility <span className="text-zinc-400 font-normal text-[10px]">COSHH</span></span>
                <select
                  className="field-input"
                  value={c.volatility ?? ''}
                  onChange={(e) => onChange({ volatility: (e.target.value || undefined) as Substance['volatility'] })}
                >
                  <option value="">{typeof c.boilingPointC === 'number' ? `Auto from BP (${formatAutoVolatility(c.boilingPointC)})` : '- select -'}</option>
                  <option value="low">{'Low (>150 °C)'}</option>
                  <option value="medium">Medium (50–150 °C)</option>
                  <option value="high">{'High (<50 °C)'}</option>
                </select>
                {typeof c.boilingPointC === 'number' && (
                  <div className="text-[10px] text-zinc-500 mt-0.5">BP ≈ {c.boilingPointC} °C</div>
                )}
              </label>
            ) : (
              <label>
                <span className="field-label">Dustiness <span className="text-zinc-400 font-normal text-[10px]">COSHH</span></span>
                <select
                  className="field-input"
                  value={c.dustiness ?? ''}
                  disabled={formValue !== 'solid'}
                  onChange={(e) => onChange({ dustiness: (e.target.value || undefined) as Substance['dustiness'] })}
                >
                  <option value="">{formValue === 'solid' ? '- select -' : 'Not applicable'}</option>
                  <option value="low">Low (pellet / waxy)</option>
                  <option value="medium">Medium (granular)</option>
                  <option value="high">High (fine powder)</option>
                </select>
              </label>
            )}

            <label>
              <span className="field-label">Quantity<Req /></span>
              <QuantityInput
                value={c.quantity}
                form={formValue}
                onChange={(next) => onChange({ quantity: next })}
                invalid={miss.quantity}
              />
            </label>

            <div>
              <span className="field-label">Exposure routes<Req /></span>
              <div className={clsx('flex min-h-[42px] flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1.5 shadow-soft', miss.routes && 'field-missing')}>
                {ROUTES.map(({ key, label }) => {
                  const on = c.exposureRoutes[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onChange({ exposureRoutes: toggledExposureRoutes(c.exposureRoutes, key) })}
                      className={
                        'px-2.5 py-0.5 rounded-full text-xs border transition ' +
                        (on
                          ? 'bg-accent-100 border-accent-300 text-accent-900'
                          : miss.routes
                            ? 'bg-white border-amber-300 text-zinc-700 hover:bg-accent-50 hover:border-accent-200'
                            : 'bg-white border-zinc-200 text-zinc-600 hover:bg-accent-50 hover:border-accent-200')
                      }
                    >
                      {label}
                    </button>
                  );
                })}
                {miss.routes && (
                  <span className="ml-1 text-[11px] font-medium text-amber-800">
                    Select at least one
                  </span>
                )}
              </div>
            </div>

            <label>
              <span className="field-label">TWA (8 h)<Req /></span>
              <input
                className={clsx('field-input', miss.wel && 'field-missing')}
                value={c.wel.twa ?? ''}
                onChange={(e) => onChange({ wel: { ...c.wel, twa: e.target.value, source: e.target.value && !c.wel.source ? 'Manual' : c.wel.source } })}
                placeholder="value or n/a"
              />
            </label>
            <label>
              <span className="field-label">STEL (15 min)</span>
              <input
                className={clsx('field-input', miss.wel && 'field-missing')}
                value={c.wel.stel ?? ''}
                onChange={(e) => onChange({ wel: { ...c.wel, stel: e.target.value, source: e.target.value && !c.wel.source ? 'Manual' : c.wel.source } })}
                placeholder="value or n/a"
              />
            </label>
          </div>

          <div className="mt-2 rounded border border-zinc-200 bg-white p-2.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Hazard data - {c.ghsPictograms.length} pictogram{c.ghsPictograms.length === 1 ? '' : 's'} · {c.hazardStatements.length} H-code{c.hazardStatements.length === 1 ? '' : 's'}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="btn-secondary text-xs !px-2 !py-1"
                  onClick={() => setShowHazardEditor((v) => !v)}
                >
                  {showHazardEditor ? 'Done editing' : 'Edit hazard data'}
                </button>
              </div>
            </div>
            {!showHazardEditor ? (
              <HazardDisplay
                chemical={c}
                diff={hazardDiff}
                onEdit={() => setShowHazardEditor(true)}
              />
            ) : (
            <div className="space-y-3 rounded-md border border-accent-100 bg-accent-50/30 p-2">
              <div>
                <div className="mb-1.5 text-xs font-semibold text-zinc-600">GHS symbols</div>
                <div className="flex flex-wrap gap-1.5">
                  {GHS_PICKER.map((id) => {
                    const active = c.ghsPictograms.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={clsx(
                          'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition',
                          active
                            ? 'border-accent-300 bg-accent-50 text-accent-900'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-accent-200 hover:bg-accent-50',
                        )}
                        onClick={() => togglePictogram(id)}
                        aria-pressed={active}
                      >
                        <GhsIcon id={id} size={22} />
                        <span>{GHS_LABELS[id]}</span>
                        <HazardSourcePill source={pictogramEditorSourceLabel(c, id, active)} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 text-xs font-semibold text-zinc-600">H-codes</div>
                {c.hazardStatements.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {c.hazardStatements.map((h) => (
                      <span
                        key={h.code}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700"
                        title={h.text}
                      >
                        <span className="font-mono font-semibold text-zinc-900">{h.code}</span>
                        <span className="hidden max-w-[20rem] truncate sm:inline">{h.text}</span>
                        <HazardSourcePill source={hCodeSourceLabel(c, h)} />
                        <button
                          type="button"
                          className="ml-0.5 rounded-full p-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() => removeHCode(h.code)}
                          aria-label={`Remove ${h.code}`}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mb-2 text-xs text-zinc-400">No hazard statements selected</div>
                )}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    className="field-input !py-1.5 text-xs"
                    value={hCodeQuery}
                    onChange={(e) => setHCodeQuery(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addHCode(hCodeQuery);
                        setHCodeQuery('');
                      }
                    }}
                    placeholder="Search or type H-code, e.g. H225"
                  />
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={!hCodeQuery.trim()}
                    onClick={() => {
                      addHCode(hCodeQuery);
                      setHCodeQuery('');
                    }}
                  >
                    <Plus size={12} /> Add code
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {hCodeMatches.map((h) => (
                    <button
                      key={h.code}
                      type="button"
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700 hover:border-accent-200 hover:bg-accent-50"
                      onClick={() => {
                        addHCode(h.code);
                        setHCodeQuery('');
                      }}
                      title={h.text}
                    >
                      <span className="font-mono font-semibold text-zinc-900">{h.code}</span>
                      <span className="max-w-[18rem] truncate">{h.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function baselineHCodeKeys(c: Substance): Set<string> {
  return new Set(
    c.hazardSource?.type === 'pubchem'
      ? c.hazardSource.pubchemBaseline?.hazardStatements.map((h) => hCodeKey(h.code)) ?? []
      : [],
  );
}

function baselinePictograms(c: Substance): Set<GhsPictogram> {
  return new Set(
    c.hazardSource?.type === 'pubchem'
      ? c.hazardSource.pubchemBaseline?.ghsPictograms ?? []
      : [],
  );
}

function hCodeSourceLabel(c: Substance, h: HCode): 'Assessor added' | undefined {
  if (c.hazardSource?.type !== 'pubchem') return undefined;
  return baselineHCodeKeys(c).has(hCodeKey(h.code)) ? undefined : 'Assessor added';
}

function pictogramSourceLabel(c: Substance, id: GhsPictogram): 'Assessor added' | undefined {
  if (c.hazardSource?.type !== 'pubchem') return undefined;
  return baselinePictograms(c).has(id) ? undefined : 'Assessor added';
}

function pictogramEditorSourceLabel(
  c: Substance,
  id: GhsPictogram,
  active: boolean,
): 'Assessor added' | 'Removed from PubChem' | undefined {
  if (c.hazardSource?.type !== 'pubchem') return undefined;
  const fromPubChem = baselinePictograms(c).has(id);
  if (active && !fromPubChem) return 'Assessor added';
  if (!active && fromPubChem) return 'Removed from PubChem';
  return undefined;
}

function HazardSourcePill({
  source,
}: {
  source?: 'Assessor added' | 'Removed from PubChem';
}) {
  if (!source) return null;
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
        'min-w-[4.75rem] items-center justify-center text-center leading-tight',
        source === 'Assessor added' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        source === 'Removed from PubChem' && 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      {source}
    </span>
  );
}

function HazardDisplay({
  chemical,
  diff,
  onEdit,
}: {
  chemical: Substance;
  diff: ReturnType<typeof diffPubChemHazards>;
  onEdit: () => void;
}) {
  const hasCurrent = chemical.ghsPictograms.length > 0 || chemical.hazardStatements.length > 0;
  const hasRemoved = diff.removedHCodes.length > 0 || diff.removedPictograms.length > 0;

  if (!hasCurrent && !hasRemoved) {
    return (
      <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/60 p-3 text-xs text-zinc-500">
        No GHS symbols or H-codes recorded yet.
        <button
          type="button"
          className="ml-2 font-semibold text-accent-700 hover:underline"
          onClick={onEdit}
        >
          Add hazard data
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div>
        <div className="mb-1.5 text-xs font-semibold text-zinc-600">GHS symbols</div>
        {chemical.ghsPictograms.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {chemical.ghsPictograms.map((id) => (
              <div key={id} className="flex w-24 flex-col items-center gap-1 rounded-md border border-zinc-100 bg-white p-1.5">
                <GhsIcon id={id} size={48} />
                <div className="text-center text-[10px] leading-tight text-zinc-600">{GHS_LABELS[id]}</div>
                <HazardSourcePill source={pictogramSourceLabel(chemical, id)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-zinc-400">No GHS symbols selected</div>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-zinc-600">H-codes</div>
        {chemical.hazardStatements.length > 0 ? (
          <ul className="space-y-1">
            {chemical.hazardStatements.map((h) => (
              <li key={h.code} className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-700">
                <span className="font-mono font-semibold text-zinc-900">{h.code}</span>
                <span className="text-zinc-600">{h.text}</span>
                <HazardSourcePill source={hCodeSourceLabel(chemical, h)} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-zinc-400">No hazard statements selected</div>
        )}
      </div>

      {hasRemoved && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          <div className="font-semibold">Removed from PubChem data</div>
          {diff.removedHCodes.length > 0 && (
            <div>H-codes: {diff.removedHCodes.map((h) => h.code).join(', ')}</div>
          )}
          {diff.removedPictograms.length > 0 && (
            <div>GHS symbols: {diff.removedPictograms.map((id) => GHS_LABELS[id]).join(', ')}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ChipPickerInput({
  label,
  required,
  invalid,
  value,
  onChange,
  options,
  placeholder,
  gridColumns,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  gridColumns?: 4;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}{required && <Req />}</span>
      <input
        className={clsx('field-input !py-1.5 text-xs', invalid && 'field-missing')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={`chip-${label}`}
      />
      <div className={clsx('mt-1 gap-1', gridColumns === 4 ? 'grid grid-cols-4' : 'flex flex-wrap')}>
        {options.map((opt) => {
          const active = value.trim().toLowerCase() === opt.toLowerCase();
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={clsx(
                'px-1.5 py-0.5 rounded-full text-[10px] border transition',
                gridColumns === 4 && 'w-full text-center',
                active
                  ? 'bg-accent-100 border-accent-300 text-accent-900'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-accent-50 hover:border-accent-200',
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </label>
  );
}

function QuantityInput({
  value,
  form,
  onChange,
  invalid,
}: {
  value: string;
  form: SubstanceForm | '';
  onChange: (next: string) => void;
  invalid?: boolean;
}) {
  const parsed = splitQuantity(value);
  const allowed = form ? UNITS_BY_FORM[form] : UNITS_BY_FORM.other;
  const unit = parsed.unit && allowed.includes(parsed.unit) ? parsed.unit : defaultUnit(form);
  const customUnit = parsed.unit && !allowed.includes(parsed.unit) ? parsed.unit : null;

  return (
    <div className="flex gap-1">
      <input
        className={clsx('field-input min-w-0 flex-1', invalid && 'field-missing')}
        type="text"
        inputMode="decimal"
        value={parsed.value}
        onChange={(e) => onChange(joinQuantity(e.target.value, unit))}
        placeholder="e.g. 500"
      />
      <select
        className="field-input w-[5.25rem] shrink-0 !pr-6"
        value={unit}
        onChange={(e) => onChange(joinQuantity(parsed.value, e.target.value))}
      >
        {allowed.map((u) => <option key={u} value={u}>{u}</option>)}
        {customUnit && <option value={customUnit}>{customUnit}</option>}
      </select>
    </div>
  );
}
