import clsx from 'clsx';
import {
  Building2, CalendarDays, Check, FileText, GraduationCap,
  HardHat, Hash, IdCard, List, MapPin, Save, ShieldCheck, User, UserRound,
  Users, UsersRound, Globe2,
} from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PersonsAtRisk } from '@/types/assessment';

const PERSONS: { key: keyof PersonsAtRisk; label: string; Icon: typeof User }[] = [
  { key: 'staff', label: 'Staff', Icon: UserRound },
  { key: 'students', label: 'Students', Icon: GraduationCap },
  { key: 'thirdParty', label: 'Third Party', Icon: UsersRound },
  { key: 'contractors', label: 'Contractors', Icon: HardHat },
  { key: 'visitors', label: 'Visitors', Icon: IdCard },
  { key: 'public', label: 'Public', Icon: Globe2 },
];

const Req = () => <span className="text-red-600 ml-0.5" aria-label="required">*</span>;

export function OverviewSection() {
  const overview = useAssessment((s) => s.assessment.overview);
  const update = useAssessment((s) => s.updateOverview);

  const anyPersonSelected = Object.values(overview.personsAtRisk).some(Boolean);

  const text = (
    key: keyof typeof overview,
    label: string,
    opts: { required?: boolean; placeholder?: string; Icon: typeof User } ,
  ) => {
    const value = overview[key] as string;
    const missing = opts.required && !value.trim();
    const Icon = opts.Icon;
    return (
      <label className="block">
        <span className="overview-label">
          <Icon size={16} />
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
    opts: { required?: boolean; Icon: typeof CalendarDays } = { Icon: CalendarDays },
  ) => {
    const value = overview[key] as string;
    const missing = opts.required && !value;
    const Icon = opts.Icon;
    return (
      <label className="block">
        <span className="overview-label">
          <Icon size={16} />
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

      <div className="card overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
            {text('businessUnit', 'Business Unit', {
              placeholder: 'e.g. School of Chemistry',
              Icon: Building2,
            })}
            {text('riskAssessmentRef', 'Risk Assessment Ref No.', {
              placeholder: 'RA-2026-001',
              Icon: Hash,
            })}
            {text('sopRef', 'Safe Operating Procedure Ref No.', {
              placeholder: 'SOP-...',
              Icon: ShieldCheck,
            })}
            {text('assessor', 'Risk Assessor', {
              required: true,
              placeholder: 'Full name',
              Icon: User,
            })}
            {date('dateOfAssessment', 'Date of Assessment', {
              required: true,
              Icon: CalendarDays,
            })}
            {date('dateOfNextReview', 'Date of Next Review', {
              Icon: CalendarDays,
            })}
            {text('locations', 'Location(s) of Activity', {
              placeholder: 'Building, room',
              Icon: MapPin,
            })}
            {text('activityTitle', 'Activity Title', {
              required: true,
              placeholder: 'e.g. Solvent extraction',
              Icon: FileText,
            })}
          </div>

          <label className="mt-5 block">
            <span className="overview-label">
              <List size={16} />
              Activity Outline
            </span>
            <textarea
              className="field-textarea !min-h-[94px]"
              value={overview.activityOutline}
              onChange={(e) => update({ activityOutline: e.target.value })}
              placeholder="Brief description of the activity, equipment, and any notable conditions."
            />
          </label>

          <div className="mt-5">
            <span className="overview-label">
              <Users size={16} />
              Persons at Risk<Req />
            </span>
            <div
              className={clsx(
                'flex flex-wrap gap-2 rounded-md border border-zinc-200 bg-zinc-50/70 p-3',
                !anyPersonSelected && 'field-missing p-2',
              )}
            >
              {PERSONS.map(({ key, label, Icon }) => {
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
                      'inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ' +
                      (on
                        ? 'bg-accent-50 text-accent-800 border-accent-300 ring-1 ring-accent-200'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50')
                    }
                  >
                    <Icon size={16} />
                    {label}
                    {on && <Check size={15} className="text-accent-700" />}
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

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-5 py-4 sm:px-6">
          <button type="button" className="btn-secondary">Cancel</button>
          <button type="button" className="btn-primary">
            <Save size={15} /> Save Overview
          </button>
        </div>
      </div>
    </section>
  );
}
