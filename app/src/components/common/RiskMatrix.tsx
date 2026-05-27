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
    <div className={clsx('flex items-center', compact ? 'gap-2' : 'gap-3')}>
      <span className={clsx('text-xs text-zinc-600', compact ? 'w-16' : 'w-20')}>{label}</span>
      <div className={clsx('flex', compact ? 'gap-1.5' : 'gap-2')}>
        {LEVELS.map((n) => {
          const on = value[key] === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ ...value, [key]: n })}
              className={clsx(
                'rounded-md font-semibold border transition shadow-soft',
                compact ? 'h-7 w-9 text-xs' : 'h-7 w-10 text-sm',
                on
                  ? 'bg-accent-600 text-white border-accent-600'
                  : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50',
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
    <div className={clsx('flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
      {select('Likelihood', 'likelihood')}
      {select('Severity', 'severity')}
      <div className={clsx('flex items-center', compact ? 'gap-2' : 'gap-3')}>
        <span className={clsx('text-xs text-zinc-600', compact ? 'w-16' : 'w-20')}>Rating</span>
        <span className={clsx('rounded-md font-bold', compact ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm', band.cls)}>
          {rating || '—'} · {band.label}
        </span>
      </div>
    </div>
  );
}
