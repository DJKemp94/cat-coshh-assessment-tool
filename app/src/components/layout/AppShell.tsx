import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ExportRail } from './ExportRail';
import { useAssessment } from '@/store/assessment';
import { OverviewSection } from '@/components/sections/OverviewSection';
import { TaskHazardsSection } from '@/components/sections/TaskHazardsSection';
import { SubstancesSection } from '@/components/sections/SubstancesSection';
import { ControlsSection } from '@/components/sections/ControlsSection';
import { AdditionalSection } from '@/components/sections/AdditionalSection';
import { BriefingSection } from '@/components/sections/BriefingSection';
import { SettingsSection } from '@/components/sections/SettingsSection';
import { HelpSection } from '@/components/sections/HelpSection';
import { PrivacyModal } from '@/components/common/PrivacyModal';

export function AppShell() {
  const section = useAssessment((s) => s.activeSection);
  const ackd = useAssessment((s) => s.privacyAcknowledged);
  const [railOpen, setRailOpen] = useState(true);

  const content = (() => {
    switch (section) {
      case 'overview': return <OverviewSection />;
      case 'taskHazards': return <TaskHazardsSection />;
      case 'substances': return <SubstancesSection />;
      case 'controls': return <ControlsSection />;
      case 'additional': return <AdditionalSection />;
      case 'briefing': return <BriefingSection />;
      case 'settings': return <SettingsSection />;
      case 'help': return <HelpSection />;
    }
  })();

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onOpenExport={() => setRailOpen((v) => !v)} />
          <main className="flex-1 overflow-y-auto bg-zinc-50">
            <div className="max-w-5xl mx-auto p-6">{content}</div>
          </main>
        </div>
        {railOpen && <ExportRail />}
      </div>
      {!ackd && <PrivacyModal />}
    </div>
  );
}
