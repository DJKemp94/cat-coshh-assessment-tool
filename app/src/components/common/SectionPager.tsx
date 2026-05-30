import { ArrowLeft, ArrowRight } from 'lucide-react';
import { SectionId, useAssessment } from '@/store/assessment';
import { CoreSectionId, sectionMissingItems } from '@/services/completion';

type PagerSectionId = Exclude<SectionId, 'settings' | 'help'>;
type CorePagerSectionId = Exclude<PagerSectionId, 'completeExport'>;

const SECTION_NAV: { id: PagerSectionId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'substances', label: 'Process Steps' },
  { id: 'taskHazards', label: 'Non-Chemical Hazards' },
  { id: 'controls', label: 'Controls' },
  { id: 'additional', label: 'Storage' },
  { id: 'emergency', label: 'Emergency Response' },
  { id: 'briefing', label: 'Briefing & Sign-off' },
  { id: 'completeExport', label: 'Complete & Export' },
];

export function SectionPager({ current }: { current: SectionId }) {
  const setSection = useAssessment((s) => s.setSection);
  const assessment = useAssessment((s) => s.assessment);
  const index = SECTION_NAV.findIndex((item) => item.id === current);
  if (index < 0) return null;

  const previous = SECTION_NAV[index - 1];
  const next = SECTION_NAV[index + 1];
  const currentIsCore = current !== 'completeExport';
  const missingItems = currentIsCore
    ? sectionMissingItems(assessment, current as CorePagerSectionId as CoreSectionId)
    : [];
  const canGoNext = missingItems.length === 0;

  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <div>
        {previous && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setSection(previous.id)}
          >
            <ArrowLeft size={15} /> Go to {previous.label}
          </button>
        )}
      </div>
      <div>
        {next && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              className="btn-primary"
              disabled={!canGoNext}
              title={!canGoNext ? 'Complete the current section before moving to the next page' : undefined}
              onClick={() => setSection(next.id)}
            >
              Go to {next.label} <ArrowRight size={15} />
            </button>
            {!canGoNext && (
              <div className="max-w-sm text-right text-[11px] leading-4 text-amber-800">
                Complete this page first: {missingItems.join(', ')}.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
