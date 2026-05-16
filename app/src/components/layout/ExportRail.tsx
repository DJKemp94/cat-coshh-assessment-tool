import { FileText, FileType2, Save, ShieldOff, Upload, Lock } from 'lucide-react';
import { useState } from 'react';
import { useAssessment } from '@/store/assessment';
import { downloadCatdraft, importCatdraftFile } from '@/services/exporters/catdraft';
import { exportPdf } from '@/services/exporters/pdf';
import { exportDocx } from '@/services/exporters/docx';
import { CoreSectionId, isSectionComplete } from '@/services/completion';

// Order must match the Sidebar nav. Final section is the export gate.
const ORDERED_SECTIONS: CoreSectionId[] = [
  'overview',
  'substances',
  'taskHazards',
  'controls',
  'additional',
  'briefing',
];
const FINAL_SECTION: CoreSectionId = 'briefing';

export function ExportRail() {
  const assessment = useAssessment((s) => s.assessment);
  const activeSection = useAssessment((s) => s.activeSection);
  const testingMode = useAssessment((s) => s.testingMode);
  const replace = useAssessment((s) => s.replaceAssessment);
  const [busy, setBusy] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const allComplete = ORDERED_SECTIONS.every((id) => isSectionComplete(assessment, id));
  const onFinalSection = activeSection === FINAL_SECTION;
  const canExport = testingMode || (allComplete && onFinalSection);

  const incompleteSections = ORDERED_SECTIONS.filter(
    (id) => !isSectionComplete(assessment, id),
  );

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
          Export
        </div>
        <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
          Files download to your device — nothing is uploaded.
        </p>
      </div>

      {!canExport && (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 flex gap-2">
          <Lock size={14} className="text-zinc-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-zinc-600 leading-snug">
            {allComplete ? (
              <>
                <span className="font-semibold">Almost there.</span> Open the
                <em> Briefing &amp; Sign-off</em> section to export.
              </>
            ) : (
              <>
                <span className="font-semibold">
                  Complete the assessment to unlock export.
                </span>{' '}
                {incompleteSections.length} section
                {incompleteSections.length === 1 ? '' : 's'} still pending.
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <button
          className="btn-primary w-full justify-start"
          disabled={busy !== null || !canExport}
          onClick={() => run('PDF export', () => exportPdf(assessment))}
          title={canExport ? undefined : 'Complete all sections and open Briefing & Sign-off to export'}
        >
          <FileText size={14} />
          Export PDF
        </button>
        <button
          className="btn-secondary w-full justify-start"
          disabled={busy !== null || !canExport}
          onClick={() => run('DOCX export', () => exportDocx(assessment))}
          title={canExport ? undefined : 'Complete all sections and open Briefing & Sign-off to export'}
        >
          <FileType2 size={14} />
          Export DOCX
        </button>
      </div>

      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        className="mt-4 text-[11px] uppercase tracking-wider text-zinc-500 font-medium hover:text-zinc-700"
      >
        {moreOpen ? '− Hide' : '+ More'} backup options
      </button>

      {moreOpen && (
        <div className="mt-2 space-y-2">
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
        </div>
      )}

      <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2">
        <ShieldOff size={16} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-900 leading-snug">
          <span className="font-semibold">You are the only copy.</span> Clearing browser data will erase any unsaved draft — export regularly.
        </div>
      </div>

      {busy && (
        <div className="mt-4 text-xs text-zinc-500">Working: {busy}…</div>
      )}
    </aside>
  );
}
