export interface ChipSuggestion {
  text: string;
  hint?: string;
}

const stripBulletPrefix = (value: string): string =>
  value.trim().replace(/^[-*]\s+/, '');

export const appendUniqueBullet = (current: string, addition: string): string => {
  const cleanAddition = stripBulletPrefix(addition);
  const existing = current
    .split(/\r?\n/)
    .map(stripBulletPrefix)
    .some((line) => line.toLowerCase() === cleanAddition.toLowerCase());
  if (existing) return current;

  const next = `- ${cleanAddition}`;
  return current.trim() ? `${current.trim()}\n${next}` : next;
};
