import clsx from 'clsx';
import { Flag, Plus, ShieldCheck, Trash2 } from 'lucide-react';
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
        subtitle="Add and assess non-chemical hazards present in the workplace."
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
        <div className="space-y-4">
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
  const tone = index % 2 === 0 ? 'indigo' : 'emerald';

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
    <div className={clsx('hazard-card', `hazard-card-${tone}`)}>
      <div className="hazard-card-header">
        <div className="flex items-center gap-4">
          <span className={clsx('hazard-badge', `hazard-badge-${tone}`)}>
            <ShieldCheck size={22} strokeWidth={2.8} />
          </span>
          <div className="text-sm uppercase tracking-wide font-extrabold text-slate-800">
            Hazard
          </div>
          <span className={clsx('hazard-index', `hazard-index-${tone}`)}>{index + 1}</span>
        </div>
        <button
          className="hazard-delete"
          onClick={onRemove}
          aria-label="Remove hazard"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="hazard-card-body">
        <label className="block">
          <span className="hazard-field-label">What is the hazard?<Req /></span>
          <textarea
            className={clsx('hazard-textarea', missingHazard && 'field-missing')}
            rows={2}
            value={h.hazard}
            onChange={(e) => onChange({ hazard: e.target.value })}
            placeholder="e.g. Slip, manual handling, electrical, sharps..."
          />
        </label>
        <label className="block">
          <span className="hazard-field-label">How might harm occur?</span>
          <textarea
            className="hazard-textarea"
            rows={2}
            value={h.harmMechanism}
            onChange={(e) => onChange({ harmMechanism: e.target.value })}
            placeholder="e.g. Mechanism of injury and who is exposed."
          />
        </label>

        <div
          className={clsx(
            'hazard-risk-panel hazard-risk-initial',
            !hasRisk && 'field-missing',
          )}
        >
          <div className="hazard-panel-heading">
            <span className="hazard-panel-icon hazard-panel-icon-amber">
              <ShieldCheck size={18} />
            </span>
            <span>Risk evaluation (before controls)<Req /></span>
          </div>
          <RiskMatrix
            value={h.riskEvaluation}
            onChange={setInitialRisk}
          />
        </div>
        <div className="hazard-risk-panel hazard-risk-residual">
          <div className="hazard-panel-heading">
            <span className="hazard-panel-icon hazard-panel-icon-indigo">
              <ShieldCheck size={18} />
            </span>
            <span>
              Residual risk (with controls)
            {hasRisk && riskRating(h.residualRisk) > 0 && (
              <span className="ml-1 font-medium text-slate-400">
                · mirrors initial until lowered
              </span>
            )}
            </span>
          </div>
          <RiskMatrix
            value={h.residualRisk}
            onChange={(v) => onChange({ residualRisk: v })}
          />
        </div>

        <label className="hazard-mini-panel">
          <span className="hazard-panel-icon hazard-panel-icon-purple">
            <ShieldCheck size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="hazard-field-label mb-0">Control measures in place</span>
            <textarea
              className="hazard-inline-textarea"
              rows={1}
              value={h.controlsInPlace}
              onChange={(e) => onChange({ controlsInPlace: e.target.value })}
              placeholder="e.g. What controls are currently in place?"
            />
          </span>
        </label>
        <label className="hazard-mini-panel">
          <span className="hazard-panel-icon hazard-panel-icon-plain">
            <Flag size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="hazard-field-label mb-0">Further action required</span>
            <textarea
              className="hazard-inline-textarea"
              rows={1}
              value={h.furtherAction}
              onChange={(e) => onChange({ furtherAction: e.target.value })}
              placeholder="e.g. Leave blank if no further action is needed."
            />
          </span>
        </label>

        {hasFurtherAction && (
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="hazard-field-label">Action owner</span>
              <input
                className="field-input"
                value={h.owner}
                onChange={(e) => onChange({ owner: e.target.value })}
                placeholder="Who will close this out?"
              />
            </label>
            <label className="block">
              <span className="hazard-field-label">Due date</span>
              <input
                type="date"
                className="field-input"
                value={h.dueDate}
                onChange={(e) => onChange({ dueDate: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="hazard-field-label">Completion date</span>
              <input
                type="date"
                className="field-input"
                value={h.completionDate}
                onChange={(e) => onChange({ completionDate: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
