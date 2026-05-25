import { GhsPictogram, HCode } from '@/types/assessment';
import { GHS_LABELS } from '@/components/common/GhsPictograms';

const SYMBOLS: Record<GhsPictogram, string> = {
  explosive: '💥',
  flammable: '🔥',
  oxidising: '⚛︎',
  'compressed-gas': '⛓︎',
  corrosive: '⚗︎',
  toxic: '☠︎',
  harmful: '❗︎',
  'health-hazard': '⚠︎',
  environmental: '🌿',
};

export function GhsBadges({ pictograms }: { pictograms: GhsPictogram[] }) {
  if (pictograms.length === 0) {
    return <span className="text-xs text-zinc-400">No pictograms</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {pictograms.map((p) => (
        <span
          key={p}
          title={GHS_LABELS[p]}
          className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 text-red-700 px-2 py-0.5 text-[11px] font-medium"
        >
          <span className="text-sm leading-none">{SYMBOLS[p]}</span>
          {GHS_LABELS[p]}
        </span>
      ))}
    </div>
  );
}

export function HCodeList({ codes }: { codes: HCode[] }) {
  if (codes.length === 0) {
    return <span className="text-xs text-zinc-400">No hazard statements</span>;
  }
  return (
    <ul className="space-y-1">
      {codes.map((c) => (
        <li key={c.code} className="text-xs text-zinc-700">
          <span className="font-mono font-semibold text-zinc-900">{c.code}</span>{' '}
          <span className="text-zinc-600">{c.text}</span>
        </li>
      ))}
    </ul>
  );
}
