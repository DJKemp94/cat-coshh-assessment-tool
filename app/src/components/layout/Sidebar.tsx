import clsx from 'clsx';
import {
  ClipboardList,
  AlertTriangle,
  FlaskConical,
  ShieldCheck,
  PackageOpen,
  Users,
  Settings,
  LifeBuoy,
} from 'lucide-react';
import { SectionId, useAssessment } from '@/store/assessment';
import { CatLogo, CatSitting, PawMark } from '@/components/common/CatLogo';

interface NavItem {
  id: SectionId;
  label: string;
  Icon: typeof ClipboardList;
}

const NAV: NavItem[] = [
  { id: 'overview', label: 'Complete Assessment', Icon: ClipboardList },
  { id: 'taskHazards', label: 'Task Hazards', Icon: AlertTriangle },
  { id: 'substances', label: 'Process Steps', Icon: FlaskConical },
  { id: 'controls', label: 'Controls', Icon: ShieldCheck },
  { id: 'additional', label: 'Storage & Emergency', Icon: PackageOpen },
  { id: 'briefing', label: 'Briefing & Sign-off', Icon: Users },
  { id: 'settings', label: 'Settings', Icon: Settings },
  { id: 'help', label: 'Help & Resources', Icon: LifeBuoy },
];

export function Sidebar() {
  const active = useAssessment((s) => s.activeSection);
  const setSection = useAssessment((s) => s.setSection);

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-200 bg-white flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-zinc-100">
        <CatLogo size={48} />
        <div className="leading-tight">
          <div className="font-semibold text-zinc-900 text-lg">CAT</div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            COSHH Assessment Tool
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={clsx(
                'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition text-left',
                isActive
                  ? 'bg-accent-50 text-accent-800 font-medium border border-accent-100'
                  : 'text-zinc-700 hover:bg-zinc-50 border border-transparent',
              )}
            >
              <Icon size={16} className={isActive ? 'text-accent-600' : 'text-zinc-400'} />
              <span className="flex-1">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-5 border-t border-zinc-100 flex items-end gap-3">
        <CatSitting className="w-24 h-24 -mb-2 -ml-1" />
        <div className="text-xs text-zinc-500 leading-snug pb-2 flex-1">
          Stay curious.
          <br />
          Stay safe.
        </div>
        <PawMark className="w-8 h-8 opacity-40 pb-2" />
      </div>
    </aside>
  );
}
