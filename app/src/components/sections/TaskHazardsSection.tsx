import clsx from 'clsx';
import { Plus, Trash2 } from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { RiskMatrix } from '@/components/common/RiskMatrix';
import { RiskScore, TaskHazard, riskRating } from '@/types/assessment';

const Req = () => <span className="text-red-600 ml-0.5" aria-label="required">*</span>;

export function TaskHazardsSection() {
  const hazards = useAssessment((s) => s.assessment.taskHazards);
  const confirmedNone = useAssessment(
    (s) => s.assessment.taskHazardsConfirmedNone ?? false,
  );
  const add = useAssessment((s) => s.addHazard);
  const update = useAssessment((s) => s.updateHazard);
  const remove = useAssessment((s) => s.removeHazard);
  const setConfirmedNone = useAssessment((s) => s.setTaskHazardsConfirmedNone);

  return (
    <section>
      <SectionHeader
        title="Non-Chemical Hazards"
        subtitle="One row per hazard. Score before and after controls."
        right={
          <button
            className="btn-primary"
            onClick={add}
            disabled={confirmedNone}
            title={confirmedNone ? 'Uncheck "no non-chemical hazards apply" first' : undefined}
          >
            <Plus size={14} /> Add hazard
          </button>
        }
      />

      {hazards.length === 0 && (
        <label className="card p-4 flex items-start gap-3 cursor-pointer hover:bg-zinc-50 transition mb-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirmedNone}
            onChange={(e) => setConfirmedNone(e.target.checked)}
          />
          <div>
            <div className="text-sm font-medium text-zinc-900">
              No non-chemical hazards apply to this task
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              Tick to confirm you have considered slips, manual handling, electrical,
              sharps, etc. and none are relevant. Marks this section complete.
            </div>
          </div>
        </label>
      )}

      {hazards.length === 0 ? (
        !confirmedNone && (
          <div className="card p-6 text-center text-sm text-zinc-500">
            No hazards added yet. Click <strong>Add hazard</strong> to begin, or
            confirm above that none apply.
          </div>
        )
      ) : (
        <div className="space-y-2">
          {hazards.map((h, idx) => (
            <HazardCard
              key={h.id}
              hazard={h}
              index={idx}
              onChange={(patch) => update(h.id, patch)}
              onRemove={() => remove(h.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function HazardCard({
  hazard: h,
  index,
  onChange,
  onRemove,
}: {
  hazard: TaskHazard;
  index: number;
  onChange: (patch: Partial<TaskHazard>) => void;
  onRemove: () => void;
}) {
  const hasRisk = riskRating(h.riskEvaluation) > 0;
  const hasFurtherAction = h.furtherAction.trim().length > 0;
  const missingHazard = h.hazard.trim().length === 0;

  // When the assessor scores the initial risk, mirror it into residualRisk
  // (which they will lower once controls are recorded). Only do this when
  // residualRisk is still 0 — never overwrite their own scoring.
  const setInitialRisk = (v: RiskScore) => {
    const residualUntouched = riskRating(h.residualRisk) === 0;
    onChange(
      residualUntouched
        ? { riskEvaluation: v, residualRisk: v }
        : { riskEvaluation: v },
    );
  };

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
          Hazard {index + 1}
        </div>
        <button
          className="btn-ghost text-red-600 hover:bg-red-50 !px-2 !py-1"
          onClick={onRemove}
          aria-label="Remove hazard"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <label className="block">
          <span className="field-label">What is the hazard?<Req /></span>
          <textarea
            className={clsx('field-textarea !min-h-[56px] text-sm', missingHazard && 'field-missing')}
            rows={2}
            value={h.hazard}
            onChange={(e) => onChange({ hazard: e.target.value })}
            placeholder="Slip, manual handling, electrical, sharps…"
          />
        </label>
        <label className="block">
          <span className="field-label">How might harm occur?</span>
          <textarea
            className="field-textarea !min-h-[56px] text-sm"
            rows={2}
            value={h.harmMechanism}
            onChange={(e) => onChange({ harmMechanism: e.target.value })}
            placeholder="Mechanism of injury and who is exposed."
          />
        </label>

        <div
          className={clsx(
            'rounded-md border p-2',
            hasRisk ? 'border-zinc-200 bg-zinc-50' : 'field-missing',
          )}
        >
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
            Risk evaluation (before controls)<Req />
          </div>
          <RiskMatrix
            value={h.riskEvaluation}
            onChange={setInitialRisk}
          />
        </div>
        <div className="rounded-md border border-zinc-200 p-2 bg-zinc-50">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
            Residual risk (with controls)
            {hasRisk && riskRating(h.residualRisk) > 0 && (
              <span className="ml-1 text-[10px] normal-case tracking-normal text-zinc-400">
                · mirrors initial until lowered
              </span>
            )}
          </div>
          <RiskMatrix
            value={h.residualRisk}
            onChange={(v) => onChange({ residualRisk: v })}
          />
        </div>

        {/* Controls in place and further action only appear once a risk has
            been scored. Keeps the empty card short and focused. */}
        {hasRisk && (
          <>
            <label className="block">
              <span className="field-label">Control measures in place</span>
              <textarea
                className="field-textarea !min-h-[56px] text-sm"
                rows={2}
                value={h.controlsInPlace}
                onChange={(e) => onChange({ controlsInPlace: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="field-label">Further action required</span>
              <textarea
                className="field-textarea !min-h-[56px] text-sm"
                rows={2}
                value={h.furtherAction}
                onChange={(e) => onChange({ furtherAction: e.target.value })}
                placeholder="Leave blank if no further action is needed."
              />
            </label>

            {/* Owner / due-date only matter once there is further action. */}
            {hasFurtherAction && (
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <label className="block">
                  <span className="field-label">Action owner</span>
                  <input
                    className="field-input"
                    value={h.owner}
                    onChange={(e) => onChange({ owner: e.target.value })}
                    placeholder="Who will close this out?"
                  />
                </label>
                <label className="block">
                  <span className="field-label">Due date</span>
                  <input
                    type="date"
                    className="field-input"
                    value={h.dueDate}
                    onChange={(e) => onChange({ dueDate: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="field-label">Completion date</span>
                  <input
                    type="date"
                    className="field-input"
                    value={h.completionDate}
                    onChange={(e) => onChange({ completionDate: e.target.value })}
                  />
                </label>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
