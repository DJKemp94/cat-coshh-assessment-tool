import { Search, Save, Download } from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { downloadCatdraft } from '@/services/exporters/catdraft';

interface Props {
  onOpenExport: () => void;
}

export function TopBar({ onOpenExport }: Props) {
  const assessment = useAssessment((s) => s.assessment);

  const handleSaveDraft = async () => {
    try {
      await downloadCatdraft(assessment);
    } catch (err) {
      console.error('Save draft failed', err);
      alert('Could not save draft. See console.');
    }
  };

  const title = assessment.overview.activityTitle || 'Generate COSHH Assessment';
  const ref = assessment.overview.riskAssessmentRef;

  return (
    <header className="h-14 shrink-0 border-b border-zinc-200 bg-white flex items-center px-5 gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-zinc-900 truncate">{title}</div>
        <div className="text-[11px] text-zinc-500 truncate">
          {ref ? `Ref ${ref}` : 'New assessment · not yet saved'}
        </div>
      </div>

      <label className="hidden md:flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-md px-2.5 py-1.5 text-sm text-zinc-500 w-72">
        <Search size={14} />
        <input
          type="search"
          placeholder="Search chemicals, sections, hazards"
          className="bg-transparent outline-none flex-1 text-zinc-700 placeholder:text-zinc-400"
        />
      </label>

      <button className="btn-secondary" onClick={handleSaveDraft} title="Download .catdraft">
        <Save size={14} />
        Save Draft
      </button>

      <button className="btn-primary" onClick={onOpenExport}>
        <Download size={14} />
        Export &amp; Recovery
      </button>
    </header>
  );
}
