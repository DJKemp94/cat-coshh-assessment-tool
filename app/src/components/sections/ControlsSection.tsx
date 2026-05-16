import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, AlertTriangle, ExternalLink, ChevronDown, ChevronRight, Info, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { appendUnique } from '@/components/common/SuggestionChips';
import { SuggestionField } from '@/components/common/SuggestionField';
import { suggestControls, OverallSuggestion, SubstanceAnalysis, Approach, APPROACH_LABEL } from '@/services/coshhEssentials';
import { ControlMeasures } from '@/types/assessment';

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

const ENGINEERING_SUGGESTIONS = [
  'Use suitable capture, extraction or containment where airborne exposure may occur.',
  'Keep containers closed except during transfer, dispensing or use.',
  'Use enclosed transfer, splash control or shielding where practicable.',
  'Inspect and maintain control equipment; keep statutory LEV examination records where LEV is used.',
];

const ADMIN_SUGGESTIONS = [
  'Work must follow the approved SOP or safe working procedure.',
  'Users must be briefed on the COSHH assessment before starting work.',
  'Restrict the activity to trained and authorised personnel.',
  'Keep the work area clean; report and clean spills promptly.',
  'Review the assessment if the substance, quantity, frequency, process or controls change.',
];

const PPE_TYPE_SUGGESTIONS = [
  'Chemical-resistant gloves selected for the substance, contact time and task.',
  'Eye protection suitable for the splash or impact risk.',
  'Face protection where splash, spray or pressure release could occur.',
  'Protective clothing appropriate to the contamination risk.',
  'Respiratory protective equipment only where exposure cannot be adequately controlled by other means.',
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
  signature,
  appliedKey,
  onApply,
  onUndo,
}: {
  s: OverallSuggestion;
  signature: string;
  appliedKey: string | null;
  onApply: () => void;
  onUndo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const justApplied = appliedKey === signature;

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-start gap-3">
        <Sparkles size={18} className="shrink-0 mt-0.5 text-accent-600" />
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
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowGlossary((v) => !v); }}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-700"
              title="What the values mean"
            >
              <Info size={12} />
            </button>
          </button>

          {/* Inline status row: shows applied state with a one-click undo */}
          <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
            {justApplied ? (
              <div className="inline-flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                <Sparkles size={12} />
                Suggestions applied to control fields — review and edit below.
                <button
                  type="button"
                  onClick={onUndo}
                  className="inline-flex items-center gap-1 ml-1 font-medium underline hover:no-underline"
                >
                  <Undo2 size={11} /> Undo
                </button>
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                Driven by{' '}
                <strong className="text-zinc-700">{s.driver?.name}</strong>
                {s.driver && s.driver.drivingHCodes.length > 0 && (
                  <> ({s.driver.drivingHCodes.join(', ')})</>
                )}.
              </div>
            )}
            <button
              type="button"
              onClick={onApply}
              className="btn-secondary text-xs"
              title="Insert the suggested starter text into the control fields below"
            >
              <Sparkles size={12} />
              {justApplied ? 'Re-apply' : 'Apply suggestion'}
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
                      The highest approach across all substances drives the recommended controls (HSE COSHH Essentials).
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

  const allSubstances = useMemo(
    () => processSteps.flatMap((s) => s.chemicals),
    [processSteps],
  );

  const suggestion = useMemo<OverallSuggestion | null>(
    () => suggestControls(allSubstances),
    [allSubstances],
  );

  // Stable identifier for the current driver+approach, used to gate the
  // one-time auto-apply and to label the active "Applied" banner.
  const suggestionSig = suggestion
    ? `${suggestion.approach}|${suggestion.driver?.substanceId ?? ''}|${suggestion.analyses
        .map((a) => `${a.substanceId}:${a.approach}`)
        .sort()
        .join(',')}`
    : null;

  // Auto-apply the patch once per unique driver signature, and only when the
  // target fields are still empty — so we never silently overwrite an
  // assessor's own work.
  const autoAppliedRef = useRef<string | null>(null);
  const [appliedKey, setAppliedKey] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ControlMeasures | null>(null);

  const applyPatch = (sig: string) => {
    if (!suggestion) return;
    setSnapshot(controls);
    update(suggestion.controlsPatch);
    setAppliedKey(sig);
  };

  const undoPatch = () => {
    if (!snapshot) return;
    update(snapshot);
    setSnapshot(null);
    setAppliedKey(null);
  };

  useEffect(() => {
    if (!suggestion || !suggestionSig) return;
    if (autoAppliedRef.current === suggestionSig) return;
    const fieldsEmpty =
      !controls.elimination.trim() &&
      !controls.substitution.trim() &&
      !controls.reduction.trim() &&
      !controls.engineering.trim() &&
      !controls.administrative.trim() &&
      !controls.ppe.type.trim() &&
      !controls.airMonitoring.trim() &&
      !controls.healthSurveillance.trim();
    if (fieldsEmpty) {
      autoAppliedRef.current = suggestionSig;
      applyPatch(suggestionSig);
    }
    // We intentionally depend only on the suggestion signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionSig]);

  return (
    <section>
      <SectionHeader
        title="Control Measures"
        subtitle="Apply the hierarchy of control. PPE is the last resort. Click a suggested phrase to add it."
      />

      {suggestion && suggestionSig ? (
        <CoshhEssentialsPanel
          s={suggestion}
          signature={suggestionSig}
          appliedKey={appliedKey}
          onApply={() => applyPatch(suggestionSig)}
          onUndo={undoPatch}
        />
      ) : (
        <div className="card p-3 mb-4 text-xs text-zinc-500">
          Add chemicals in <strong>Process Steps</strong> to see COSHH Essentials suggestions here.
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card p-4">
            <SuggestionField
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
          </div>
          <div className="card p-4">
            <SuggestionField
              label="Reduction"
              hint="Reduce quantity, concentration or duration."
              suggestions={REDUCTION_SUGGESTIONS}
              value={controls.reduction}
              onChange={(v) => update({ reduction: v })}
              onAppend={(s) => update({ reduction: append(controls.reduction, s) })}
              placeholder="Record how quantity, concentration, batch size, exposure time, frequency and number of people exposed will be kept as low as practicable."
            />
          </div>
        </div>

        <div className="card p-4">
          <SuggestionField
            label="Engineering Controls"
            hint="LEV, fume hoods, enclosures, interlocks."
            required
            suggestions={ENGINEERING_SUGGESTIONS}
            value={controls.engineering}
            onChange={(v) => update({ engineering: v })}
            onAppend={(s) => update({ engineering: append(controls.engineering, s) })}
            placeholder="Record the physical controls used to prevent or capture exposure, such as enclosure, LEV, fume cupboard, shielding, closed transfer, splash control, interlocks, inspection and maintenance."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card p-4">
            <SuggestionField
              label="Administrative Controls"
              hint="SOPs, training, permits, signage."
              required
              suggestions={ADMIN_SUGGESTIONS}
              value={controls.administrative}
              onChange={(v) => update({ administrative: v })}
              onAppend={(s) => update({ administrative: append(controls.administrative, s) })}
              placeholder="Record procedural controls such as SOP reference, training, briefing, authorisation, supervision, signage, housekeeping, lone-working limits and review triggers."
            />
          </div>
          <div className="card p-4">
            <SuggestionField
              label="PPE"
              hint="Last resort — gloves, eye, RPE."
              required
              suggestions={PPE_TYPE_SUGGESTIONS}
              value={controls.ppe.type}
              onChange={(v) => update({ ppe: { ...controls.ppe, type: v } })}
              onAppend={(s) =>
                update({ ppe: { ...controls.ppe, type: append(controls.ppe.type, s) } })
              }
              placeholder="Record PPE selected for the substance and task: glove material and change frequency, eye/face protection, clothing, footwear and any RPE with fit-test and maintenance requirements."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card p-4">
            <SuggestionField
              label="Air Monitoring"
              required
              suggestions={AIR_MONITORING_SUGGESTIONS}
              value={controls.airMonitoring}
              onChange={(v) => update({ airMonitoring: v })}
              onAppend={(s) => update({ airMonitoring: append(controls.airMonitoring, s) })}
              placeholder="Record whether air monitoring is required, why it is or is not needed, relevant WELs, sampling type, review frequency and triggers for reassessment."
            />
          </div>
          <div className="card p-4">
            <SuggestionField
              label="Health Surveillance"
              required
              suggestions={HEALTH_SURVEILLANCE_SUGGESTIONS}
              value={controls.healthSurveillance}
              onChange={(v) => update({ healthSurveillance: v })}
              onAppend={(s) => update({ healthSurveillance: append(controls.healthSurveillance, s) })}
              placeholder="Record any Occupational Health referral, health-surveillance decision, symptom reporting route, exposure records and review triggers."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
