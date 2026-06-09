import { HCode } from '@/types/assessment';

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
