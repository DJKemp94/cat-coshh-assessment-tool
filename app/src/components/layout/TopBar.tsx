import { Settings as SettingsIcon, HelpCircle } from 'lucide-react';
import { useAssessment } from '@/store/assessment';

interface Props {
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export function TopBar({ onOpenSettings, onOpenHelp }: Props) {
  const assessment = useAssessment((s) => s.assessment);

  const title = assessment.overview.activityTitle || 'New COSHH Assessment';
  const ref = assessment.overview.riskAssessmentRef;

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
