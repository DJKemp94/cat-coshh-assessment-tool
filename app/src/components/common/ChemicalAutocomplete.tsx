import { useEffect, useRef, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { autocompleteChemicals, PubChemAutocompleteSuggestion } from '@/services/pubchem';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSelect: (selection: PubChemAutocompleteSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}

export function ChemicalAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  disabled,
  invalid,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PubChemAutocompleteSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = value.trim();
    if (!open || trimmed.length < 2) {
      setItems([]);
      return;
    }
    // CAS pattern: bypass the dictionary autocomplete and offer a single
    // "look up by CAS" entry — selecting it triggers a direct PubChem RN lookup.
    if (/^\d{2,7}-\d{2}-\d$/.test(trimmed)) {
      setItems([{ name: trimmed }]);
      setActive(0);
      return;
    }
    const handle = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const r = await autocompleteChemicals(value, 10, ac.signal);
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

  const isCasOnly = /^\d{2,7}-\d{2}-\d$/.test(value.trim());

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (selection: PubChemAutocompleteSuggestion) => {
    onChange(selection.name);
    setOpen(false);
    onSelect(selection);
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
          className={'field-input pl-8' + (invalid ? ' field-missing' : '')}
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
          {items.map((item, i) => (
            <li
              key={`${item.name}-${item.cid ?? 'name'}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={
                'px-3 py-1.5 cursor-pointer ' +
                (i === active ? 'bg-accent-50 text-accent-900' : 'text-zinc-800')
              }
            >
              {isCasOnly ? (
                <span>Look up CAS <span className="font-mono">{item.name}</span></span>
              ) : (
                <span>{item.name}</span>
              )}
              {item.cid && <span className="ml-2 text-[10px] text-zinc-400 font-mono">CID {item.cid}</span>}
            </li>
          ))}
        </ul>
      )}
      {open && !loading && value.trim().length >= 2 && items.length === 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg text-sm">
          <li
            onMouseDown={(e) => {
              e.preventDefault();
              pick({ name: value.trim() });
            }}
            className="px-3 py-1.5 cursor-pointer text-zinc-800 hover:bg-accent-50"
          >
            Look up <span className="font-medium">"{value.trim()}"</span> on PubChem
            <div className="text-[10px] text-zinc-500">Resolves synonyms (e.g. "wood alcohol" → methanol)</div>
          </li>
        </ul>
      )}
    </div>
  );
}
