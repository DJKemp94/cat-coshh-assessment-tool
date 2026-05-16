import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Plus, Trash2, ClipboardPaste, PenLine, X } from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { SignaturePad } from '@/components/common/SignaturePad';
import { emptyBriefing, todayISO } from '@/types/assessment';

export function BriefingSection() {
  const briefing = useAssessment((s) => s.assessment.briefing);
  const setAssessment = useAssessment((s) => s.replaceAssessment);
  const assessment = useAssessment((s) => s.assessment);
  const add = useAssessment((s) => s.addBriefing);
  const update = useAssessment((s) => s.updateBriefing);
  const remove = useAssessment((s) => s.removeBriefing);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkValue, setBulkValue] = useState('');

  // Names already entered, used for the per-row datalist autocomplete.
  const knownNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const b of briefing) {
      const n = b.name.trim();
      if (n && !seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        out.push(n);
      }
    }
    return out;
  }, [briefing]);

  const handleBulkAdd = () => {
    const names = bulkValue
      .split(/\r?\n/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const today = todayISO();
    const newEntries = names.map((name) => ({ ...emptyBriefing(), name, date: today }));
    setAssessment({
      ...assessment,
      briefing: [...assessment.briefing, ...newEntries],
    });
    setBulkValue('');
    setBulkOpen(false);
  };

  return (
    <section>
      <SectionHeader
        title="Briefing Record"
        subtitle="Each worker confirms they have been briefed on this assessment."
        right={
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={() => setBulkOpen((v) => !v)}
              title="Paste a list of names"
            >
              <ClipboardPaste size={14} /> Bulk add
            </button>
            <button className="btn-primary" onClick={add}>
              <Plus size={14} /> Add worker
            </button>
          </div>
        }
      />

      {bulkOpen && (
        <div className="card p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-zinc-800">Bulk add briefing entries</div>
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-800"
              onClick={() => setBulkOpen(false)}
              aria-label="Close bulk add"
            >
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-2">
            Paste one name per line. Today&apos;s date is set on each new entry — you can adjust afterwards.
          </p>
          <textarea
            className="field-textarea text-sm"
            rows={6}
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder={'Sarah Patel\nJoe Smith\nKai Nakamura'}
            autoFocus
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button className="btn-ghost text-sm" onClick={() => setBulkOpen(false)}>Cancel</button>
            <button
              className="btn-primary text-sm"
              onClick={handleBulkAdd}
              disabled={!bulkValue.trim()}
            >
              <Plus size={14} /> Add {bulkValue.split(/\r?\n/).filter((s) => s.trim()).length || ''} entr{bulkValue.split(/\r?\n/).filter((s) => s.trim()).length === 1 ? 'y' : 'ies'}
            </button>
          </div>
        </div>
      )}

      {briefing.length === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-500">
          No briefing entries yet.
        </div>
      ) : (
        <>
          <datalist id="briefing-names">
            {knownNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div className="space-y-3">
            {briefing.map((b, idx) => (
              <BriefingRow
                key={b.id}
                index={idx}
                name={b.name}
                date={b.date}
                signaturePng={b.signaturePng}
                onChange={(patch) => update(b.id, patch)}
                onRemove={() => remove(b.id)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function BriefingRow({
  index,
  name,
  date,
  signaturePng,
  onChange,
  onRemove,
}: {
  index: number;
  name: string;
  date: string;
  signaturePng?: string;
  onChange: (patch: { name?: string; date?: string; signaturePng?: string }) => void;
  onRemove: () => void;
}) {
  const [signing, setSigning] = useState(Boolean(signaturePng));

  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
          Entry {index + 1}
        </div>
        <button
          className="btn-ghost text-red-600 hover:bg-red-50 !px-2 !py-1"
          onClick={onRemove}
          aria-label="Remove entry"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="md:col-span-2">
          <span className="field-label">
            Name of worker <span className="text-red-600">*</span>
          </span>
          <input
            className={clsx('field-input', !name.trim() && 'field-missing')}
            value={name}
            list="briefing-names"
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Full name"
          />
        </label>
        <label>
          <span className="field-label">Date</span>
          <input
            type="date"
            className="field-input"
            value={date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </label>
        <div className="md:col-span-3">
          {!signing && !signaturePng ? (
            <button
              type="button"
              className="btn-ghost text-xs text-accent-700 hover:bg-accent-50 !px-2 !py-1"
              onClick={() => setSigning(true)}
            >
              <PenLine size={12} /> Add signature (optional)
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="field-label">Signature</span>
                <button
                  type="button"
                  className="btn-ghost text-xs text-zinc-500 hover:bg-zinc-100 !px-2 !py-0"
                  onClick={() => { onChange({ signaturePng: undefined }); setSigning(false); }}
                >
                  Hide
                </button>
              </div>
              <SignaturePad
                value={signaturePng}
                onChange={(png) => onChange({ signaturePng: png })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
