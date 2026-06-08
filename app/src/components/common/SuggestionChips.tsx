import { Plus } from 'lucide-react';

export interface ChipSuggestion {
  text: string;
  hint?: string;
}

interface Props {
  suggestions: ChipSuggestion[];
  value: string;
  onAppend: (text: string) => void;
  className?: string;
}

export function SuggestionChips({ suggestions, value, onAppend, className }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <div className={'flex flex-wrap gap-1.5 mb-2 ' + (className ?? '')}>
      {suggestions.map((s) => {
        const inUse = value.toLowerCase().includes(s.text.toLowerCase());
        return (
          <button
            key={s.text}
            type="button"
            onClick={() => onAppend(s.text)}
            title={s.hint || (inUse ? 'Already in your response' : 'Click to add to response')}
            className={
              'inline-flex items-start gap-1 px-2.5 py-1 rounded-md border text-xs text-left transition ' +
              (inUse
                ? 'bg-accent-100 border-accent-300 text-accent-900 cursor-default'
                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-accent-50 hover:border-accent-200')
            }
          >
            {!inUse && <Plus size={11} className="text-zinc-400 mt-0.5 shrink-0" />}
            {s.text}
          </button>
        );
      })}
    </div>
  );
}

export const appendUnique = (current: string, addition: string): string => {
  if (current.toLowerCase().includes(addition.toLowerCase())) return current;
  return current.trim() ? `${current.trim()}\n${addition}` : addition;
};

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
