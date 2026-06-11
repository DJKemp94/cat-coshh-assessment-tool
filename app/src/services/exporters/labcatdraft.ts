import { Assessment, SCHEMA_VERSION } from '@/types/assessment';
import { compressString, decompressToString } from '@/services/codec/compress';
import { base45Decode, base45Encode } from '@/services/codec/base45';
import { migrateAssessment } from '@/services/migrate';
import { exportFileName } from '@/services/exporters/_filename';

const HEADER = `LabCATDRAFT/v${SCHEMA_VERSION}`;
const LEGACY_HEADER_PREFIX = 'CATDRAFT/v';
const HEADER_PREFIX = 'LabCATDRAFT/v';

function encodeDraft(a: Assessment): string {
  const json = JSON.stringify(a);
  const compressed = compressString(json);
  return `${HEADER}\n${base45Encode(compressed)}`;
}

function decodeDraft(text: string): Assessment {
  const draft = text.replace(/^\uFEFF/, '');
  const newline = draft.indexOf('\n');
  if (newline === -1) throw new Error('Invalid .labcatdraft (no header line)');
  const header = draft.slice(0, newline).trim();
  const payload = draft.slice(newline + 1).replace(/[\r\n]/g, '');
  const prefix = header.startsWith(HEADER_PREFIX)
    ? HEADER_PREFIX
    : header.startsWith(LEGACY_HEADER_PREFIX)
      ? LEGACY_HEADER_PREFIX
      : null;
  if (!prefix) throw new Error('Not a LabCAT draft file');
  const version = Number(header.replace(prefix, ''));
  if (!Number.isFinite(version)) throw new Error('Unrecognised draft version');
  const bytes = base45Decode(payload);
  const json = decompressToString(bytes);
  return migrateAssessment(JSON.parse(json));
}

const fileName = exportFileName;

export async function downloadLabcatdraft(a: Assessment): Promise<void> {
  const text = encodeDraft(a);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(a, 'labcatdraft');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importLabcatdraftFile(file: File): Promise<Assessment> {
  const text = await file.text();
  return decodeDraft(text);
}
