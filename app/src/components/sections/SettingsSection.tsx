import { useState } from 'react';
import { Trash2, RefreshCcw, QrCode } from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { clearPubChemCache } from '@/services/pubchem';
import { QrRecoveryDialog } from '@/components/common/QrRecoveryDialog';

export function SettingsSection() {
  const clearAll = useAssessment((s) => s.clearAllLocalData);
  const reset = useAssessment((s) => s.resetAssessment);
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <section>
      <SectionHeader
        title="Settings"
        subtitle="Privacy controls and local data management."
      />

      <div className="card p-5 space-y-5">
        <div>
          <div className="font-medium text-zinc-900 mb-1">Recovery Code</div>
          <p className="text-xs text-zinc-500 mb-2">
            Print a QR-based offline recovery of the current draft. Useful for paper backup.
          </p>
          <button className="btn-secondary" onClick={() => setQrOpen(true)}>
            <QrCode size={14} /> Open recovery dialog
          </button>
        </div>

        <hr className="border-zinc-100" />

        <div>
          <div className="font-medium text-zinc-900 mb-1">Local data</div>
          <p className="text-xs text-zinc-500 mb-2">
            CAT stores your in-progress draft and PubChem lookups in this browser only.
            Clearing wipes both — your exported files are unaffected.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                clearPubChemCache();
                alert('PubChem cache cleared.');
              }}
            >
              <RefreshCcw size={14} /> Clear PubChem cache
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                if (confirm('Start a new blank assessment? Unsaved changes will be lost.')) reset();
              }}
            >
              <RefreshCcw size={14} /> New blank assessment
            </button>
            <button
              className="btn-secondary text-red-700 border-red-200 hover:bg-red-50"
              onClick={() => {
                if (
                  confirm(
                    'This will delete the current draft and all CAT data in this browser. Continue?',
                  )
                )
                  clearAll();
              }}
            >
              <Trash2 size={14} /> Clear all CAT data
            </button>
          </div>
        </div>

        <hr className="border-zinc-100" />

        <div>
          <div className="font-medium text-zinc-900 mb-1">About</div>
          <p className="text-xs text-zinc-500">
            CAT — COSHH Assessment Tool. Browser-only. No accounts, no online repository.
            <br />
            <span className="italic">Stay curious. Stay safe.</span>
          </p>
        </div>
      </div>

      <QrRecoveryDialog open={qrOpen} onClose={() => setQrOpen(false)} />
    </section>
  );
}
