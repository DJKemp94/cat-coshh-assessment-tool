import { ShieldCheck } from 'lucide-react';
import { useAssessment } from '@/store/assessment';

export function PrivacyModal() {
  const ack = useAssessment((s) => s.acknowledgePrivacy);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card max-w-lg w-full p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-50 text-accent-700 flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Before you start — privacy first
          </h2>
        </div>

        <div className="mt-4 space-y-3 text-sm text-zinc-700 leading-relaxed">
          <p>
            LabCAT is a <strong>browser-only</strong> tool. It does not host accounts and is not
            an online repository of assessments.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-600">
            <li>Your assessment lives in this browser only.</li>
            <li>
              Export PDF, DOCX or <code>.labcatdraft</code> regularly — clearing site data will
              erase any unsaved work.
            </li>
            <li>
              Only chemical names you choose to look up are sent to PubChem. No assessment
              content ever leaves your device.
            </li>
            <li>You are responsible for storing exported files securely.</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="btn-primary" onClick={ack}>
            I understand — start assessment
          </button>
        </div>
      </div>
    </div>
  );
}
