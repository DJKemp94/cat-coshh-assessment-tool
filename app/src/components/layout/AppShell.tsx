import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ExportRail } from './ExportRail';
import { useAssessment } from '@/store/assessment';
import { OverviewSection } from '@/components/sections/OverviewSection';
import { TaskHazardsSection } from '@/components/sections/TaskHazardsSection';
import { SubstancesSection } from '@/components/sections/SubstancesSection';
import { ControlsSection } from '@/components/sections/ControlsSection';
import { AdditionalSection } from '@/components/sections/AdditionalSection';
import { EmergencySection } from '@/components/sections/EmergencySection';
import { BriefingSection } from '@/components/sections/BriefingSection';
import { SettingsSection } from '@/components/sections/SettingsSection';
import { HelpSection } from '@/components/sections/HelpSection';
import { PrivacyModal } from '@/components/common/PrivacyModal';
import { Modal } from '@/components/common/Modal';

export function AppShell() {
  const section = useAssessment((s) => s.activeSection);
  const setSection = useAssessment((s) => s.setSection);
  const ackd = useAssessment((s) => s.privacyAcknowledged);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Legacy sessions may have a persisted activeSection of 'settings' or 'help';
  // those are now modals, not sections, so redirect to overview.
  useEffect(() => {
    if (section === 'settings' || section === 'help') {
      if (section === 'settings') setSettingsOpen(true);
      if (section === 'help') setHelpOpen(true);
      setSection('overview');
    }
  }, [section, setSection]);

  const content = (() => {
    switch (section) {
      case 'overview': return <OverviewSection />;
      case 'taskHazards': return <TaskHazardsSection />;
      case 'substances': return <SubstancesSection />;
      case 'controls': return <ControlsSection />;
      case 'additional': return <AdditionalSection />;
      case 'emergency': return <EmergencySection />;
      case 'briefing': return <BriefingSection />;
      default: return <OverviewSection />;
    }
  })();

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
          />
          <main className="flex-1 overflow-y-auto bg-zinc-50">
            <div className={`${section === 'additional' || section === 'emergency' ? 'max-w-7xl' : 'max-w-5xl'} mx-auto p-6`}>{content}</div>
          </main>
        </div>
        <ExportRail />
      </div>
      {!ackd && <PrivacyModal />}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings"
        size="md"
      >
        <SettingsSection />
      </Modal>
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Help & resources"
        size="lg"
      >
        <HelpSection />
      </Modal>
    </div>
  );
}
