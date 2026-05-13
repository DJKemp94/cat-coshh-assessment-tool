import { FileText, FileType2, Save, QrCode, ShieldOff, Upload } from 'lucide-react';
import { useState } from 'react';
import { useAssessment } from '@/store/assessment';
import { downloadCatdraft, importCatdraftFile } from '@/services/exporters/catdraft';
import { exportPdf } from '@/services/exporters/pdf';
import { exportDocx } from '@/services/exporters/docx';

export function ExportRail() {
  const assessment = useAssessment((s) => s.assessment);
  const replace = useAssessment((s) => s.replaceAssessment);
  const setSection = useAssessment((s) => s.setSection);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void> | void) => {
    setBusy(label);
    try {
      await fn();
    } catch (err) {
      console.error(`${label} failed`, err);
      alert(`${label} failed. See console.`);
    } finally {
      setBusy(null);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    run('Import', async () => {
      const imported = await importCatdraftFile(file);
      replace(imported);
      e.target.value = '';
    });
  };

  return (
    <aside className="w-80 shrink-0 border-l border-zinc-200 bg-white p-5 overflow-y-auto h-full">
      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
          Export &amp; Recovery
        </div>
        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
          Choose a format. Files download to your device — nothing is uploaded.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <button
          className="btn-secondary w-full justify-start"
          disabled={busy !== null}
          onClick={() => run('PDF export', () => exportPdf(assessment))}
        >
          <FileText size={14} />
          Export PDF
        </button>
        <button
          className="btn-secondary w-full justify-start"
          disabled={busy !== null}
          onClick={() => run('DOCX export', () => exportDocx(assessment))}
        >
          <FileType2 size={14} />
          Export DOCX
        </button>
        <button
          className="btn-secondary w-full justify-start"
          disabled={busy !== null}
          onClick={() => run('Draft download', () => downloadCatdraft(assessment))}
        >
          <Save size={14} />
          Download .catdraft
        </button>
        <label className="btn-secondary w-full justify-start cursor-pointer">
          <Upload size={14} />
          Import .catdraft
          <input
            type="file"
            accept=".catdraft,text/plain"
            className="hidden"
            onChange={handleImport}
          />
        </label>
        <button
          className="btn-secondary w-full justify-start"
          onClick={() => setSection('settings')}
        >
          <QrCode size={14} />
          Recovery Code (Print or Scan)
        </button>
      </div>

      <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2">
        <ShieldOff size={16} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-900 leading-snug">
          <div className="font-semibold">No online repository.</div>
          You are the only copy. Save and export your work regularly — clearing browser data
          will erase any unsaved draft.
        </div>
      </div>

      {busy && (
        <div className="mt-4 text-xs text-zinc-500">Working: {busy}…</div>
      )}
    </aside>
  );
}
