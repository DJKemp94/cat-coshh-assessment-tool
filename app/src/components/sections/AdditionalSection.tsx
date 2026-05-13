import { useMemo } from 'react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { SuggestionChips, appendUnique } from '@/components/common/SuggestionChips';
import { SuggestionDisclaimer } from '@/components/common/SuggestionDisclaimer';
import { suggestRequirements, RequirementField } from '@/services/suggestRequirements';

export function AdditionalSection() {
  const a = useAssessment((s) => s.assessment.additional);
  const assessment = useAssessment((s) => s.assessment);
  const update = useAssessment((s) => s.updateAdditional);

  const suggestions = useMemo(() => suggestRequirements(assessment), [assessment]);

  const totalChems = useMemo(
    () => assessment.processSteps.reduce((n, st) => n + st.chemicals.length, 0),
    [assessment.processSteps],
  );

  const tableSuggestions = (field: RequirementField) => suggestions[field] ?? [];

  const taWithSuggestions = (
    key: keyof typeof a,
    field: RequirementField | null,
    label: string,
    placeholder?: string,
  ) => (
    <div>
      <span className="field-label">{label}</span>
      {field && (
        <SuggestionChips
          suggestions={tableSuggestions(field)}
          value={a[key] as string}
          onAppend={(s) => update({ [key]: appendUnique(a[key] as string, s) } as Partial<typeof a>)}
        />
      )}
      <textarea
        className="field-textarea"
        value={a[key] as string}
        placeholder={placeholder}
        onChange={(e) => update({ [key]: e.target.value } as Partial<typeof a>)}
      />
    </div>
  );

  return (
    <section>
      <SectionHeader
        title="Storage &amp; Emergency"
        subtitle={
          totalChems > 0
            ? `Suggestions below are derived from H-codes and GHS pictograms across the ${totalChems} chemical${totalChems === 1 ? '' : 's'} you've added. Click a chip to add it.`
            : 'Add chemicals in the Process Steps section to see hazard-driven suggestions here.'
        }
      />
      <SuggestionDisclaimer />

      <div className="card p-5 space-y-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={a.cheminventoryLogged}
            onChange={(e) => update({ cheminventoryLogged: e.target.checked })}
          />
          Hazardous substance logged into ChemInventory
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <span className="field-label">SDS version number</span>
            <input
              className="field-input"
              value={a.sdsVersion}
              onChange={(e) => update({ sdsVersion: e.target.value })}
            />
          </label>
          <label>
            <span className="field-label">SDS date</span>
            <input
              type="date"
              className="field-input"
              value={a.sdsDate}
              onChange={(e) => update({ sdsDate: e.target.value })}
            />
          </label>
        </div>

        {taWithSuggestions('storage', 'storage', 'Storage requirements')}
        {taWithSuggestions('incompatibles', 'incompatibles', 'Incompatible substances')}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {taWithSuggestions('emergencySpills', 'emergencySpills', 'Emergency — Spills')}
          {taWithSuggestions('emergencyFirstAid', 'emergencyFirstAid', 'Emergency — First aid')}
          {taWithSuggestions('emergencyFire', 'emergencyFire', 'Emergency — Fire')}
        </div>

        {taWithSuggestions('wasteHandling', 'wasteHandling', 'Waste handling')}
        {taWithSuggestions('other', null, 'Other')}
      </div>
    </section>
  );
}
