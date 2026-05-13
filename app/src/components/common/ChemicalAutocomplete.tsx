import { useEffect, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { autocompleteNames } from '@/services/pubchem';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSelect: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChemicalAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (!open || trimmed.length < 2 || /^\d{2,7}-\d{2}-\d$/.test(trimmed)) {
      setItems([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const r = await autocompleteNames(value, 10, ac.signal);
        setItems(r);
        setActive(0);
      } catch {
        // aborted or network error — silent
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [value, open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    onSelect(name);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (items[active]) {
        e.preventDefault();
        pick(items[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative flex-1">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
        />
        <input
          className="field-input pl-8"
          value={value}
          disabled={disabled}
          placeholder={placeholder ?? 'Chemical name or CAS number (e.g. 67-64-1)'}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          autoComplete="off"
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 animate-spin"
          />
        )}
      </div>
      {open && items.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-zinc-200 rounded-md shadow-lg text-sm">
          {items.map((name, i) => (
            <li
              key={name}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(name);
              }}
              onMouseEnter={() => setActive(i)}
              className={
                'px-3 py-1.5 cursor-pointer ' +
                (i === active ? 'bg-accent-50 text-accent-900' : 'text-zinc-800')
              }
            >
              {name}
            </li>
          ))}
        </ul>
      )}
      {open && !loading && value.trim().length >= 2 && items.length === 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg px-3 py-2 text-xs text-zinc-500">
          No PubChem matches. You can still type a name manually.
        </div>
      )}
    </div>
  );
}
