import { Plus, Trash2 } from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { RiskMatrix } from '@/components/common/RiskMatrix';

export function TaskHazardsSection() {
  const hazards = useAssessment((s) => s.assessment.taskHazards);
  const add = useAssessment((s) => s.addHazard);
  const update = useAssessment((s) => s.updateHazard);
  const remove = useAssessment((s) => s.removeHazard);

  return (
    <section>
      <SectionHeader
        title="Task Hazards"
        subtitle="One row per hazard. Score before and after controls."
        right={
          <button className="btn-primary" onClick={add}>
            <Plus size={14} /> Add hazard
          </button>
        }
      />

      {hazards.length === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-500">
          No hazards added yet. Click <strong>Add hazard</strong> to begin.
        </div>
      ) : (
        <div className="space-y-3">
          {hazards.map((h, idx) => (
            <div key={h.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                  Hazard {idx + 1}
                </div>
                <button
                  className="btn-ghost text-red-600 hover:bg-red-50"
                  onClick={() => remove(h.id)}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="field-label">What is the hazard?</span>
                  <textarea
                    className="field-textarea"
                    value={h.hazard}
                    onChange={(e) => update(h.id, { hazard: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="field-label">How might harm occur?</span>
                  <textarea
                    className="field-textarea"
                    value={h.harmMechanism}
                    onChange={(e) => update(h.id, { harmMechanism: e.target.value })}
                  />
                </label>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="rounded-md border border-zinc-200 p-3 bg-zinc-50">
                    <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                      Risk evaluation (before controls)
                    </div>
                    <RiskMatrix
                      value={h.riskEvaluation}
                      onChange={(v) => update(h.id, { riskEvaluation: v })}
                    />
                  </div>
                  <div className="rounded-md border border-zinc-200 p-3 bg-zinc-50">
                    <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
                      Residual risk (with controls)
                    </div>
                    <RiskMatrix
                      value={h.residualRisk}
                      onChange={(v) => update(h.id, { residualRisk: v })}
                    />
                  </div>
                </div>

                <label className="block md:col-span-2">
                  <span className="field-label">Control measures in place</span>
                  <textarea
                    className="field-textarea"
                    value={h.controlsInPlace}
                    onChange={(e) => update(h.id, { controlsInPlace: e.target.value })}
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="field-label">Further action required</span>
                  <textarea
                    className="field-textarea"
                    value={h.furtherAction}
                    onChange={(e) => update(h.id, { furtherAction: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="field-label">Owner</span>
                  <input
                    className="field-input"
                    value={h.owner}
                    onChange={(e) => update(h.id, { owner: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="field-label">Due date</span>
                  <input
                    type="date"
                    className="field-input"
                    value={h.dueDate}
                    onChange={(e) => update(h.id, { dueDate: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="field-label">Action completion date</span>
                  <input
                    type="date"
                    className="field-input"
                    value={h.completionDate}
                    onChange={(e) => update(h.id, { completionDate: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
