import { Info } from 'lucide-react';

export function SuggestionDisclaimer() {
  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2">
      <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
      <div className="text-[12px] text-amber-900 leading-snug">
        <strong>Suggestions, not recommendations.</strong> The chips below are generated from the
        GHS hazard codes and pictograms of the chemicals you have added. They are starting points
        only and must be reviewed against the substance Safety Data Sheet, local procedures and
        competent H&amp;S judgement before being relied upon. LabCAT does not validate that the
        chosen controls are sufficient for your activity.
      </div>
    </div>
  );
}
