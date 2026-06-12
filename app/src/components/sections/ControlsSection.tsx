import { useMemo, useState } from 'react';
import {
  Sparkles, AlertTriangle, ChevronDown, ChevronRight, Info,
  Ban, BarChart3, FileText, Wind, Stethoscope, CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PageIntro } from '@/components/common/PageIntro';
import { appendUniqueBullet } from '@/components/common/SuggestionChips';
import { SuggestionField } from '@/components/common/SuggestionField';
import { suggestControls, OverallSuggestion, SubstanceAnalysis, Approach, APPROACH_LABEL } from '@/services/coshhEssentials';
import { EP_EXPOSURE_TABLE, EP_EXPOSURE_TABLE_EXPLANATION } from '@/services/exporters/coshhSummary';
import { ProcessStep } from '@/types/assessment';

const BASE_ELIM_SUB_CONSIDERATIONS = [
  'Can any listed chemical be removed from the task without changing the required outcome?',
  'Can any chemical step be replaced with a non-chemical method?',
  'Is each chemical required by the SOP, method, specification or experimental design?',
];

const BASE_ELIM_SUB_SUGGESTIONS = [
  '[Chemical] has been removed from the process.',
  '[Chemical] has been replaced with [substitute].',
  'The chemical step using [chemical] has been replaced with a non-chemical method.',
  '[Chemical] is required for this method and no approved lower-hazard substitute is available.',
  'Substitution was reviewed for [chemical]; no suitable lower-hazard alternative was identified for this task.',
];

const BASE_REDUCTION_CONSIDERATIONS = [
  'Can the working quantity at the bench be reduced?',
  'Can the duration or frequency of open handling be reduced?',
  'Can fewer people be present during chemical handling?',
  'Can stock containers be kept away from the task except during dispensing?',
];

const BASE_REDUCTION_SUGGESTIONS = [
  'Only the quantity required of each chemical will be kept at the work area.',
  'Stock containers will be returned to storage immediately after use.',
  'Containers will be kept closed except during active dispensing/ use.',
  'Open handling steps will be completed quickly.',
  'Only one chemical container will be open/used at any one time.',
];

const BASE_ADMIN_CONSIDERATIONS = [
  'Who is authorised to carry out this task?',
  'Which SOP, method or local procedure must be followed?',
  'Which SDSs need to be read before work starts?',
  'What records, labels or reporting routes are required?',
  'What changes would trigger reassessment before work continues?',
];

const BASE_ADMIN_SUGGESTIONS = [
  'Work will be carried out in accordance with the approved SOP or local safe working procedure.',
  'Only trained and authorised personnel will carry out this task.',
  'Users will read the current SDS before starting work.',
  'Users will be briefed on this COSHH assessment before starting work.',
  'Working containers will be labelled with the chemical name, concentration and hazard information.',
  'Incompatible chemicals will be kept separated during setup, use and disposal.',
  'Spills, exposure, failed controls or unexpected reactions will be reported immediately.',
  'This assessment will be reviewed before any change to the chemicals, quantity, concentration, process or controls.',
];

const BASE_AIR_MONITORING_CONSIDERATIONS = [
  'For chemicals with WELs, is the substance contained or controlled during dispensing, transfer, heating, weighing, mixing and cleanup, etc.?',
  'Is current information good enough to decide whether exposure is controlled below the WEL?',
  'Could monitoring help confirm that controls are effective?',
  'Would monitoring be needed after scale-up, process change, control failure or exposure concern?',
];

const BASE_AIR_MONITORING_SUGGESTIONS = [
  'Air monitoring is not required because airborne exposure is not expected during this task.',
  'Air monitoring is not required because existing controls are established and exposure is expected to remain below relevant WELs.',
  'Air monitoring will be carried out to confirm that exposure controls are effective.',
  'Air monitoring requirements will be reviewed after scale-up, process change, control failure or exposure concern.',
];

const BASE_HEALTH_SURVEILLANCE_CONSIDERATIONS = [
  'Do any chemicals indicate respiratory sensitisation/asthma, skin sensitisation or CMR-type health effects?',
  'Is there still a realistic chance of exposure after controls are applied?',
  'Is the task repeated often enough for health surveillance to be useful?',
  'Do SDSs, Occupational Health or local rules require health surveillance or medical surveillance?',
  'What symptoms or exposure events must users report?',
];

const BASE_HEALTH_SURVEILLANCE_SUGGESTIONS = [
  'Health surveillance is not required because exposure is not expected after controls are applied.',
  'Health surveillance is not required because no sensitiser, asthmagen, CMR or other health surveillance trigger has been identified.',
  'Users will be referred to Occupational Health where health surveillance is required and work will not be started before appointment attended.',
  'Users must report symptoms that may be linked to exposure to their manager.',
  'Users must report skin contact, inhalation exposure or PPE/control failure.',
  'Any Occupational Health restrictions or monitoring requirements will be followed.',
];

const append = appendUniqueBullet;

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
  ['A', 'Lower health hazard band: H304, H315, H319, H336, EU66 and similar lower-toxicity effects.'],
  ['B', 'Harmful / STOT category 2 band: H302, H312, H332, H371.'],
  ['C', 'Toxic, corrosive, serious eye damage, sensitising skin, respiratory irritation or STOT category 1/2: H301, H311, H314, H317, H318, H331, H335, H370, H373, EU71.'],
  ['D', 'Fatal acute toxicity, suspected carcinogen/reproductive toxicant, lactation hazard or repeated-exposure organ damage: H300, H310, H330, H351, H360, H361, H362, H372.'],
  ['E', 'Respiratory sensitiser, mutagen, carcinogen category 1/suspected mutagen or toxic by eye contact: H334, H340, H341, H350, EU70. Specialist advice is required.'],
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
              className="flex min-w-0 flex-1 items-center gap-1.5 flex-wrap rounded-md text-left focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2"
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="font-medium">COSHH Essentials screening</span>
              <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-800">
                Click to review screening output
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
                        Approach {ap}
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
              <EpExposureReference className="mt-4" />
              <p className="mt-2 text-zinc-500 italic">
                EP is calculated from amount in use plus dustiness for solids or volatility for liquids.
              </p>
            </div>
          )}

          {open && (
            <div className="mt-3 space-y-3 text-sm">
              <div className="rounded-md border border-accent-100 bg-accent-50/60 p-3 text-xs leading-relaxed text-zinc-700">
                <div className="font-semibold text-zinc-900">What does this mean?</div>
                <div className="mt-2 space-y-2.5">
                  <p>
                    COSHH Essentials is an HSE control-banding tool. LabCAT uses the chemicals you've entered into the system, extracts the quantities, physical form and hazard information entered in Process Steps to estimate the control approach likely to be needed.
                  </p>
                  <p>
                    In the table below, each chemical is shown alongside the COSHH Essentials screening output calculated from the data entered in Process Steps.
                  </p>
                  <p>
                    Approach 1 may indicate that general ventilation and good practice could be sufficient, but only where the competent assessor confirms this against the SDS, exposure route, quantity, duration, WELs and local conditions.
                  </p>
                  <p>
                    Approaches 2 and 3 indicate that the screening points toward engineering control, normally LEV or equivalent capture/control, with the final control choice confirmed by the assessor.
                  </p>
                  <p>
                    Where chemicals are identified under Approach 4, specialist advice is required. Do not rely on the banded screening alone; check the SDS and record the task-specific controls before confirming the process step.
                  </p>
                  <p>
                    You should always check the SDS and make sure the engineering controls and PPE recorded for each process step are suitable, then document the final control measures in both the Process Steps section and the fields below.
                  </p>
                  <p className="rounded-md border border-accent-100 bg-white/70 px-2 py-1.5">
                    <span className="font-semibold text-zinc-900">Note:</span> This screening is not valid for asbestos, lead, pesticides, radioactive materials or biological agents.
                  </p>
                </div>
              </div>

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
                              <span>{APPROACH_LABEL(approach).replace(/^Approach \d+ - /, '')}</span>
                              <span className="text-[10px] opacity-70">
                                {items.length} substance{items.length === 1 ? '' : 's'}
                              </span>
                            </div>
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
                                  <td className="p-1.5 text-zinc-700">{a.drivingHCodes.join(', ') || '-'}</td>
                                  <td className="p-1.5 text-zinc-700">{a.scale}{a.assumed.scale && ' *'}</td>
                                  <td className="p-1.5 text-zinc-700">
                                    {a.bandKind === 'not-applicable' ? '-' : `${a.band} (${a.bandKind})`}
                                    {a.assumed.band && ' *'}
                                  </td>
                                  <td className="p-1.5 text-zinc-700">{a.exposurePredictor ?? '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                    <div className="text-[10px] text-zinc-500">
                      * assumed value used because input was missing or unparseable.
                      Each substance has its own approach; the highest approach present is highlighted for assessor review.
                    </div>
                  </div>
                );
              })()}
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

function uniqueChemicalNames(steps: ProcessStep[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const step of steps) {
    for (const chemical of step.chemicals) {
      const name = chemical.name.trim() || chemical.cas?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

function hasRealWelValue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ![
    'n/a',
    'na',
    'none',
    'not applicable',
    'not available',
    'no wel',
    '-',
    '—',
  ].includes(normalized);
}

function uniqueWelChemicalNames(steps: ProcessStep[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const step of steps) {
    for (const chemical of step.chemicals) {
      if (!hasRealWelValue(chemical.wel.twa) && !hasRealWelValue(chemical.wel.stel)) continue;
      const name = chemical.name.trim() || chemical.cas?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

const HEALTH_SURVEILLANCE_HCODES = new Set([
  'H317',
  'H334',
  'H340',
  'H341',
  'H350',
  'H350I',
  'H351',
  'H360',
  'H360F',
  'H360D',
  'H360FD',
  'H361',
  'H361F',
  'H361D',
  'H361FD',
  'H362',
]);

function normalizeHCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

function uniqueHealthSurveillanceChemicalNames(steps: ProcessStep[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const step of steps) {
    for (const chemical of step.chemicals) {
      const hasTrigger = chemical.hazardStatements.some((h) =>
        HEALTH_SURVEILLANCE_HCODES.has(normalizeHCode(h.code)),
      );
      if (!hasTrigger) continue;
      const name = chemical.name.trim() || chemical.cas?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

function eliminationSubstitutionPrompts(steps: ProcessStep[]) {
  const names = uniqueChemicalNames(steps);
  const displayedNames = names.slice(0, 8);
  const chemicalList = displayedNames.join(', ');
  const extraCount = names.length - displayedNames.length;
  return {
    considerations: [
      ...BASE_ELIM_SUB_CONSIDERATIONS,
      ...(names.length > 0
        ? [
            `Chemicals to check for removal or substitution: ${chemicalList}${extraCount > 0 ? `, plus ${extraCount} more` : ''}.`,
          ]
        : []),
    ],
    suggestions: BASE_ELIM_SUB_SUGGESTIONS,
  };
}

function reductionPrompts(steps: ProcessStep[]) {
  const names = uniqueChemicalNames(steps);
  const displayedNames = names.slice(0, 8);
  const chemicalList = displayedNames.join(', ');
  const extraCount = names.length - displayedNames.length;
  return {
    considerations: [
      ...BASE_REDUCTION_CONSIDERATIONS,
      ...(names.length > 0
        ? [
            `Chemicals to check for quantity, duration or frequency reduction: ${chemicalList}${extraCount > 0 ? `, plus ${extraCount} more` : ''}.`,
          ]
        : []),
    ],
    suggestions: BASE_REDUCTION_SUGGESTIONS,
  };
}

function adminPrompts(steps: ProcessStep[]) {
  const names = uniqueChemicalNames(steps);
  const displayedNames = names.slice(0, 8);
  const chemicalList = displayedNames.join(', ');
  const extraCount = names.length - displayedNames.length;
  return {
    considerations: [
      ...BASE_ADMIN_CONSIDERATIONS,
      ...(names.length > 0
        ? [
            `SDSs and chemical-specific administrative requirements to check: ${chemicalList}${extraCount > 0 ? `, plus ${extraCount} more` : ''}.`,
          ]
        : []),
    ],
    suggestions: BASE_ADMIN_SUGGESTIONS,
  };
}

function airMonitoringPrompts(steps: ProcessStep[]) {
  const welNames = uniqueWelChemicalNames(steps);
  const names = welNames.length > 0 ? welNames : uniqueChemicalNames(steps);
  const displayedNames = names.slice(0, 8);
  const chemicalList = displayedNames.join(', ');
  const extraCount = names.length - displayedNames.length;
  const chemicalPrompt = welNames.length > 0
    ? `Chemicals that have WELs: ${chemicalList}${extraCount > 0 ? `, plus ${extraCount} more` : ''}.`
    : `Chemicals to check for WELs and airborne exposure potential: ${chemicalList}${extraCount > 0 ? `, plus ${extraCount} more` : ''}.`;
  return {
    considerations: [
      ...(names.length > 0
        ? [chemicalPrompt]
        : []),
      ...BASE_AIR_MONITORING_CONSIDERATIONS,
    ],
    suggestions: BASE_AIR_MONITORING_SUGGESTIONS,
  };
}

function healthSurveillancePrompts(steps: ProcessStep[]) {
  const triggerNames = uniqueHealthSurveillanceChemicalNames(steps);
  const names = triggerNames.length > 0 ? triggerNames : uniqueChemicalNames(steps);
  const displayedNames = names.slice(0, 8);
  const chemicalList = displayedNames.join(', ');
  const extraCount = names.length - displayedNames.length;
  const chemicalPrompt = triggerNames.length > 0
    ? `Chemicals to check for health surveillance triggers: ${chemicalList}${extraCount > 0 ? `, plus ${extraCount} more` : ''}. These include sensitiser/asthmagen or CMR-type H-code concerns.`
    : `Chemicals to check against SDS health surveillance requirements: ${chemicalList}${extraCount > 0 ? `, plus ${extraCount} more` : ''}.`;
  return {
    considerations: [
      ...(names.length > 0
        ? [chemicalPrompt]
        : []),
      ...BASE_HEALTH_SURVEILLANCE_CONSIDERATIONS,
    ],
    suggestions: BASE_HEALTH_SURVEILLANCE_SUGGESTIONS,
  };
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
        message: 'No LEV or enclosure-style control is recorded; review the engineering controls for this step.',
      });
    }
    if (controls.ppe.length === 0) {
      items.push({
        id: `${step.id}:ppe`,
        message: 'No PPE is recorded for this step; add the PPE required.',
      });
    }
    analyses
      .filter((analysis) => analysis.approach === 4)
      .forEach((analysis) => {
        items.push({
          id: `${step.id}:approach4:${analysis.substanceId}`,
          message: `${analysis.name} needs specialist advice (Approach 4). Review the SDS, document any specialist controls in the assessment, and add additional controls where required.`,
        });
      });
    // Steps that were screened but raised nothing still get an entry, so the
    // UI can tell "analysed and all clear" apart from "no screening available".
    out[step.id] = items;
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
  const analysedStepCount = steps.filter((step) => reviewItemsByStep[step.id] !== undefined).length;
  const allReviewItems = steps.flatMap((step) => reviewItemsByStep[step.id] ?? []);
  const checkedCount = allReviewItems.filter((item) => checkedReviews.has(item.id)).length;
  const allChecked = allReviewItems.length > 0 && checkedCount === allReviewItems.length;
  const allClear = analysedStepCount > 0 && allReviewItems.length === 0;

  return (
    <div
      className={clsx(
        'card mb-5 overflow-hidden',
        (allChecked || allClear) && 'border-emerald-200',
      )}
    >
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-zinc-950">Engineering and PPE by process step</div>
          {allReviewItems.length > 0 ? (
            <span
              className={clsx(
                'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                allChecked
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800',
              )}
            >
              {checkedCount} of {allReviewItems.length} review point{allReviewItems.length === 1 ? '' : 's'} cleared
            </span>
          ) : allClear ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              All clear: nothing flagged
            </span>
          ) : null}
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
            const reviewItems = reviewItemsByStep[step.id];
            const stepAnalysed = reviewItems !== undefined;
            const stepAllChecked =
              stepAnalysed && reviewItems.length > 0 && reviewItems.every((item) => checkedReviews.has(item.id));
            return (
              <div
                key={step.id}
                className={clsx(stepAllChecked && 'bg-emerald-50/40')}
              >
                <button
                  type="button"
                  onClick={() => onOpenStep(step.id)}
                  className="group grid w-full grid-cols-1 gap-3 border-l-4 border-l-transparent px-4 py-3 text-left transition hover:border-l-accent-500 hover:bg-accent-50/50 focus:border-l-accent-500 focus:bg-accent-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-300 lg:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
                  title="Update this step in Process Steps"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-accent-800">{index + 1}. {stepName}</span>
                      <span className="inline-flex items-center gap-0.5 rounded-full border border-accent-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-accent-700 opacity-80 transition group-hover:border-accent-300 group-hover:bg-accent-50 group-hover:opacity-100">
                        Update <ChevronRight size={11} />
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">{step.chemicals.length} chemical{step.chemicals.length === 1 ? '' : 's'}</div>
                  </div>
                  <SummaryChipGroup title="Engineering" values={controls.engineering} />
                  <SummaryChipGroup title="PPE" values={controls.ppe} />
                  <div>
                    <div className="text-[11px] font-semibold text-zinc-500">Other</div>
                    <div className="mt-1 whitespace-pre-line text-sm text-zinc-700">{controls.other || <span className="text-zinc-400">None recorded</span>}</div>
                  </div>
                </button>
                {stepAnalysed && reviewItems.length > 0 && (
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
                      Review points for this step
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
                {stepAnalysed && reviewItems.length === 0 && (
                  <div className="mx-4 mb-3 flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/60 p-2 text-xs font-medium text-emerald-800">
                    <CheckCircle2 size={13} />
                    No review points; controls are consistent with the screening.
                  </div>
                )}
                {!stepAnalysed && (
                  <div className="mx-4 mb-3 rounded-md border border-zinc-200 bg-zinc-50/60 p-2 text-xs text-zinc-500">
                    No screening available for this step yet. Complete its chemical details in Process Steps.
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

function EpExposureReference({ className = '' }: { className?: string }) {
  return (
    <div className={clsx('overflow-hidden rounded-md border border-accent-200 bg-white', className)}>
      <div className="border-b border-accent-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-900">
        Predicted exposure ranges by EP band and control approach
      </div>
      <p className="border-b border-accent-100 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-600">
        {EP_EXPOSURE_TABLE_EXPLANATION}
      </p>
      {EP_EXPOSURE_TABLE.map((section) => (
        <div key={section.title}>
          <div className="border-b border-zinc-200 bg-zinc-50 px-2.5 py-1 text-center text-[11px] font-semibold text-zinc-800">
            {section.title}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[11px]">
              <thead className="bg-white text-zinc-600">
                <tr>
                  <th className="border-b border-zinc-200 p-1.5 text-left font-medium">EP band</th>
                  <th className="border-b border-zinc-200 p-1.5 text-left font-medium">Control approach 1</th>
                  <th className="border-b border-zinc-200 p-1.5 text-left font-medium">Control approach 2</th>
                  <th className="border-b border-zinc-200 p-1.5 text-left font-medium">Control approach 3</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map(([ep, a1, a2, a3]) => (
                  <tr key={ep} className="odd:bg-white even:bg-zinc-50/70">
                    <th className="border-b border-zinc-100 p-1.5 text-left font-semibold text-zinc-800">{ep}</th>
                    <td className="border-b border-zinc-100 p-1.5 text-zinc-700">{a1}</td>
                    <td className="border-b border-zinc-100 p-1.5 text-zinc-700">{a2}</td>
                    <td className="border-b border-zinc-100 p-1.5 text-zinc-700">{a3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
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
  const elimSubPrompts = useMemo(
    () => eliminationSubstitutionPrompts(processSteps),
    [processSteps],
  );
  const reductionControlPrompts = useMemo(
    () => reductionPrompts(processSteps),
    [processSteps],
  );
  const adminControlPrompts = useMemo(
    () => adminPrompts(processSteps),
    [processSteps],
  );
  const airMonitoringControlPrompts = useMemo(
    () => airMonitoringPrompts(processSteps),
    [processSteps],
  );
  const healthSurveillanceControlPrompts = useMemo(
    () => healthSurveillancePrompts(processSteps),
    [processSteps],
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
      sessionStorage.setItem('labcat.focusProcessStep', stepId);
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

      <PageIntro
        body="Use this page to record the final control measures for the assessment. Start by confirming the process-step engineering controls and PPE match the COSHH Essentials screening result, then complete the hierarchy of control fields below."
        steps={[
          { title: '1. Run the screening', body: 'Use the COSHH Essentials section to find the suggested control approach for the chemicals used.' },
          { title: '2. Review flagged controls', body: 'LabCAT compares each step’s engineering controls and PPE against the screening result and flags anything that looks missing as a review point under the step. Review each one, update the step if needed, then tick it off.' },
          { title: '3. Record other controls', body: 'Work through the other levels of the hierarchy of control and record the measures in place to complete the work safely. The prompts and suggestions offer feedback on what to consider, alongside standardised responses you can adopt.' },
        ]}
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
          required
          considerationLabel="Review elimination/substitution prompts"
          considerations={elimSubPrompts.considerations}
          suggestions={elimSubPrompts.suggestions}
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
          placeholder="Record whether any chemical can be removed, replaced with a lower-hazard alternative, or replaced by a non-chemical method."
        />
        <ControlRow
          number={2}
          icon={<BarChart3 size={25} />}
          iconClass="bg-accent-600 text-white"
          label="Reduction"
          hint="Reduce quantity, concentration or duration."
          required
          considerationLabel="Review reduction prompts"
          considerations={reductionControlPrompts.considerations}
          suggestions={reductionControlPrompts.suggestions}
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
          considerationLabel="Review administrative prompts"
          considerations={adminControlPrompts.considerations}
          suggestions={adminControlPrompts.suggestions}
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
          considerationLabel="Review air monitoring prompts"
          considerations={airMonitoringControlPrompts.considerations}
          suggestions={airMonitoringControlPrompts.suggestions}
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
          considerationLabel="Review health surveillance prompts"
          considerations={healthSurveillanceControlPrompts.considerations}
          suggestions={healthSurveillanceControlPrompts.suggestions}
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
  considerationLabel,
  considerations,
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
  considerationLabel?: string;
  considerations?: string[];
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
        {considerations && considerations.length > 0 && (
          <details className="group mb-2 rounded-md border border-accent-200 bg-accent-50 px-2.5 py-1.5">
            <summary className="cursor-pointer text-xs font-semibold text-accent-800 marker:text-accent-400">
              {considerationLabel ?? 'Review prompts'}
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
        )}
        <SuggestionField
          label=""
          required={required}
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
