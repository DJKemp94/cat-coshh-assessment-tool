import { Assessment, SCHEMA_VERSION } from '@/types/assessment';
import { compressString, decompressToString } from '@/services/codec/compress';
import { base45Decode, base45Encode } from '@/services/codec/base45';
import { migrateAssessment } from '@/services/migrate';

const HEADER = `CATDRAFT/v${SCHEMA_VERSION}`;

export function encodeDraft(a: Assessment): string {
  const json = JSON.stringify(a);
  const compressed = compressString(json);
  return `${HEADER}\n${base45Encode(compressed)}`;
}

export function decodeDraft(text: string): Assessment {
  const trimmed = text.trim();
  const newline = trimmed.indexOf('\n');
  if (newline === -1) throw new Error('Invalid .catdraft (no header line)');
  const header = trimmed.slice(0, newline).trim();
  const payload = trimmed.slice(newline + 1).replace(/\s+/g, '');
  if (!header.startsWith('CATDRAFT/v')) throw new Error('Not a CAT draft file');
  const version = Number(header.replace('CATDRAFT/v', ''));
  if (!Number.isFinite(version)) throw new Error('Unrecognised draft version');
  const bytes = base45Decode(payload);
  const json = decompressToString(bytes);
  return migrateAssessment(JSON.parse(json));
}

function fileName(a: Assessment, ext: string): string {
  const ref = (a.overview.riskAssessmentRef || 'untitled').replace(/[^a-z0-9_-]+/gi, '_');
  const date = (a.overview.dateOfAssessment || new Date().toISOString().slice(0, 10)).replace(
    /-/g,
    '',
  );
  return `CAT-${ref}-${date}.${ext}`;
}

export async function downloadCatdraft(a: Assessment): Promise<void> {
  const text = encodeDraft(a);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(a, 'catdraft');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importCatdraftFile(file: File): Promise<Assessment> {
  const text = await file.text();
  return decodeDraft(text);
}
