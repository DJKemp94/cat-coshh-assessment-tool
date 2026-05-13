import { GhsPictogram } from '@/types/assessment';
import explosive from '@/assets/ghs/GHS-pictogram-explos.svg';
import flammable from '@/assets/ghs/GHS-pictogram-flamme.svg';
import oxidising from '@/assets/ghs/GHS-pictogram-rondflam.svg';
import compressedGas from '@/assets/ghs/GHS-pictogram-bottle.svg';
import corrosive from '@/assets/ghs/GHS-pictogram-acid.svg';
import toxic from '@/assets/ghs/GHS-pictogram-skull.svg';
import harmful from '@/assets/ghs/GHS-pictogram-exclam.svg';
import healthHazard from '@/assets/ghs/GHS-pictogram-silhouette.svg';
import environmental from '@/assets/ghs/GHS-pictogram-pollu.svg';

const GHS_URLS: Record<GhsPictogram, string> = {
  explosive,
  flammable,
  oxidising,
  'compressed-gas': compressedGas,
  corrosive,
  toxic,
  harmful,
  'health-hazard': healthHazard,
  environmental,
};

export const GHS_LABELS: Record<GhsPictogram, string> = {
  explosive: 'Explosive',
  flammable: 'Flammable',
  oxidising: 'Oxidising',
  'compressed-gas': 'Gas under pressure',
  corrosive: 'Corrosive',
  toxic: 'Acute toxicity',
  harmful: 'Harmful / irritant',
  'health-hazard': 'Health hazard',
  environmental: 'Hazardous to environment',
};

export function GhsIcon({ id, size = 48 }: { id: GhsPictogram; size?: number }) {
  return (
    <img
      src={GHS_URLS[id]}
      alt={GHS_LABELS[id]}
      title={GHS_LABELS[id]}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      className="shrink-0 select-none"
    />
  );
}

export function GhsRow({ ids, size = 32 }: { ids: GhsPictogram[]; size?: number }) {
  if (ids.length === 0) return null;
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5">
      {ids.map((id) => <GhsIcon key={id} id={id} size={size} />)}
    </div>
  );
}

export function GhsGrid({ ids }: { ids: GhsPictogram[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {ids.map((id) => (
        <div key={id} className="flex flex-col items-center gap-1 w-20">
          <GhsIcon id={id} size={64} />
          <div className="text-[10px] text-zinc-600 text-center leading-tight">{GHS_LABELS[id]}</div>
        </div>
      ))}
    </div>
  );
}
