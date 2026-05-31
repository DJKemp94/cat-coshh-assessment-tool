import { FileText, FileType2, Lock, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PageIntro } from '@/components/common/PageIntro';
import { exportPdf } from '@/services/exporters/pdf';
import { exportDocx } from '@/services/exporters/docx';
import { CoreSectionId, isSectionComplete } from '@/services/completion';

const ORDERED_SECTIONS: CoreSectionId[] = [
  'overview',
  'substances',
  'taskHazards',
  'controls',
  'additional',
  'emergency',
  'briefing',
];

const SECTION_LABELS: Record<CoreSectionId, string> = {
  overview: 'Overview',
  substances: 'Process Steps',
  taskHazards: 'Non-Chemical Hazards',
  controls: 'Controls',
  additional: 'Storage',
  emergency: 'Emergency Response',
  briefing: 'Briefing & Sign-off',
};

export function CompleteExportSection() {
  const assessment = useAssessment((s) => s.assessment);
  const testingMode = useAssessment((s) => s.testingMode);
  const [busy, setBusy] = useState<string | null>(null);

  const incompleteSections = ORDERED_SECTIONS.filter(
    (id) => !isSectionComplete(assessment, id),
  );
  const canExport = testingMode || incompleteSections.length === 0;

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

  return (
    <section>
      <SectionHeader
        title="Complete & Export"
        subtitle="Export the finished COSHH assessment as PDF or DOCX."
      />

      <PageIntro
        body="Use this page as the final check before downloading the assessment. Export is available once the required sections are complete."
        steps={[
          { title: '1. Resolve pending sections', body: 'Use the list below to see what still needs attention before export unlocks.' },
          { title: '2. Export the file', body: 'Download a PDF or DOCX copy for your records, briefing pack or approval route.' },
          { title: '3. Keep a backup', body: 'Use the catdraft controls in the top bar if you need to restore or continue the draft later.' },
        ]}
      />

      <div className="card p-5">
        {!canExport && (
          <div className="mb-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 flex gap-2">
            <Lock size={15} className="mt-0.5 shrink-0 text-zinc-500" />
            <div className="text-xs leading-relaxed text-zinc-600">
              <span className="font-semibold text-zinc-800">Complete the assessment to unlock export.</span>{' '}
              {incompleteSections.length} section{incompleteSections.length === 1 ? '' : 's'} still pending:
              <span className="ml-1">{incompleteSections.map((id) => SECTION_LABELS[id]).join(', ')}.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            className="btn-primary justify-start"
            disabled={busy !== null || !canExport}
            onClick={() => run('PDF export', () => exportPdf(assessment))}
            title={canExport ? undefined : 'Complete all sections to export'}
          >
            <FileText size={16} />
            Export PDF
          </button>
          <button
            className="btn-secondary justify-start"
            disabled={busy !== null || !canExport}
            onClick={() => run('DOCX export', () => exportDocx(assessment))}
            title={canExport ? undefined : 'Complete all sections to export'}
          >
            <FileType2 size={16} />
            Export DOCX
          </button>
        </div>

        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2">
          <ShieldOff size={16} className="mt-0.5 shrink-0 text-amber-700" />
          <div className="text-[11px] leading-snug text-amber-900">
            <span className="font-semibold">Files download to your device.</span> Nothing is uploaded. Use the catdraft controls in the top bar for draft backup and restore.
          </div>
        </div>

        {busy && <div className="mt-4 text-xs text-zinc-500">Working: {busy}...</div>}
      </div>
    </section>
  );
}
