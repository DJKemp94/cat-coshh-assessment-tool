import clsx from 'clsx';
import { RiskScore, RiskLevel, riskRating } from '@/types/assessment';

interface Props {
  value: RiskScore;
  onChange: (v: RiskScore) => void;
  compact?: boolean;
}

const LEVELS: (RiskLevel | 0)[] = [1, 2, 3, 4, 5];

const ratingBand = (n: number): { label: string; cls: string } => {
  if (n === 0) return { label: '—', cls: 'bg-zinc-100 text-zinc-500' };
  if (n <= 4) return { label: 'Low', cls: 'bg-emerald-100 text-emerald-800' };
  if (n <= 9) return { label: 'Medium', cls: 'bg-amber-100 text-amber-800' };
  if (n <= 15) return { label: 'High', cls: 'bg-orange-100 text-orange-800' };
  return { label: 'Very High', cls: 'bg-red-100 text-red-800' };
};

export function RiskMatrix({ value, onChange, compact }: Props) {
  const rating = riskRating(value);
  const band = ratingBand(rating);

  const select = (
    label: string,
    key: 'likelihood' | 'severity',
  ) => (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-zinc-500 w-16">{label}</span>
      <div className="flex gap-1">
        {LEVELS.map((n) => {
          const on = value[key] === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ ...value, [key]: n })}
              className={clsx(
                'w-6 h-6 rounded text-[11px] font-medium border transition',
                on
                  ? 'bg-accent-600 text-white border-accent-600'
                  : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={clsx('flex flex-col gap-1', compact && 'text-xs')}>
      {select('Likelihood', 'likelihood')}
      {select('Severity', 'severity')}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[11px] text-zinc-500 w-16">Rating</span>
        <span className={clsx('px-2 py-0.5 rounded text-[11px] font-medium', band.cls)}>
          {rating || '—'} · {band.label}
        </span>
      </div>
    </div>
  );
}
