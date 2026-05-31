import { Info } from 'lucide-react';

interface PageIntroStep {
  title: string;
  body: string;
}

interface PageIntroProps {
  title?: string;
  body: string;
  steps?: PageIntroStep[];
  optionalStep?: PageIntroStep;
}

export function PageIntro({ title = 'What to do on this page', body, steps = [], optionalStep }: PageIntroProps) {
  return (
    <div className="card mb-4 border-accent-100 bg-accent-50/30 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-100 text-accent-700">
          <Info size={16} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700">{body}</p>
          {steps.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-700 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.title} className="rounded-md border border-accent-100 bg-white/80 p-2">
                  <div className="font-semibold text-zinc-900">{step.title}</div>
                  <div className="mt-0.5">{step.body}</div>
                </div>
              ))}
            </div>
          )}
          {optionalStep && (
            <div className="mt-2 rounded-md border border-dashed border-accent-200 bg-white/60 px-2.5 py-2 text-xs leading-relaxed text-zinc-700">
              <span className="font-semibold text-zinc-900">{optionalStep.title}:</span>{' '}
              {optionalStep.body}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
