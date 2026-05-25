const PRESERVE_UPPERCASE = new Set([
  'ACN',
  'ATP',
  'BSA',
  'DCM',
  'DMF',
  'DMSO',
  'DNA',
  'EDTA',
  'HPLC',
  'PBS',
  'PCR',
  'RNA',
  'SDS',
  'TFA',
  'THF',
]);

function normalizeWordCase(word: string): string {
  const letters = word.replace(/[^A-Za-z]/g, '');
  if (!letters) return word;
  if (PRESERVE_UPPERCASE.has(letters.toUpperCase())) return word.toUpperCase();
  if (letters.length <= 2 && word === word.toUpperCase()) return word;

  return word.replace(/[A-Za-z]+/g, (part) => {
    if (PRESERVE_UPPERCASE.has(part.toUpperCase())) return part.toUpperCase();
    if (part.length <= 2 && part === part.toUpperCase()) return part;
    return part.toLowerCase();
  });
}

export function normalizeChemicalName(name: string): string {
  const compact = name.trim().replace(/\s+/g, ' ');
  if (!compact) return compact;

  const normalized = compact
    .split(/(\s+)/)
    .map((part) => (part.trim() ? normalizeWordCase(part) : part))
    .join('');

  return normalized.replace(/[A-Za-z]/, (first) => first.toUpperCase());
}
