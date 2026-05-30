import { useState } from 'react';
import clsx from 'clsx';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Plus, ShieldCheck, Trash2,
} from 'lucide-react';
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
  const hasResidualRisk = riskRating(h.residualRisk) > 0;
  const hasFurtherAction = h.furtherAction.trim().length > 0;
  const missingHazard = h.hazard.trim().length === 0;
  const missingHarmMechanism = h.harmMechanism.trim().length === 0;
  const missingControls = h.controlsInPlace.trim().length === 0;
  const missingOwner = hasFurtherAction && h.owner.trim().length === 0;
  const missingDueDate = hasFurtherAction && h.dueDate.trim().length === 0;
  const missingCompletionDate = hasFurtherAction && h.completionDate.trim().length === 0;
  const [collapsed, setCollapsed] = useState(false);
  const isComplete =
    h.hazard.trim().length > 0 &&
    h.harmMechanism.trim().length > 0 &&
    hasRisk &&
    hasResidualRisk &&
    h.controlsInPlace.trim().length > 0 &&
    (!hasFurtherAction || (!missingOwner && !missingDueDate && !missingCompletionDate));
  const headerTitle = h.hazard.trim();
  const initialRisk = riskRating(h.riskEvaluation);

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
    <div className="hazard-card">
      <div
        className="flex items-center gap-4 border-l-4 border-l-accent-600 border-b border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50"
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed((v) => !v);
          }
        }}
        aria-expanded={!collapsed}
      >
        <div
          className="shrink-0 w-8 h-8 rounded-full text-sm font-semibold flex items-center justify-center shadow-soft bg-accent-600 text-white"
        >
          {index + 1}
        </div>
        <span className="min-w-0 truncate text-sm font-semibold text-accent-700">
          {headerTitle || <span className="italic text-zinc-400">No description</span>}
        </span>
        <span className="hidden sm:inline text-sm text-zinc-500">
          {initialRisk > 0 ? `${initialRisk} initial risk` : 'Risk not scored'}
        </span>
        <div className="flex-1" />
        {isComplete ? (
          <span className="hidden sm:inline-flex items-center gap-1 text-emerald-700 text-[11px] font-medium shrink-0">
            <CheckCircle2 size={14} /> Complete
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1 text-amber-700 text-[11px] font-medium shrink-0">
            <AlertCircle size={14} /> Incomplete
          </span>
        )}
        {collapsed ? (
          <ChevronDown size={16} className="text-zinc-600 shrink-0" />
        ) : (
          <ChevronUp size={16} className="text-zinc-600 shrink-0" />
        )}
        <button
          className="hazard-delete"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove hazard"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {!collapsed && <div className="hazard-card-body">
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
          <span className="hazard-field-label">How might harm occur?<Req /></span>
          <textarea
            className={clsx('hazard-textarea', missingHarmMechanism && 'field-missing')}
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
            compact
          />
        </div>
        <div
          className={clsx(
            'hazard-risk-panel hazard-risk-residual',
            !hasResidualRisk && 'field-missing',
          )}
        >
          <div className="hazard-panel-heading">
            <span className="hazard-panel-icon hazard-panel-icon-indigo">
              <ShieldCheck size={18} />
            </span>
            <span>
              Residual risk (with controls)<Req />
            {hasRisk && riskRating(h.residualRisk) > 0 && (
              <span className="ml-1 font-medium text-zinc-400">
                · mirrors initial until lowered
              </span>
            )}
            </span>
          </div>
          <RiskMatrix
            value={h.residualRisk}
            onChange={(v) => onChange({ residualRisk: v })}
            compact
          />
        </div>

        <label className="block">
          <span className="hazard-field-label">Control measures in place<Req /></span>
          <textarea
            className={clsx('field-textarea !min-h-[56px]', missingControls && 'field-missing')}
            rows={2}
            value={h.controlsInPlace}
            onChange={(e) => onChange({ controlsInPlace: e.target.value })}
            placeholder="e.g. What controls are currently in place?"
          />
        </label>
        <label className="block">
          <span className="hazard-field-label">Further action required</span>
          <textarea
            className="field-textarea !min-h-[56px]"
            rows={2}
            value={h.furtherAction}
            onChange={(e) => onChange({ furtherAction: e.target.value })}
            placeholder="e.g. Leave blank if no further action is needed."
          />
        </label>

        {hasFurtherAction && (
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="hazard-field-label">Action owner<Req /></span>
              <input
                className={clsx('field-input', missingOwner && 'field-missing')}
                value={h.owner}
                onChange={(e) => onChange({ owner: e.target.value })}
                placeholder="Who will close this out?"
              />
            </label>
            <label className="block">
              <span className="hazard-field-label">Due date<Req /></span>
              <input
                type="date"
                className={clsx('field-input', missingDueDate && 'field-missing')}
                value={h.dueDate}
                onChange={(e) => onChange({ dueDate: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="hazard-field-label">Completion date<Req /></span>
              <input
                type="date"
                className={clsx('field-input', missingCompletionDate && 'field-missing')}
                value={h.completionDate}
                onChange={(e) => onChange({ completionDate: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>}
    </div>
  );
}
