import clsx from 'clsx';
import {
  ClipboardList,
  AlertTriangle,
  FlaskConical,
  ShieldCheck,
  Database,
  Siren,
  Users,
  Download,
  Check,
  Lock,
} from 'lucide-react';
import { SectionId, useAssessment } from '@/store/assessment';
import { CatLogo, CatSitting, PawMark } from '@/components/common/CatLogo';
import { CoreSectionId, isSectionComplete } from '@/services/completion';

interface NavItem {
  id: Exclude<SectionId, 'settings' | 'help'>;
  label: string;
  Icon: typeof ClipboardList;
}

// Order: the natural fill order. Hazards come before Controls because the
// hazards drive the control measures.
const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', Icon: ClipboardList },
  { id: 'substances', label: 'Process Steps', Icon: FlaskConical },
  { id: 'taskHazards', label: 'Non-Chemical Hazards', Icon: AlertTriangle },
  { id: 'controls', label: 'Controls', Icon: ShieldCheck },
  { id: 'storage', label: 'Storage', Icon: Database },
  { id: 'emergency', label: 'Emergency Response and Waste', Icon: Siren },
  { id: 'briefing', label: 'Briefing & Sign-off', Icon: Users },
  { id: 'completeExport', label: 'Complete & Export', Icon: Download },
];

const CORE_NAV = NAV.filter((n): n is NavItem & { id: CoreSectionId } => n.id !== 'completeExport');

export function Sidebar() {
  const active = useAssessment((s) => s.activeSection);
  const setSection = useAssessment((s) => s.setSection);
  const assessment = useAssessment((s) => s.assessment);
  const testingMode = useAssessment((s) => s.testingMode);

  // A section is "unlocked" if every prior section is complete. The first
  // section is always unlocked. This enforces an ordered fill flow without
  // hiding what's coming next. Testing mode disables the gate entirely.
  const coreCompletion = CORE_NAV.map((n) => isSectionComplete(assessment, n.id));
  const allCoreComplete = coreCompletion.every(Boolean);
  const completedCount = coreCompletion.filter(Boolean).length;
  const unlocked = NAV.map((item) => {
    if (testingMode || item.id === 'overview') return true;
    if (item.id === 'completeExport') return allCoreComplete;
    const coreIndex = CORE_NAV.findIndex((coreItem) => coreItem.id === item.id);
    if (coreIndex < 0) return allCoreComplete;
    return coreCompletion.slice(0, coreIndex).every(Boolean);
  });

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-200 bg-white flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-zinc-100">
        <CatLogo size={48} />
        <div className="leading-tight">
          <div className="font-semibold text-zinc-900 text-lg">LabCAT</div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            COSHH Assessment Tool
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-zinc-500 font-medium flex items-center justify-between">
        <span>Assessment</span>
        <span className="text-zinc-400 normal-case tracking-normal">
          {completedCount} of {CORE_NAV.length}
        </span>
      </div>

      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, Icon }, i) => {
          const isActive = id === active;
          const done = id === 'completeExport'
            ? allCoreComplete
            : isSectionComplete(assessment, id as CoreSectionId);
          const isUnlocked = unlocked[i];
          return (
            <button
              key={id}
              onClick={() => isUnlocked && setSection(id)}
              disabled={!isUnlocked}
              title={
                !isUnlocked
                  ? 'Complete the previous sections to unlock this step'
                  : undefined
              }
              className={clsx(
                'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition text-left',
                isActive
                  ? 'bg-accent-50 text-accent-800 font-medium border border-accent-100'
                  : isUnlocked
                  ? 'text-zinc-700 hover:bg-zinc-50 border border-transparent'
                  : 'text-zinc-400 border border-transparent cursor-not-allowed',
              )}
            >
              <Icon
                size={16}
                className={
                  isActive
                    ? 'text-accent-600'
                    : isUnlocked
                    ? 'text-zinc-400'
                    : 'text-zinc-300'
                }
              />
              <span className="flex-1">{label}</span>
              <StatusDot done={done} locked={!isUnlocked} />
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-5 border-t border-zinc-100 flex items-end gap-3">
        <CatSitting className="w-24 h-24 -mb-2 -ml-1" />
        <div className="text-xs text-zinc-500 leading-snug pb-2 flex-1">
          Please do not
          <br />
          the cat...
        </div>
        <PawMark className="w-8 h-8 opacity-40 pb-2" />
      </div>
    </aside>
  );
}

function StatusDot({ done, locked }: { done: boolean; locked: boolean }) {
  if (done) {
    return (
      <span
        className="w-4 h-4 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shrink-0"
        title="Section complete"
      >
        <Check size={11} strokeWidth={3} />
      </span>
    );
  }
  if (locked) {
    return (
      <span
        className="w-4 h-4 inline-flex items-center justify-center shrink-0 text-zinc-300"
        title="Locked until previous sections are complete"
      >
        <Lock size={11} />
      </span>
    );
  }
  return (
    <span
      className="w-3 h-3 rounded-full border border-zinc-300 shrink-0"
      title="Section pending"
    />
  );
}
