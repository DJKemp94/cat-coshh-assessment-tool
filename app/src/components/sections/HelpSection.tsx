import { ExternalLink, ShieldCheck, FlaskConical, Save } from 'lucide-react';

export function HelpSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={16} className="text-accent-700" />
          <div className="font-medium text-zinc-900">Privacy model</div>
        </div>
        <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-1">
          <li>Your assessment lives in this browser only. No server, no account.</li>
          <li>Only chemical names you look up are sent to PubChem.</li>
          <li>Exported files are yours to store securely.</li>
        </ul>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical size={16} className="text-accent-700" />
          <div className="font-medium text-zinc-900">UK WEL / STEL / TWA</div>
        </div>
        <p className="text-sm text-zinc-700">
          UK Workplace Exposure Limits are published in HSE <strong>EH40/2005</strong>.
          LabCAT pre-fills TWA / STEL values from its bundled EH40 dataset when a chemical
          is looked up — always verify them against the current EH40 edition and enter
          values manually for substances it does not cover.
        </p>
        <a
          className="mt-2 inline-flex items-center gap-1 text-sm text-accent-700 hover:underline"
          href="https://www.hse.gov.uk/pubns/books/eh40.htm"
          target="_blank"
          rel="noreferrer"
        >
          HSE EH40 reference <ExternalLink size={12} />
        </a>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Save size={16} className="text-accent-700" />
          <div className="font-medium text-zinc-900">Saving your work</div>
        </div>
        <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-1">
          <li><strong>Download LabCAT draft</strong> downloads a <code>.labcatdraft</code> file.</li>
          <li><strong>Import .labcatdraft</strong> restores a saved draft.</li>
          <li><strong>.labcatdraft</strong> files are plain text — safe for version control and sharing.</li>
          <li>Export PDF or DOCX once the assessment is complete.</li>
        </ul>
      </div>

      <div className="card p-5">
        <div className="font-medium text-zinc-900 mb-2">COSHH guidance</div>
        <p className="text-sm text-zinc-700">
          COSHH assessments must be suitable and sufficient, reviewed regularly, and shared
          with everyone exposed to the activity. Refer to your organisation's safety policy
          and HSE COSHH guidance.
        </p>
        <a
          className="mt-2 inline-flex items-center gap-1 text-sm text-accent-700 hover:underline"
          href="https://www.hse.gov.uk/coshh/"
          target="_blank"
          rel="noreferrer"
        >
          HSE COSHH <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
