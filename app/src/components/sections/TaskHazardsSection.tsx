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
        title="Non-Chemical Hazards"
        subtitle="One row per hazard. Score before and after controls."
        right={
          <button className="btn-primary" onClick={add}>
            <Plus size={14} /> Add hazard
          </button>
        }
      />

      {hazards.length === 0 ? (
        <div className="card p-6 text-center text-sm text-zinc-500">
          No hazards added yet. Click <strong>Add hazard</strong> to begin.
        </div>
      ) : (
        <div className="space-y-2">
          {hazards.map((h, idx) => (
            <div key={h.id} className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
                  Hazard {idx + 1}
                </div>
                <button
                  className="btn-ghost text-red-600 hover:bg-red-50 !px-2 !py-1"
                  onClick={() => remove(h.id)}
                  aria-label="Remove hazard"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="field-label">What is the hazard?</span>
                  <textarea
                    className="field-textarea !min-h-[56px] text-sm"
                    rows={2}
                    value={h.hazard}
                    onChange={(e) => update(h.id, { hazard: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="field-label">How might harm occur?</span>
                  <textarea
                    className="field-textarea !min-h-[56px] text-sm"
                    rows={2}
                    value={h.harmMechanism}
                    onChange={(e) => update(h.id, { harmMechanism: e.target.value })}
                  />
                </label>

                <div className="rounded-md border border-zinc-200 p-2 bg-zinc-50">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                    Risk evaluation (before controls)
                  </div>
                  <RiskMatrix
                    value={h.riskEvaluation}
                    onChange={(v) => update(h.id, { riskEvaluation: v })}
                  />
                </div>
                <div className="rounded-md border border-zinc-200 p-2 bg-zinc-50">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1.5">
                    Residual risk (with controls)
                  </div>
                  <RiskMatrix
                    value={h.residualRisk}
                    onChange={(v) => update(h.id, { residualRisk: v })}
                  />
                </div>

                <label className="block">
                  <span className="field-label">Control measures in place</span>
                  <textarea
                    className="field-textarea !min-h-[56px] text-sm"
                    rows={2}
                    value={h.controlsInPlace}
                    onChange={(e) => update(h.id, { controlsInPlace: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="field-label">Further action required</span>
                  <textarea
                    className="field-textarea !min-h-[56px] text-sm"
                    rows={2}
                    value={h.furtherAction}
                    onChange={(e) => update(h.id, { furtherAction: e.target.value })}
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
