// RFC 9285 Base45 — compact alphanumeric encoding for .labcatdraft files.

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const INDEX: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) INDEX[ALPHABET[i]] = i;

export function base45Encode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 <= bytes.length; i += 2) {
    const x = (bytes[i] << 8) | bytes[i + 1];
    const e = Math.floor(x / (45 * 45));
    const d = Math.floor((x % (45 * 45)) / 45);
    const c = x % 45;
    out += ALPHABET[c] + ALPHABET[d] + ALPHABET[e];
  }
  if (i < bytes.length) {
    const x = bytes[i];
    const d = Math.floor(x / 45);
    const c = x % 45;
    out += ALPHABET[c] + ALPHABET[d];
  }
  return out;
}

export function base45Decode(s: string): Uint8Array {
  const out: number[] = [];
  let i = 0;
  for (; i + 3 <= s.length; i += 3) {
    const c = INDEX[s[i]];
    const d = INDEX[s[i + 1]];
    const e = INDEX[s[i + 2]];
    if (c === undefined || d === undefined || e === undefined)
      throw new Error('Base45: invalid character');
    const x = c + d * 45 + e * 45 * 45;
    if (x > 0xffff) throw new Error('Base45: value out of range');
    out.push((x >> 8) & 0xff, x & 0xff);
  }
  if (i + 2 === s.length) {
    const c = INDEX[s[i]];
    const d = INDEX[s[i + 1]];
    if (c === undefined || d === undefined) throw new Error('Base45: invalid character');
    const x = c + d * 45;
    if (x > 0xff) throw new Error('Base45: value out of range');
    out.push(x);
  } else if (i !== s.length) {
    throw new Error('Base45: invalid length');
  }
  return new Uint8Array(out);
}
