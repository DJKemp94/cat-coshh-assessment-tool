import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PersonsAtRisk } from '@/types/assessment';

const PERSONS: { key: keyof PersonsAtRisk; label: string }[] = [
  { key: 'staff', label: 'Staff' },
  { key: 'students', label: 'Students' },
  { key: 'thirdParty', label: 'Third Party' },
  { key: 'contractors', label: 'Contractors' },
  { key: 'visitors', label: 'Visitors' },
  { key: 'public', label: 'Public' },
];

export function OverviewSection() {
  const overview = useAssessment((s) => s.assessment.overview);
  const update = useAssessment((s) => s.updateOverview);

  const text = (key: keyof typeof overview, label: string, placeholder?: string) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        type="text"
        className="field-input"
        value={overview[key] as string}
        placeholder={placeholder}
        onChange={(e) => update({ [key]: e.target.value } as Partial<typeof overview>)}
      />
    </label>
  );

  const date = (key: keyof typeof overview, label: string) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input
        type="date"
        className="field-input"
        value={overview[key] as string}
        onChange={(e) => update({ [key]: e.target.value } as Partial<typeof overview>)}
      />
    </label>
  );

  return (
    <section>
      <SectionHeader
        title="Overview"
        subtitle="Identify the activity, who is doing it, and when it will be reviewed."
      />
      <div className="card p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {text('businessUnit', 'Business Unit', 'e.g. School of Chemistry')}
          {text('riskAssessmentRef', 'Risk Assessment Ref No.', 'RA-2026-001')}
          {text('sopRef', 'Safe Operating Procedure Ref No.', 'SOP-…')}
          {text('assessor', 'Risk Assessor', 'Full name')}
          {date('dateOfAssessment', 'Date of Assessment')}
          {date('dateOfNextReview', 'Date of Next Review')}
          {text('locations', 'Location(s) of Activity', 'Building, room')}
          {text('activityTitle', 'Activity Title', 'e.g. Solvent extraction')}
        </div>

        <label className="block">
          <span className="field-label">Activity Outline</span>
          <textarea
            className="field-textarea"
            value={overview.activityOutline}
            onChange={(e) => update({ activityOutline: e.target.value })}
            placeholder="Brief description of the activity, equipment, and any notable conditions."
          />
        </label>

        <div>
          <span className="field-label">Persons at Risk</span>
          <div className="flex flex-wrap gap-2">
            {PERSONS.map(({ key, label }) => {
              const on = overview.personsAtRisk[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    update({
                      personsAtRisk: { ...overview.personsAtRisk, [key]: !on },
                    })
                  }
                  className={
                    'px-3 py-1.5 rounded-full text-xs border transition ' +
                    (on
                      ? 'bg-accent-600 text-white border-accent-600'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50')
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
