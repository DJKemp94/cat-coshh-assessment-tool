import { FileText, FileType2, Lock, ShieldOff, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PageIntro } from '@/components/common/PageIntro';
import { Modal } from '@/components/common/Modal';
import { ReportPreview } from '@/components/report/ReportPreview';
import { exportDocx } from '@/services/exporters/docx';
import { fullReportOptions, ReportOptions } from '@/services/exporters/reportOptions';
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
  emergency: 'Emergency Response and Waste',
  briefing: 'Briefing & Sign-off',
};

export function CompleteExportSection() {
  const assessment = useAssessment((s) => s.assessment);
  const testingMode = useAssessment((s) => s.testingMode);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportOptions, setReportOptions] = useState<ReportOptions>(() => fullReportOptions());

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
  const setGroup = <K extends keyof ReportOptions>(key: K, include: boolean) => {
    setReportOptions((current) => ({
      ...current,
      [key]: { ...current[key], include },
    }));
  };
  const setOption = <K extends keyof ReportOptions, F extends keyof ReportOptions[K]>(
    key: K,
    field: F,
    value: boolean,
  ) => {
    setReportOptions((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
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

        <ReportSelection
          options={reportOptions}
          onGroup={setGroup}
          onOption={setOption}
          onReset={() => setReportOptions(fullReportOptions())}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            className="btn-primary justify-start"
            disabled={busy !== null || !canExport}
            onClick={() => setPreviewOpen(true)}
            title={canExport ? undefined : 'Complete all sections to export'}
          >
            <FileText size={16} />
            Preview / Save PDF
          </button>
          <button
            className="btn-secondary justify-start"
            disabled={busy !== null || !canExport}
            onClick={() => run('DOCX export', () => exportDocx(assessment, reportOptions))}
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
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Report Preview"
        size="xl"
      >
        <ReportPreview assessment={assessment} options={reportOptions} />
      </Modal>
    </section>
  );
}

type GroupKey = keyof ReportOptions;

const GROUPS: Array<{
  key: GroupKey;
  label: string;
  items: Array<{ key: string; label: string }>;
}> = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      { key: 'details', label: 'Assessment details' },
      { key: 'activityOutline', label: 'Activity outline' },
    ],
  },
  {
    key: 'taskHazards',
    label: 'Non-Chemical Hazards',
    items: [
      { key: 'riskDetails', label: 'Risk scoring' },
      { key: 'actions', label: 'Further actions' },
    ],
  },
  {
    key: 'process',
    label: 'Process Steps',
    items: [
      { key: 'stepControls', label: 'Step controls' },
      { key: 'chemicalDetails', label: 'Chemical details' },
      { key: 'ghsPictograms', label: 'GHS pictograms' },
    ],
  },
  {
    key: 'controls',
    label: 'Controls',
    items: [
      { key: 'coshhScreening', label: 'COSHH screening' },
      { key: 'coshhLegend', label: 'Screening legend' },
      { key: 'hierarchy', label: 'Hierarchy controls' },
    ],
  },
  {
    key: 'storage',
    label: 'Storage',
    items: [],
  },
  {
    key: 'emergency',
    label: 'Emergency Response and Waste',
    items: [
      { key: 'firstAid', label: 'First aid' },
      { key: 'spills', label: 'Spills' },
      { key: 'fire', label: 'Fire' },
      { key: 'waste', label: 'Waste handling' },
      { key: 'other', label: 'Other arrangements' },
    ],
  },
  {
    key: 'briefing',
    label: 'Briefing & Sign-off',
    items: [
      { key: 'signatures', label: 'Signatures' },
    ],
  },
];

function ReportSelection({
  options,
  onGroup,
  onOption,
  onReset,
}: {
  options: ReportOptions;
  onGroup: <K extends keyof ReportOptions>(key: K, include: boolean) => void;
  onOption: <K extends keyof ReportOptions, F extends keyof ReportOptions[K]>(key: K, field: F, value: boolean) => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-4 rounded-md border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2.5">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <SlidersHorizontal size={15} className="text-accent-700" />
          Report contents
        </div>
        <button type="button" className="text-xs text-accent-700 hover:text-accent-900" onClick={onReset}>
          Select all
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
        {GROUPS.map((group) => {
          const groupOptions = options[group.key] as Record<string, boolean>;
          const included = Boolean(groupOptions.include);
          return (
            <div key={group.key} className="rounded-md border border-zinc-200 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={(e) => onGroup(group.key, e.target.checked)}
                  className="h-4 w-4 accent-accent-600"
                />
                {group.label}
              </label>
              {group.items.length > 0 && (
                <div className="mt-2 grid grid-cols-1 gap-1.5 pl-6 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-xs text-zinc-700">
                      <input
                        type="checkbox"
                        checked={Boolean(groupOptions[item.key])}
                        disabled={!included}
                        onChange={(e) => onOption(
                          group.key,
                          item.key as keyof ReportOptions[typeof group.key],
                          e.target.checked,
                        )}
                        className="h-3.5 w-3.5 accent-accent-600 disabled:opacity-50"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
