import { deflateRaw, inflateRaw } from 'pako';

export function compressString(s: string): Uint8Array {
  return deflateRaw(new TextEncoder().encode(s), { level: 9 });
}

export function decompressToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(inflateRaw(bytes));
}
