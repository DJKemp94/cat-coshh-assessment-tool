import clsx from 'clsx';
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

const Req = () => <span className="text-red-600 ml-0.5" aria-label="required">*</span>;

export function OverviewSection() {
  const overview = useAssessment((s) => s.assessment.overview);
  const update = useAssessment((s) => s.updateOverview);

  const anyPersonSelected = Object.values(overview.personsAtRisk).some(Boolean);

  const text = (
    key: keyof typeof overview,
    label: string,
    opts: { required?: boolean; placeholder?: string } = {},
  ) => {
    const value = overview[key] as string;
    const missing = opts.required && !value.trim();
    return (
      <label className="block">
        <span className="field-label">
          {label}
          {opts.required && <Req />}
        </span>
        <input
          type="text"
          className={clsx('field-input', missing && 'field-missing')}
          value={value}
          placeholder={opts.placeholder}
          onChange={(e) => update({ [key]: e.target.value } as Partial<typeof overview>)}
        />
      </label>
    );
  };

  const date = (
    key: keyof typeof overview,
    label: string,
    opts: { required?: boolean } = {},
  ) => {
    const value = overview[key] as string;
    const missing = opts.required && !value;
    return (
      <label className="block">
        <span className="field-label">
          {label}
          {opts.required && <Req />}
        </span>
        <input
          type="date"
          className={clsx('field-input', missing && 'field-missing')}
          value={value}
          onChange={(e) => update({ [key]: e.target.value } as Partial<typeof overview>)}
        />
      </label>
    );
  };

  return (
    <section>
      <SectionHeader
        title="Overview"
        subtitle="Identify the activity, who is doing it, and when it will be reviewed."
      />
      <div className="card p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {text('businessUnit', 'Business Unit', { placeholder: 'e.g. School of Chemistry' })}
          {text('riskAssessmentRef', 'Risk Assessment Ref No.', { placeholder: 'RA-2026-001' })}
          {text('sopRef', 'Safe Operating Procedure Ref No.', { placeholder: 'SOP-…' })}
          {text('assessor', 'Risk Assessor', { required: true, placeholder: 'Full name' })}
          {date('dateOfAssessment', 'Date of Assessment', { required: true })}
          {date('dateOfNextReview', 'Date of Next Review')}
          {text('locations', 'Location(s) of Activity', { placeholder: 'Building, room' })}
          {text('activityTitle', 'Activity Title', { required: true, placeholder: 'e.g. Solvent extraction' })}
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
          <span className="field-label">
            Persons at Risk<Req />
          </span>
          <div
            className={clsx(
              'flex flex-wrap gap-2 rounded-md',
              !anyPersonSelected && 'field-missing p-2',
            )}
          >
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
          {!anyPersonSelected && (
            <div className="text-[11px] text-amber-800 mt-1">
              Select at least one group.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
