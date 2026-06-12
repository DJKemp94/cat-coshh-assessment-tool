import { Trash2, RefreshCcw } from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { clearPubChemCache } from '@/services/pubchem';

/**
 * Settings content — rendered inside the top-bar Modal. No SectionHeader
 * because the Modal supplies its own title bar.
 */
export function SettingsSection() {
  const clearAll = useAssessment((s) => s.clearAllLocalData);
  const reset = useAssessment((s) => s.resetAssessment);
  const testingMode = useAssessment((s) => s.testingMode);
  const setTestingMode = useAssessment((s) => s.setTestingMode);

  return (
    <div className="space-y-5">
      <div>
        <div className="font-medium text-zinc-900 mb-1">Testing mode</div>
        <p className="text-xs text-zinc-500 mb-2">
          Allows jumping to any section regardless of completion order, and
          enables Export PDF / DOCX even when sections are incomplete. Use while
          trialling the tool; turn off for live assessments.
        </p>
        <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-zinc-800">
          <input
            type="checkbox"
            checked={testingMode}
            onChange={(e) => setTestingMode(e.target.checked)}
          />
          Unlock all sections (testing)
        </label>
      </div>

      <hr className="border-zinc-100" />

      <div>
        <div className="font-medium text-zinc-900 mb-1">Local data</div>
        <p className="text-xs text-zinc-500 mb-2">
          LabCAT stores your in-progress draft and PubChem lookups in this browser only.
          Clearing wipes both; your exported files are unaffected.
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
                  'This will delete the current draft and all LabCAT data in this browser. Continue?',
                )
              )
                clearAll();
            }}
          >
            <Trash2 size={14} /> Clear all LabCAT data
          </button>
        </div>
      </div>

      <hr className="border-zinc-100" />

      <div>
        <div className="font-medium text-zinc-900 mb-1">About</div>
        <p className="text-xs text-zinc-500">
          LabCAT - COSHH Assessment Tool. Browser-only. No accounts, no online repository.
          <br />
          <span className="inline-block whitespace-nowrap italic">Please do not the cat.</span>
        </p>
      </div>
    </div>
  );
}
