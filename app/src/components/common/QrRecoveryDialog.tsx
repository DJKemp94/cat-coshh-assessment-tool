import { useEffect, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { generateQrFrames, reassembleFromQrFrames, QrFrame } from '@/services/exporters/qr';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QrRecoveryDialog({ open, onClose }: Props) {
  const a = useAssessment((s) => s.assessment);
  const replace = useAssessment((s) => s.replaceAssessment);
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [frames, setFrames] = useState<QrFrame[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [scanned, setScanned] = useState<string[]>([]);

  useEffect(() => {
    if (open && mode === 'export') {
      setErr(null);
      generateQrFrames(a)
        .then(setFrames)
        .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    }
  }, [open, mode, a]);

  if (!open) return null;

  const addScan = (text: string) => {
    setScanned((cur) => (cur.includes(text) ? cur : [...cur, text]));
  };

  const completeImport = () => {
    try {
      const restored = reassembleFromQrFrames(scanned);
      replace(restored);
      setScanned([]);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-zinc-900/50 flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div>
            <div className="font-semibold text-zinc-900">Recovery Code</div>
            <div className="text-[11px] text-zinc-500">
              Print the QR codes to recover this draft offline. No data leaves your device.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-zinc-100 rounded-md p-0.5 text-xs">
              <button
                className={`px-2 py-1 rounded ${mode === 'export' ? 'bg-white shadow' : ''}`}
                onClick={() => setMode('export')}
              >
                Export
              </button>
              <button
                className={`px-2 py-1 rounded ${mode === 'import' ? 'bg-white shadow' : ''}`}
                onClick={() => setMode('import')}
              >
                Import
              </button>
            </div>
            <button className="btn-ghost" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

          {mode === 'export' ? (
            <>
              {frames.length > 1 && (
                <div className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  Draft is large — it has been split across {frames.length} QR codes.
                  Print all of them and scan them in order to recover.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
                {frames.map((f) => (
                  <div key={f.index} className="card p-3 text-center">
                    <img src={f.dataUrl} alt={`QR ${f.index}/${f.total}`} className="mx-auto" />
                    <div className="mt-2 text-xs text-zinc-700 font-medium">
                      Frame {f.index} of {f.total}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button className="btn-secondary" onClick={() => window.print()}>
                  <Printer size={14} /> Print
                </button>
              </div>
            </>
          ) : (
            <ImportView
              scanned={scanned}
              onAdd={addScan}
              onClear={() => setScanned([])}
              onComplete={completeImport}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface ImportViewProps {
  scanned: string[];
  onAdd: (text: string) => void;
  onClear: () => void;
  onComplete: () => void;
}

function ImportView({ scanned, onAdd, onClear, onComplete }: ImportViewProps) {
  const [text, setText] = useState('');

  return (
    <div className="space-y-3 text-sm">
      <p className="text-zinc-600">
        Scan each printed QR with a phone, copy the decoded text, and paste it below.
        Repeat until all frames have been added.
      </p>
      <textarea
        className="field-textarea font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste decoded QR text (starts with CAT-QR/v1|…)"
      />
      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={!text.trim()}
          onClick={() => { onAdd(text.trim()); setText(''); }}
        >
          Add frame
        </button>
        <button className="btn-secondary" disabled={!scanned.length} onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="rounded border border-zinc-200 bg-zinc-50 p-2 text-xs">
        <div className="font-medium mb-1">Added frames: {scanned.length}</div>
        <ul className="list-disc pl-5 space-y-0.5 text-zinc-600">
          {scanned.map((s, i) => (
            <li key={i}>{s.slice(0, 40)}…</li>
          ))}
        </ul>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" disabled={!scanned.length} onClick={onComplete}>
          Reassemble draft
        </button>
      </div>
    </div>
  );
}
