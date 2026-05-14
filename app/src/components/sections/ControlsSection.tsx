import { useMemo, useState } from 'react';
import { Sparkles, AlertTriangle, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { SuggestionChips, appendUnique } from '@/components/common/SuggestionChips';
import { SuggestionDisclaimer } from '@/components/common/SuggestionDisclaimer';
import { suggestControls, OverallSuggestion, SubstanceAnalysis, Approach, APPROACH_LABEL } from '@/services/coshhEssentials';

type ControlKey = 'elimination' | 'substitution' | 'reduction' | 'engineering' | 'administrative';

interface HierarchyEntry {
  key: ControlKey;
  label: string;
  hint: string;
  suggestions: string[];
}

const HIERARCHY: HierarchyEntry[] = [
  {
    key: 'elimination',
    label: 'Elimination',
    hint: 'Can the hazard be removed entirely?',
    suggestions: [
      'Not feasible — substance is essential to the process',
      'Elimination considered; not reasonably practicable for this activity',
    ],
  },
  {
    key: 'substitution',
    label: 'Substitution',
    hint: 'Replace with a less hazardous substance or process.',
    suggestions: [
      'No safer alternative identified for this application',
      'Substituted with a less hazardous reagent of equivalent performance',
      'Use the lowest practicable concentration or hazard grade',
    ],
  },
  {
    key: 'reduction',
    label: 'Reduction',
    hint: 'Reduce quantity, concentration or exposure duration.',
    suggestions: [
      'Minimum effective quantity used per batch',
      'Process scale reduced where practicable',
      'Exposure duration limited by procedure',
    ],
  },
  {
    key: 'engineering',
    label: 'Engineering Controls',
    hint: 'LEV, fume hoods, enclosures, interlocks.',
    suggestions: [
      'Use suitable local exhaust ventilation where airborne exposure may occur',
      'Keep containers closed when not in use',
      'Use enclosed transfer or dispensing where practicable',
      'LEV inspection and thorough examination kept in date where LEV is used',
    ],
  },
  {
    key: 'administrative',
    label: 'Administrative Controls',
    hint: 'SOPs, training, permits, signage, rotation.',
    suggestions: [
      'SOP or safe working procedure available to users',
      'COSHH briefing required before first use',
      'Restricted to trained and authorised personnel',
      'Work area kept clean; spills reported and cleaned promptly',
      'Assessment reviewed if substance, quantity or process changes',
    ],
  },
];

const PPE_TYPE_SUGGESTIONS = [
  'Suitable chemical-resistant gloves',
  'Safety goggles',
  'Face shield',
  'Lab coat or protective clothing',
  'Respiratory protective equipment where exposure cannot be adequately controlled by other means',
];

const PPE_STANDARD_SUGGESTIONS = [
  'EN ISO 374-1 (chemical-resistant gloves)',
  'EN 166 (eye protection)',
  'RPE selected, face-fit tested and maintained where required',
];

const AIR_MONITORING_SUGGESTIONS = [
  'Not required where exposure is adequately controlled and no WEL concern is identified',
  'Personal exposure monitoring against the relevant WEL where exposure may approach the limit',
  'Monitoring reviewed if process, quantity, duration or controls change',
];

const HEALTH_SURVEILLANCE_SUGGESTIONS = [
  'Not required where there is no identifiable health-surveillance trigger',
  'Refer to Occupational Health if sensitiser, carcinogen, mutagen, asthmagen or skin-absorption concern applies',
  'Users instructed to report symptoms or suspected exposure promptly',
];

const asChipSuggestions = (texts: string[]) => texts.map((t) => ({ text: t }));

function SuggestionRow({
  suggestions,
  value,
  onAppend,
}: {
  suggestions: string[];
  value: string;
  onAppend: (s: string) => void;
}) {
  return (
    <SuggestionChips
      suggestions={asChipSuggestions(suggestions)}
      value={value}
      onAppend={onAppend}
    />
  );
}

const append = appendUnique;

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

function CoshhEssentialsPanel({
  s,
  onApply,
}: {
  s: OverallSuggestion;
  onApply: (patch: Parameters<ReturnType<typeof useAssessment.getState>['updateControls']>[0]) => void;
}) {
  const [open, setOpen] = useState(true);

  const apply = () => {
    if (!window.confirm(
      `Apply COSHH Essentials Approach ${s.approach} suggestions?\n\n` +
      `This will OVERWRITE the existing Engineering, Administrative, PPE, Air Monitoring and Health Surveillance fields. ` +
      `The inserted text is a concise starting point and should be checked against the specific task and SDS.\n\n` +
      `Continue?`,
    )) return;
    onApply(s.controlsPatch);
  };

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-start gap-3">
        <Sparkles size={18} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 flex-wrap text-left w-full"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="font-medium">COSHH Essentials suggestion</span>
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

          {open && (
            <div className="mt-3 space-y-3 text-sm">
              <div className="text-xs font-medium text-zinc-700">
                Per-substance breakdown ({s.analyses.length}) — grouped by approach
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
                      The highest approach across all substances drives the recommended controls (HSE COSHH Essentials).
                    </div>
                  </div>
                );
              })()}

              <details className="rounded-md border-2 border-accent-200 bg-accent-50/60 p-3 text-xs text-zinc-800 shadow-soft">
                <summary className="cursor-pointer font-semibold text-accent-900 select-none">
                  What the COSHH Essentials values mean
                </summary>
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <div className="font-semibold text-accent-900 mb-1.5 pb-1 border-b border-accent-200">
                      Hazard group
                    </div>
                    <dl className="space-y-1.5">
                      {HAZARD_GROUP_HELP.map(([key, text]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="font-semibold whitespace-nowrap shrink-0 min-w-[3.5rem]">
                            Group {key}
                          </dt>
                          <dd className="text-zinc-700">{text}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div>
                    <div className="font-semibold text-accent-900 mb-1.5 pb-1 border-b border-accent-200">
                      EP band
                    </div>
                    <dl className="space-y-1.5">
                      {EP_HELP.map(([key, text]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="font-semibold whitespace-nowrap shrink-0 min-w-[2.5rem]">
                            {key}
                          </dt>
                          <dd className="text-zinc-700">{text}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div>
                    <div className="font-semibold text-accent-900 mb-1.5 pb-1 border-b border-accent-200">
                      Approach
                    </div>
                    <dl className="space-y-1.5">
                      {APPROACH_HELP.map(([key, text]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="font-semibold whitespace-nowrap shrink-0 min-w-[1.5rem]">
                            {key}
                          </dt>
                          <dd className="text-zinc-700">{text}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 text-zinc-500 italic">
                      EP is calculated from amount in use plus dustiness for solids or volatility for liquids.
                    </p>
                  </div>
                </div>
              </details>

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

              <div className="text-zinc-700 text-sm">
                Driven by{' '}
                <strong>{s.driver?.name}</strong> — hazard group{' '}
                <strong>{s.driver?.hazardGroup}</strong>
                {s.driver && s.driver.drivingHCodes.length > 0 && (
                  <> ({s.driver.drivingHCodes.join(', ')})</>
                )}
                , scale <strong>{s.driver?.scale}</strong>
                {s.driver?.bandKind !== 'not-applicable' && (
                  <>, {s.driver?.bandKind} <strong>{s.driver?.band}</strong></>
                )}
                {s.driver?.exposurePredictor && (
                  <>, exposure predictor <strong>{s.driver.exposurePredictor}</strong></>
                )}.
              </div>

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

              <div className="flex items-center gap-2 pt-1">
                <button onClick={apply} className="btn-primary text-xs">
                  <Sparkles size={12} /> Apply suggestion to control fields
                </button>
                <span className="text-[11px] text-zinc-500">
                  Overwrites Engineering / Admin / PPE / Air monitoring / Health surveillance with concise starting text.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ControlsSection() {
  const controls = useAssessment((s) => s.assessment.controls);
  const update = useAssessment((s) => s.updateControls);
  const processSteps = useAssessment((s) => s.assessment.processSteps);

  const allSubstances = useMemo(
    () => processSteps.flatMap((s) => s.chemicals),
    [processSteps],
  );

  const suggestion = useMemo<OverallSuggestion | null>(
    () => suggestControls(allSubstances),
    [allSubstances],
  );

  return (
    <section>
      <SectionHeader
        title="Control Measures"
        subtitle="Apply the hierarchy of control. PPE is the last resort. Click a suggested phrase to add it."
      />
      <SuggestionDisclaimer />

      {suggestion && (
        <CoshhEssentialsPanel
          s={suggestion}
          onApply={(patch) => update(patch)}
        />
      )}

      <div className="space-y-3">
        {HIERARCHY.map(({ key, label, hint, suggestions }) => (
          <div key={key} className="card p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="font-medium text-zinc-900">{label}</div>
              <div className="text-[11px] text-zinc-500">{hint}</div>
            </div>
            <SuggestionRow
              suggestions={suggestions}
              value={controls[key]}
              onAppend={(s) => update({ [key]: append(controls[key], s) } as Partial<typeof controls>)}
            />
            <textarea
              className="field-textarea"
              value={controls[key]}
              onChange={(e) => update({ [key]: e.target.value } as Partial<typeof controls>)}
            />
          </div>
        ))}

        <div className="card p-4">
          <div className="font-medium text-zinc-900 mb-2">PPE</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label>
                <span className="field-label">Type</span>
              </label>
              <SuggestionRow
                suggestions={PPE_TYPE_SUGGESTIONS}
                value={controls.ppe.type}
                onAppend={(s) =>
                  update({ ppe: { ...controls.ppe, type: append(controls.ppe.type, s) } })
                }
              />
              <input
                className="field-input"
                value={controls.ppe.type}
                onChange={(e) => update({ ppe: { ...controls.ppe, type: e.target.value } })}
                placeholder="e.g. nitrile gloves, safety goggles, lab coat"
              />
            </div>
            <div>
              <label>
                <span className="field-label">Standard / spec</span>
              </label>
              <SuggestionRow
                suggestions={PPE_STANDARD_SUGGESTIONS}
                value={controls.ppe.standard}
                onAppend={(s) =>
                  update({ ppe: { ...controls.ppe, standard: append(controls.ppe.standard, s) } })
                }
              />
              <input
                className="field-input"
                value={controls.ppe.standard}
                onChange={(e) => update({ ppe: { ...controls.ppe, standard: e.target.value } })}
                placeholder="e.g. EN 374, EN 166"
              />
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="font-medium text-zinc-900 mb-2">Air Monitoring</div>
          <SuggestionRow
            suggestions={AIR_MONITORING_SUGGESTIONS}
            value={controls.airMonitoring}
            onAppend={(s) =>
              update({ airMonitoring: append(controls.airMonitoring, s) })
            }
          />
          <textarea
            className="field-textarea"
            value={controls.airMonitoring}
            onChange={(e) => update({ airMonitoring: e.target.value })}
          />
        </div>

        <div className="card p-4">
          <div className="font-medium text-zinc-900 mb-2">Health Surveillance</div>
          <SuggestionRow
            suggestions={HEALTH_SURVEILLANCE_SUGGESTIONS}
            value={controls.healthSurveillance}
            onAppend={(s) =>
              update({ healthSurveillance: append(controls.healthSurveillance, s) })
            }
          />
          <textarea
            className="field-textarea"
            value={controls.healthSurveillance}
            onChange={(e) => update({ healthSurveillance: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}
