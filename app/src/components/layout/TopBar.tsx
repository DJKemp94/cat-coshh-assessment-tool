import { FilePlus2, Settings as SettingsIcon, HelpCircle, Save, Upload } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useAssessment } from '@/store/assessment';
import { downloadCatdraft, importCatdraftFile } from '@/services/exporters/catdraft';

interface Props {
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export function TopBar({ onOpenSettings, onOpenHelp }: Props) {
  const assessment = useAssessment((s) => s.assessment);
  const replace = useAssessment((s) => s.replaceAssessment);
  const reset = useAssessment((s) => s.resetAssessment);
  const [busy, setBusy] = useState<string | null>(null);

  const title = assessment.overview.activityOutline || 'New COSHH Assessment';
  const ref = assessment.overview.riskAssessmentRef;

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

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.currentTarget;
    run('Import', async () => {
      try {
        const imported = await importCatdraftFile(file);
        replace(imported);
      } finally {
        input.value = '';
      }
    });
  };

  const handleNewAssessment = () => {
    const confirmed = window.confirm(
      'Starting a new assessment will clear the current assessment from this browser. A .catdraft backup will download first so you can restore it later. Continue?',
    );
    if (!confirmed) return;
    run('New assessment', async () => {
      await downloadCatdraft(assessment);
      reset();
    });
  };

  return (
    <header className="h-14 shrink-0 border-b border-zinc-200 bg-white flex items-center px-5 gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-zinc-900 truncate">{title}</div>
        <div className="text-[11px] text-zinc-500 truncate">
          {ref ? `Ref ${ref}` : 'Draft auto-saves in this browser'}
        </div>
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
        disabled={busy !== null}
        onClick={handleNewAssessment}
        title="Download a catdraft backup and start a new assessment"
      >
        <FilePlus2 size={14} />
        <span className="hidden md:inline">New assessment</span>
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
        disabled={busy !== null}
        onClick={() => run('Draft download', () => downloadCatdraft(assessment))}
        title="Download .catdraft backup"
      >
        <Save size={14} />
        <span className="hidden md:inline">Download catdraft</span>
      </button>
      <label
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
        title="Import .catdraft backup"
      >
        <Upload size={14} />
        <span className="hidden md:inline">Import catdraft</span>
        <input
          type="file"
          accept=".catdraft,text/plain"
          className="hidden"
          disabled={busy !== null}
          onChange={handleImport}
        />
      </label>
      <button
        type="button"
        className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded p-1.5 transition"
        onClick={onOpenSettings}
        title="Settings"
        aria-label="Open settings"
      >
        <SettingsIcon size={16} />
      </button>
      <button
        type="button"
        className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded p-1.5 transition"
        onClick={onOpenHelp}
        title="Help & resources"
        aria-label="Open help"
      >
        <HelpCircle size={16} />
      </button>
    </header>
  );
}
