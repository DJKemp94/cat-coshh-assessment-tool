import { useMemo, useState } from 'react';
import {
  Sparkles, AlertTriangle, ExternalLink, ChevronDown, ChevronRight, Info,
  Ban, BarChart3, FileText, Wind, Stethoscope, CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { appendUnique } from '@/components/common/SuggestionChips';
import { SuggestionField } from '@/components/common/SuggestionField';
import { suggestControls, OverallSuggestion, SubstanceAnalysis, Approach, APPROACH_LABEL } from '@/services/coshhEssentials';
import { ProcessStep } from '@/types/assessment';

const ELIM_SUB_SUGGESTIONS = [
  'Elimination considered; the substance is required for this activity.',
  'No suitable lower-hazard substitute has been identified for this task.',
  'Use the lowest practicable concentration, hazard grade and working quantity.',
  'Use a pre-diluted or ready-to-use product where this would reduce handling risk.',
];

const REDUCTION_SUGGESTIONS = [
  'Keep only the minimum effective quantity at the work area.',
  'Limit the number of people, frequency and duration of exposure.',
  'Prepare small aliquots instead of handling the parent container where practicable.',
];

const ADMIN_SUGGESTIONS = [
  'Work must follow the approved SOP or safe working procedure.',
  'Users must be briefed on the COSHH assessment before starting work.',
  'Restrict the activity to trained and authorised personnel.',
  'Keep the work area clean; report and clean spills promptly.',
  'Review the assessment if the substance, quantity, frequency, process or controls change.',
];

const AIR_MONITORING_SUGGESTIONS = [
  'Routine air monitoring is not required where exposure is demonstrably low and no WEL concern is identified.',
  'Consider personal exposure monitoring where exposure may approach a WEL or controls are unproven.',
  'Review monitoring needs if quantity, frequency, duration, temperature or control performance changes.',
];

const HEALTH_SURVEILLANCE_SUGGESTIONS = [
  'No routine health surveillance trigger has been identified from the current information.',
  'Refer to Occupational Health where sensitiser, asthmagen, CMR or significant skin exposure concerns apply.',
  'Users must report symptoms, suspected exposure or PPE/control failures promptly.',
];

const append = appendUnique;

const ENGINEERING_LABELS: Record<string, string> = {
  'Fume hood': 'Fume hood',
  'Glove box': 'Glove box',
  'Inert atmosphere': 'Inert atmosphere',
  Other: 'Other',
};

const PPE_LABELS: Record<string, string> = {
  Gloves: 'Gloves',
  Goggles: 'Goggles',
  'Lab coat': 'Lab coat',
  'Face shield': 'Face shield',
  Respirator: 'Respirator',
  'Safety footwear': 'Safety footwear',
};

const APPROACH_COLOR: Record<number, string> = {
  1: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  2: 'bg-amber-50 text-amber-800 border-amber-200',
  3: 'bg-orange-50 text-orange-800 border-orange-200',
  4: 'bg-red-50 text-red-800 border-red-200',
};

const HAZARD_GROUP_HELP = [
  ['A', 'Lower health hazard band: H304, H315, H319, H336 and similar lower-toxicity effects.'],
  ['B', 'Harmful / STOT category 2 band: H302, H312, H332, H371.'],
  ['C', 'Toxic, corrosive, serious eye damage, sensitising skin, respiratory irritation or STOT category 1/2: H301, H311, H314, H317, H318, H331, H335, H370, H373.'],
  ['D', 'Fatal acute toxicity, suspected carcinogen/reproductive toxicant, lactation hazard or repeated-exposure organ damage: H300, H310, H330, H351, H360, H361, H362, H372.'],
  ['E', 'Respiratory sensitiser, mutagen or carcinogen category 1/suspected mutagen: H334, H340, H341, H350. Specialist advice is required.'],
] as const;

const EP_HELP = [
  ['EP1', 'Lowest exposure potential: small amounts with low/medium dustiness, or low-volatility millilitre-scale liquids.'],
  ['EP2', 'Low-to-moderate exposure potential: combinations such as grams of high-dust solids, kg/tonnes of low-dust solids, or millilitres of medium/high-volatility liquids.'],
  ['EP3', 'Moderate-to-high exposure potential: common litre-scale liquid work or kilogram-scale medium/high-dust solid work.'],
  ['EP4', 'Highest exposure potential: cubic metre-scale high-volatility liquids or tonne-scale medium/high-dust solids.'],
] as const;

const APPROACH_HELP = [
  ['1', 'General ventilation and good working practice.'],
  ['2', 'Engineering control, normally local exhaust ventilation or equivalent capture/control.'],
  ['3', 'Containment or enclosure where small breaches may occur.'],
  ['4', 'Specialist advice: the banding screen is not enough to select controls by itself.'],
] as const;

interface ProcessStepReviewItem {
  id: string;
  message: string;
}

function CoshhEssentialsPanel({
  s,
}: {
  s: OverallSuggestion;
}) {
  const [open, setOpen] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  return (
    <div className="card p-4 mb-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-1 flex h-7 w-7 items-center justify-center rounded-md bg-accent-50 text-accent-700">
          <Sparkles size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-center gap-1.5 flex-wrap text-left"
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="font-medium">COSHH Essentials screening</span>
              <span className="text-xs font-normal text-zinc-500">
                Click for substance-level bands, assumptions and guidance sheets.
              </span>
              {(() => {
                const present = [...new Set(s.analyses.map((a) => a.approach))].sort((a, b) => a - b);
                const multiple = present.length > 1;
                return (
                  <span className="inline-flex items-center gap-1 flex-wrap">
                    {present.map((ap) => (
                      <span
                        key={ap}
                        className={clsx(
                          'text-xs px-2 py-0.5 rounded-full border',
                          APPROACH_COLOR[ap],
                        )}
                      >
                        {ap === s.approach
                          ? s.approachLabel + (multiple ? ' · drives' : '')
                          : `Approach ${ap}`}
                      </span>
                    ))}
                    {multiple && (
                      <span className="text-[11px] text-zinc-600">
                        {present.length} approaches across {s.analyses.length} substances
                      </span>
                    )}
                  </span>
                );
              })()}
            </button>
            <button
              type="button"
              onClick={() => setShowGlossary((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-700"
              title="What the values mean"
            >
              <Info size={12} />
            </button>
          </div>

          {showGlossary && (
            <div className="mt-3 rounded-md border border-accent-200 bg-accent-50/60 p-3 text-xs text-zinc-800">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Glossary title="Hazard group" entries={HAZARD_GROUP_HELP as unknown as ReadonlyArray<readonly [string, string]>} keyMin="3.5rem" labelPrefix="Group " />
                <Glossary title="EP band" entries={EP_HELP as unknown as ReadonlyArray<readonly [string, string]>} keyMin="2.5rem" />
                <Glossary title="Approach" entries={APPROACH_HELP as unknown as ReadonlyArray<readonly [string, string]>} keyMin="1.5rem" />
              </div>
              <p className="mt-2 text-zinc-500 italic">
                EP is calculated from amount in use plus dustiness for solids or volatility for liquids.
              </p>
            </div>
          )}

          {open && (
            <div className="mt-3 space-y-3 text-sm">
              {(() => {
                const groups = new Map<Approach, SubstanceAnalysis[]>();
                for (const a of s.analyses) {
                  const list = groups.get(a.approach) ?? [];
                  list.push(a);
                  groups.set(a.approach, list);
                }
                const sortedApproaches = [...groups.keys()].sort((a, b) => b - a) as Approach[];
                return (
                  <div className="space-y-2">
                    {sortedApproaches.map((approach) => {
                      const items = groups.get(approach)!;
                      const isDriving = approach === s.approach;
                      return (
                        <div
                          key={approach}
                          className={clsx(
                            'rounded-md border overflow-hidden',
                            APPROACH_COLOR[approach],
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-current/20">
                            <div className="text-xs font-medium flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-white/60 border border-current/30">
                                Approach {approach}
                              </span>
                              <span>{APPROACH_LABEL(approach).replace(/^Approach \d+ — /, '')}</span>
                              <span className="text-[10px] opacity-70">
                                {items.length} substance{items.length === 1 ? '' : 's'}
                              </span>
                            </div>
                            {isDriving && (
                              <span className="text-[10px] font-medium uppercase tracking-wider">
                                Drives controls
                              </span>
                            )}
                          </div>
                          <table className="w-full text-xs bg-white/60">
                            <thead className="text-zinc-600">
                              <tr>
                                <th className="text-left p-1.5">Substance</th>
                                <th className="text-left p-1.5">Group</th>
                                <th className="text-left p-1.5">H-codes</th>
                                <th className="text-left p-1.5">Scale</th>
                                <th className="text-left p-1.5">Band</th>
                                <th className="text-left p-1.5">EP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((a) => (
                                <tr key={a.substanceId} className="border-t border-zinc-200/60 align-top">
                                  <td className="p-1.5 font-medium text-zinc-900">{a.name}</td>
                                  <td className="p-1.5 text-zinc-700">{a.hazardGroup}</td>
                                  <td className="p-1.5 text-zinc-700">{a.drivingHCodes.join(', ') || '—'}</td>
                                  <td className="p-1.5 text-zinc-700">{a.scale}{a.assumed.scale && ' *'}</td>
                                  <td className="p-1.5 text-zinc-700">
                                    {a.bandKind === 'not-applicable' ? '—' : `${a.band} (${a.bandKind})`}
                                    {a.assumed.band && ' *'}
                                  </td>
                                  <td className="p-1.5 text-zinc-700">{a.exposurePredictor ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                    <div className="text-[10px] text-zinc-500">
                      * assumed value used because input was missing or unparseable.
                      The highest approach across all substances drives the screening result (HSE COSHH Essentials).
                    </div>
                  </div>
                );
              })()}

              {s.warnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1 font-medium">
                    <AlertTriangle size={12} /> Caveats &amp; assumptions
                  </div>
                  <ul className="list-disc ml-4 space-y-0.5">
                    {s.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <div className="text-xs text-zinc-600">
                Reference: {s.gSheetRef}.{' '}
                <a
                  href="https://www.hse.gov.uk/pubns/books/hsg193.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-accent-700 hover:underline"
                >
                  HSG193 <ExternalLink size={11} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function labelList(values: string[], labels: Record<string, string>) {
  return values.map((value) => labels[value] ?? value);
}

function controlsForStep(step: ProcessStep) {
  return {
    engineering: labelList(step.controls?.engineering ?? [], ENGINEERING_LABELS),
    ppe: labelList(step.controls?.ppe ?? [], PPE_LABELS),
    other: step.controls?.other?.trim() ?? '',
  };
}

function hasLevOrEnclosureControl(controls: ReturnType<typeof controlsForStep>) {
  const joined = [...controls.engineering, controls.other].join(' ').toLowerCase();
  return /\b(fume hood|glove box|lev|local exhaust|extract|extraction|enclos|contain|capture|ventilat|inert atmosphere)\b/.test(joined);
}

function substanceAnalysisKey(substance: ProcessStep['chemicals'][number]) {
  return String(substance.pubchemCid ?? substance.cas ?? substance.name).trim().toLowerCase();
}

function processStepControlReviewItemsByStep(
  steps: ProcessStep[],
  suggestion: OverallSuggestion | null,
): Record<string, ProcessStepReviewItem[]> {
  if (!suggestion) return {};
  const analysisBySubstance = new Map(suggestion.analyses.map((a) => [a.substanceId, a]));
  const analysisByChemicalKey = new Map<string, SubstanceAnalysis>();
  for (const step of steps) {
    for (const chemical of step.chemicals) {
      const analysis = analysisBySubstance.get(chemical.id);
      const key = substanceAnalysisKey(chemical);
      if (analysis && key && !analysisByChemicalKey.has(key)) {
        analysisByChemicalKey.set(key, analysis);
      }
    }
  }
  const out: Record<string, ProcessStepReviewItem[]> = {};
  for (const step of steps) {
    const analyses = step.chemicals
      .map((chemical) =>
        analysisBySubstance.get(chemical.id) ??
        analysisByChemicalKey.get(substanceAnalysisKey(chemical)),
      )
      .filter((a): a is SubstanceAnalysis => Boolean(a));
    if (analyses.length === 0) continue;

    const items: ProcessStepReviewItem[] = [];
    const maxApproach = Math.max(...analyses.map((a) => a.approach)) as Approach;
    const controls = controlsForStep(step);
    if (maxApproach >= 2 && !hasLevOrEnclosureControl(controls)) {
      items.push({
        id: `${step.id}:engineering`,
        message: 'Check engineering controls: no LEV/enclosure-style control is recorded.',
      });
    }
    if (controls.ppe.length === 0) {
      items.push({
        id: `${step.id}:ppe`,
        message: 'Check PPE: no PPE is recorded for this step.',
      });
    }
    analyses
      .filter((analysis) => analysis.approach === 4)
      .forEach((analysis) => {
        items.push({
          id: `${step.id}:approach4:${analysis.substanceId}`,
          message: `Check specialist controls for ${analysis.name}: Approach 4 may need SDS review and competent H&S advice.`,
        });
      });
    if (items.length > 0) {
      out[step.id] = items;
    }
  }
  return out;
}

function StepControlsSummary({
  steps,
  reviewItemsByStep,
  checkedReviews,
  onToggleReview,
  onOpenStep,
}: {
  steps: ProcessStep[];
  reviewItemsByStep: Record<string, ProcessStepReviewItem[]>;
  checkedReviews: Set<string>;
  onToggleReview: (id: string) => void;
  onOpenStep: (stepId: string) => void;
}) {
  const allReviewItems = steps.flatMap((step) => reviewItemsByStep[step.id] ?? []);
  const checkedCount = allReviewItems.filter((item) => checkedReviews.has(item.id)).length;
  const allChecked = allReviewItems.length > 0 && checkedCount === allReviewItems.length;

  return (
    <div
      className={clsx(
        'card mb-5 overflow-hidden',
        allChecked && 'border-emerald-200',
      )}
    >
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-zinc-950">Engineering and PPE by process step</div>
          {allReviewItems.length > 0 && (
            <span
              className={clsx(
                'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                allChecked
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800',
              )}
            >
              {checkedCount} of {allReviewItems.length} checks complete
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Engineering controls and PPE are recorded against each process step. Update them in Process Steps if the task controls change.
        </div>
      </div>
      {steps.length === 0 ? (
        <div className="px-4 py-4 text-sm text-zinc-500">Add process steps to record task-specific engineering controls and PPE.</div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {steps.map((step, index) => {
            const controls = controlsForStep(step);
            const stepName = step.step.trim() || `Step ${index + 1}`;
            const reviewItems = reviewItemsByStep[step.id] ?? [];
            const stepAllChecked = reviewItems.length > 0 && reviewItems.every((item) => checkedReviews.has(item.id));
            return (
              <div
                key={step.id}
                className={clsx(stepAllChecked && 'bg-emerald-50/40')}
              >
                <button
                  type="button"
                  onClick={() => onOpenStep(step.id)}
                  className="grid w-full grid-cols-1 gap-3 px-4 py-3 text-left transition hover:bg-accent-50/50 focus:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-300 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <div>
                    <div className="text-sm font-semibold text-accent-800">{index + 1}. {stepName}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{step.chemicals.length} chemical{step.chemicals.length === 1 ? '' : 's'}</div>
                  </div>
                  <SummaryChipGroup title="Engineering" values={controls.engineering} />
                  <SummaryChipGroup title="PPE" values={controls.ppe} />
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-500">Other</div>
                    <div className="mt-1 text-sm text-zinc-700">{controls.other || <span className="text-zinc-400">None recorded</span>}</div>
                  </div>
                </button>
                {reviewItems.length > 0 && (
                  <div
                    className={clsx(
                      'mx-4 mb-3 rounded-md border p-2',
                      stepAllChecked
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-amber-200 bg-amber-50/70',
                    )}
                  >
                    <div
                      className={clsx(
                        'mb-1.5 flex items-center gap-1.5 text-xs font-semibold',
                        stepAllChecked ? 'text-emerald-800' : 'text-amber-900',
                      )}
                    >
                      {stepAllChecked ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                      Checks for this step
                    </div>
                    <div className="space-y-1.5">
                      {reviewItems.map((item) => (
                        <StepReviewCheck
                          key={item.id}
                          item={item}
                          checked={checkedReviews.has(item.id)}
                          onToggle={() => onToggleReview(item.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryChipGroup({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-zinc-500">{title}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.length > 0
          ? values.map((value) => <span key={value} className="pill">{value}</span>)
          : <span className="text-sm text-zinc-400">None selected</span>}
      </div>
    </div>
  );
}

function StepReviewCheck({
  item,
  checked,
  onToggle,
}: {
  item: ProcessStepReviewItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        'flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-1',
        checked
          ? 'border-emerald-200 bg-white text-emerald-900'
          : 'border-amber-200 bg-white text-amber-950 hover:border-amber-300',
      )}
      aria-pressed={checked}
    >
      <span
        className={clsx(
          'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
          checked
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-amber-300 bg-white text-transparent',
        )}
      >
        <CheckCircle2 size={12} strokeWidth={3} />
      </span>
      <span
        className={clsx(
          'min-w-0 text-xs leading-relaxed',
          checked && 'line-through decoration-emerald-700/50',
        )}
      >
        {item.message}
      </span>
    </button>
  );
}

function Glossary({
  title,
  entries,
  keyMin,
  labelPrefix,
}: {
  title: string;
  entries: ReadonlyArray<readonly [string, string]>;
  keyMin: string;
  labelPrefix?: string;
}) {
  return (
    <div>
      <div className="font-semibold text-accent-900 mb-1.5 pb-1 border-b border-accent-200">
        {title}
      </div>
      <dl className="space-y-1.5">
        {entries.map(([key, text]) => (
          <div key={key} className="flex gap-2">
            <dt
              className="font-semibold whitespace-nowrap shrink-0"
              style={{ minWidth: keyMin }}
            >
              {labelPrefix ? `${labelPrefix}${key}` : key}
            </dt>
            <dd className="text-zinc-700">{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ControlsSection() {
  const controls = useAssessment((s) => s.assessment.controls);
  const update = useAssessment((s) => s.updateControls);
  const processSteps = useAssessment((s) => s.assessment.processSteps);
  const setSection = useAssessment((s) => s.setSection);
  const [checkedStepReviews, setCheckedStepReviews] = useState<Set<string>>(() => new Set());

  const allSubstances = useMemo(
    () => processSteps.flatMap((s) => s.chemicals),
    [processSteps],
  );

  const suggestion = useMemo<OverallSuggestion | null>(
    () => suggestControls(allSubstances),
    [allSubstances],
  );
  const reviewItemsByStep = useMemo(
    () => processStepControlReviewItemsByStep(processSteps, suggestion),
    [processSteps, suggestion],
  );
  const toggleStepReview = (id: string) => {
    setCheckedStepReviews((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const openProcessStep = (stepId: string) => {
    try {
      sessionStorage.setItem('cat.focusProcessStep', stepId);
    } catch {
      /* ignore */
    }
    setSection('substances');
  };

  return (
    <section>
      <SectionHeader
        title="Control measures"
        subtitle="Apply the hierarchy of control. Click a section to add suggestions."
      />

      {suggestion ? (
        <CoshhEssentialsPanel s={suggestion} />
      ) : (
        <div className="card p-3 mb-4 text-xs text-zinc-500">
          Add chemicals in <strong>Process Steps</strong> to see the COSHH Essentials screening here.
        </div>
      )}

      <StepControlsSummary
        steps={processSteps}
        reviewItemsByStep={reviewItemsByStep}
        checkedReviews={checkedStepReviews}
        onToggleReview={toggleStepReview}
        onOpenStep={openProcessStep}
      />

      <div className="mb-4 text-sm font-medium text-zinc-800">Hierarchy of control</div>
      <div className="card overflow-hidden">
        <ControlRow
          number={1}
          icon={<Ban size={25} />}
          iconClass="bg-accent-600 text-white"
          label="Elimination / Substitution"
          hint="Remove or replace with a less hazardous option."
          suggestions={ELIM_SUB_SUGGESTIONS}
          value={controls.elimination + (controls.substitution ? '\n' + controls.substitution : '')}
          onChange={(v) => update({ elimination: v, substitution: '' })}
          onAppend={(s) =>
            update({
              elimination: append(
                controls.elimination + (controls.substitution ? '\n' + controls.substitution : ''),
                s,
              ),
              substitution: '',
            })
          }
          placeholder="Record whether the substance or process can be removed, replaced, pre-diluted, bought ready-to-use, or changed to a lower hazard grade."
        />
        <ControlRow
          number={2}
          icon={<BarChart3 size={25} />}
          iconClass="bg-accent-600 text-white"
          label="Reduction"
          hint="Reduce quantity, concentration or duration."
          suggestions={REDUCTION_SUGGESTIONS}
          value={controls.reduction}
          onChange={(v) => update({ reduction: v })}
          onAppend={(s) => update({ reduction: append(controls.reduction, s) })}
          placeholder="Record how quantity, concentration, batch size, exposure time, frequency and number of people exposed will be kept as low as practicable."
        />
        <ControlRow
          number={3}
          icon={<FileText size={25} />}
          iconClass="bg-accent-600 text-white"
          label="Administrative controls"
          hint="Change the way people work."
          required
          suggestions={ADMIN_SUGGESTIONS}
          value={controls.administrative}
          onChange={(v) => update({ administrative: v })}
          onAppend={(s) => update({ administrative: append(controls.administrative, s) })}
          placeholder="Record procedural controls such as SOP reference, training, briefing, authorisation, supervision, signage, housekeeping, lone-working limits and review triggers."
        />
        <ControlRow
          number={4}
          icon={<Wind size={25} />}
          iconClass="bg-accent-600 text-white"
          label="Air monitoring"
          hint="Confirm exposure stays controlled."
          required
          suggestions={AIR_MONITORING_SUGGESTIONS}
          value={controls.airMonitoring}
          onChange={(v) => update({ airMonitoring: v })}
          onAppend={(s) => update({ airMonitoring: append(controls.airMonitoring, s) })}
          placeholder="Record whether air monitoring is required, why it is or is not needed, relevant WELs, sampling type, review frequency and triggers for reassessment."
        />
        <ControlRow
          number={5}
          icon={<Stethoscope size={25} />}
          iconClass="bg-accent-600 text-white"
          label="Health surveillance"
          hint="Record any OH decision or trigger."
          required
          suggestions={HEALTH_SURVEILLANCE_SUGGESTIONS}
          value={controls.healthSurveillance}
          onChange={(v) => update({ healthSurveillance: v })}
          onAppend={(s) => update({ healthSurveillance: append(controls.healthSurveillance, s) })}
          placeholder="Record any Occupational Health referral, health-surveillance decision, symptom reporting route, exposure records and review triggers."
        />
      </div>
    </section>
  );
}

function ControlRow({
  number,
  icon,
  iconClass,
  label,
  hint,
  suggestions,
  value,
  onChange,
  onAppend,
  placeholder,
  required,
}: {
  number: number;
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  hint: string;
  suggestions: string[];
  value: string;
  onChange: (v: string) => void;
  onAppend: (s: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-zinc-200 px-4 py-4 last:border-b-0 xl:grid-cols-[3.5rem_minmax(220px,0.9fr)_minmax(520px,2.4fr)] xl:items-center">
      <div className={clsx('flex h-12 w-12 items-center justify-center rounded-full shadow-soft', iconClass)}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-zinc-900">
          {number}. {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </div>
        <div className="mt-1 text-xs text-zinc-500">{hint}</div>
      </div>
      <div className="min-w-0">
        <SuggestionField
          label=""
          suggestions={suggestions}
          value={value}
          onChange={onChange}
          onAppend={onAppend}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
