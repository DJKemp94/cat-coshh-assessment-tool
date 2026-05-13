import { Plus, Trash2 } from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { SignaturePad } from '@/components/common/SignaturePad';

export function BriefingSection() {
  const briefing = useAssessment((s) => s.assessment.briefing);
  const add = useAssessment((s) => s.addBriefing);
  const update = useAssessment((s) => s.updateBriefing);
  const remove = useAssessment((s) => s.removeBriefing);

  return (
    <section>
      <SectionHeader
        title="Briefing Record"
        subtitle="Each worker confirms they have been briefed on this assessment."
        right={
          <button className="btn-primary" onClick={add}>
            <Plus size={14} /> Add worker
          </button>
        }
      />

      {briefing.length === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-500">
          No briefing entries yet.
        </div>
      ) : (
        <div className="space-y-3">
          {briefing.map((b, idx) => (
            <div key={b.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                  Entry {idx + 1}
                </div>
                <button
                  className="btn-ghost text-red-600 hover:bg-red-50"
                  onClick={() => remove(b.id)}
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label>
                  <span className="field-label">
                    Name of worker <span className="text-red-600">*</span>
                  </span>
                  <input
                    className="field-input"
                    value={b.name}
                    onChange={(e) => update(b.id, { name: e.target.value })}
                  />
                </label>
                <label>
                  <span className="field-label">Date</span>
                  <input
                    type="date"
                    className="field-input"
                    value={b.date}
                    onChange={(e) => update(b.id, { date: e.target.value })}
                  />
                </label>
                <div className="md:col-span-2">
                  <span className="field-label">Signature (optional)</span>
                  <SignaturePad
                    value={b.signaturePng}
                    onChange={(png) => update(b.id, { signaturePng: png })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
