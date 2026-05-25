import { Info } from 'lucide-react';

export function SuggestionDisclaimer({ variant = 'default' }: { variant?: 'default' | 'storage' }) {
  const copy = variant === 'storage'
    ? (
      <>
        <strong>Storage guidance, not automatic approval.</strong> The classifications, cabinet
        layout and compatibility matrix are generated from the chemical data recorded in this
        assessment, including GHS hazards, physical state and PubChem-derived structure where
        available. They are starting points only and must be checked against SDS sections 7 and 10,
        local storage rules and competent H&amp;S judgement before chemicals are stored.
      </>
    )
    : (
      <>
        <strong>Suggestions, not recommendations.</strong> The chips below are generated from the
        GHS hazard codes and pictograms of the chemicals you have added. They are starting points
        only and must be reviewed against the substance Safety Data Sheet, local procedures and
        competent H&amp;S judgement before being relied upon. CAT does not validate that the
        chosen controls are sufficient for your activity.
      </>
    );

  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2">
      <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
      <div className="text-[12px] text-amber-900 leading-snug">
        {copy}
      </div>
    </div>
  );
}
