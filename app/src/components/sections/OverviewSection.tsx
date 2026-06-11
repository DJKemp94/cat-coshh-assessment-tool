import clsx from 'clsx';
import {
  Building2, CalendarDays, Check, GraduationCap,
  HardHat, IdCard, List, MapPin, ShieldCheck, User, UserRound,
  Users, UsersRound, Globe2,
} from 'lucide-react';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PageIntro } from '@/components/common/PageIntro';
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

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
    opts: { required?: boolean; Icon: typeof CalendarDays; todayButton?: boolean } = { Icon: CalendarDays },
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
        <div className="flex gap-2">
          <input
            type="date"
            className={clsx('field-input', missing && 'field-missing')}
            value={value}
            onChange={(e) => update({ [key]: e.target.value } as Partial<typeof overview>)}
          />
          {opts.todayButton && (
            <button
              type="button"
              className="btn-secondary shrink-0 !px-3 !py-2 text-xs"
              onClick={() => update({ [key]: todayISO() } as Partial<typeof overview>)}
            >
              Today
            </button>
          )}
        </div>
      </label>
    );
  };

  return (
    <section>
      <SectionHeader
        title="Overview"
        subtitle="Identify the activity, who is doing it, and when it will be reviewed."
      />

      <PageIntro
        body="Use this page to identify the activity being assessed, where it happens, who is responsible for the assessment, and who could be affected."
        steps={[
          { title: '1. Identify the task', body: 'Give enough context for someone else to understand the activity and location.' },
          { title: '2. Set ownership', body: 'Record the assessor, dates and any SOP or reference numbers.' },
          { title: '3. Confirm people at risk', body: 'Tick every group who may be exposed or affected by the task.' },
        ]}
      />

      <div className="card overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
            {text('businessUnit', 'Business Unit', {
              required: true,
              placeholder: 'e.g. School of Chemistry',
              Icon: Building2,
            })}
            {text('locations', 'Location', {
              required: true,
              placeholder: 'Building, room',
              Icon: MapPin,
            })}
            {text('assessor', 'Risk Assessor', {
              required: true,
              placeholder: 'Full name',
              Icon: User,
            })}
            {text('sopRef', 'SOP Ref number(s)', {
              placeholder: 'SOP-...',
              Icon: ShieldCheck,
            })}
            {date('dateOfAssessment', 'Date of Assessment', {
              required: true,
              Icon: CalendarDays,
              todayButton: true,
            })}
            {date('dateOfNextReview', 'Date of Review', {
              required: true,
              Icon: CalendarDays,
            })}
          </div>

          <label className="mt-5 block">
            <span className="overview-label">
              <List size={16} />
              RA Title<Req />
            </span>
            <textarea
              className={clsx('field-textarea !min-h-[94px]', !overview.activityOutline.trim() && 'field-missing')}
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
      </div>
    </section>
  );
}
