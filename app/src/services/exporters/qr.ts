import QRCode from 'qrcode';
import { Assessment } from '@/types/assessment';
import { encodeDraft, decodeDraft } from './catdraft';

const CHUNK_SIZE = 700; // QR alphanumeric capacity at error correction M ~ 1100 chars; keep margin.

export interface QrFrame {
  index: number;
  total: number;
  dataUrl: string;
  text: string;
}

export async function generateQrFrames(a: Assessment): Promise<QrFrame[]> {
  const encoded = encodeDraft(a);
  const total = Math.max(1, Math.ceil(encoded.length / CHUNK_SIZE));
  const frames: QrFrame[] = [];
  for (let i = 0; i < total; i++) {
    const slice = encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const text = `CAT-QR/v1|${i + 1}/${total}|${slice}`;
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    });
    frames.push({ index: i + 1, total, dataUrl, text });
  }
  return frames;
}

export function reassembleFromQrFrames(rawFrames: string[]): Assessment {
  const parts = new Map<number, string>();
  let total: number | null = null;
  for (const raw of rawFrames) {
    const m = raw.match(/^CAT-QR\/v1\|(\d+)\/(\d+)\|(.*)$/s);
    if (!m) throw new Error('Not a CAT QR payload');
    const i = Number(m[1]);
    const n = Number(m[2]);
    if (total === null) total = n;
    if (total !== n) throw new Error('Inconsistent total across frames');
    parts.set(i, m[3]);
  }
  if (total === null) throw new Error('No frames provided');
  for (let i = 1; i <= total; i++) {
    if (!parts.has(i)) throw new Error(`Missing frame ${i}/${total}`);
  }
  const joined = Array.from({ length: total }, (_, i) => parts.get(i + 1)!).join('');
  // Header line is part of encodeDraft output; decodeDraft handles it.
  return decodeDraft(joined);
}
