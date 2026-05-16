import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Lightbulb } from 'lucide-react';
import clsx from 'clsx';
import { ChipSuggestion } from './SuggestionChips';

interface Props {
  label: string;
  hint?: string;
  value: string;
  suggestions: ChipSuggestion[] | string[];
  onChange: (next: string) => void;
  onAppend: (text: string) => void;
  placeholder?: string;
  /** Optional wrapper className for the outer block. */
  className?: string;
  /** Smaller textarea height. */
  compact?: boolean;
  /** Mark as compulsory: shows a red asterisk and highlights when empty. */
  required?: boolean;
}

const toChips = (s: ChipSuggestion[] | string[]): ChipSuggestion[] =>
  s.length === 0
    ? []
    : typeof s[0] === 'string'
      ? (s as string[]).map((t) => ({ text: t }))
      : (s as ChipSuggestion[]);

/**
 * Unified suggestion field. Chips auto-show while the textarea is empty;
 * once the user has typed they can still toggle them back with the pill.
 */
export function SuggestionField({
  label,
  hint,
  value,
  suggestions,
  onChange,
  onAppend,
  placeholder,
  className,
  compact,
  required,
}: Props) {
  const chips = toChips(suggestions);
  const isEmpty = value.trim().length === 0;
  const [forced, setForced] = useState<boolean | null>(null);
  const showChips = forced ?? false;
  const missing = required && isEmpty;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="field-label !mb-0">
          {label}
          {required && (
            <span className="text-red-600 ml-0.5" aria-label="required">*</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {hint && (
            <span className="text-[11px] text-zinc-500 hidden md:block">{hint}</span>
          )}
          {chips.length > 0 && (
            <button
              type="button"
              onClick={() => setForced(!showChips)}
              className={clsx(
                'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition',
                showChips
                  ? 'bg-accent-50 border-accent-200 text-accent-800'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50',
              )}
              aria-expanded={showChips}
            >
              <Lightbulb size={11} />
              {chips.length} suggestion{chips.length === 1 ? '' : 's'}
              {showChips ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </button>
          )}
        </div>
      </div>

      {showChips && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {chips.map((s) => {
            const inUse = value.toLowerCase().includes(s.text.toLowerCase());
            return (
              <button
                key={s.text}
                type="button"
                onClick={() => onAppend(s.text)}
                title={s.hint || (inUse ? 'Already added' : 'Click to add')}
                className={clsx(
                  'inline-flex items-start gap-1 px-2.5 py-1 rounded-md border text-xs text-left transition max-w-full',
                  inUse
                    ? 'bg-accent-100 border-accent-300 text-accent-900 cursor-default'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-accent-50 hover:border-accent-200',
                )}
              >
                {!inUse && <Plus size={11} className="text-zinc-400 mt-0.5 shrink-0" />}
                {s.text}
              </button>
            );
          })}
        </div>
      )}

      <textarea
        className={clsx(
          'field-textarea',
          compact && '!min-h-[56px] text-sm',
          missing && 'field-missing',
        )}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
