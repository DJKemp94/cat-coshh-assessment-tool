import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Lightbulb } from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { appendUnique, ChipSuggestion } from '@/components/common/SuggestionChips';
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

  const ta = (
    key: keyof typeof a,
    field: RequirementField | null,
    label: string,
    placeholder?: string,
    required?: boolean,
  ) => {
    const value = a[key] as string;
    return (
      <Field
        label={label}
        value={value}
        required={required}
        suggestions={field ? suggestions[field] ?? [] : []}
        onAppend={(s) => update({ [key]: appendUnique(value, s) } as Partial<typeof a>)}
        onChange={(v) => update({ [key]: v } as Partial<typeof a>)}
        placeholder={placeholder}
      />
    );
  };

  return (
    <section>
      <SectionHeader
        title="Storage &amp; Emergency"
        subtitle={
          totalChems > 0
            ? `Suggestions below are derived from H-codes and GHS pictograms across the ${totalChems} chemical${totalChems === 1 ? '' : 's'} you've added.`
            : 'Add chemicals in the Process Steps section to see hazard-driven suggestions here.'
        }
      />
      <SuggestionDisclaimer />

      <div className="space-y-3">
        <Card title="Storage & SDS" defaultOpen>
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

          {ta(
            'storage',
            'storage',
            'Storage requirements',
            'Record where and how substances will be stored, including compatible storage group, segregation, secondary containment, ventilation, security, temperature limits and maximum quantities.',
            true,
          )}
          {ta(
            'incompatibles',
            'incompatibles',
            'Incompatible substances',
            'Record substances or storage groups that must be kept apart, including acids/bases, oxidisers/flammables, water-reactives, cyanides/sulphides and any SDS section 10 restrictions.',
          )}
          {(() => {
            const pairs = suggestions.incompatibles ?? [];
            if (pairs.length < 2) return null;
            const current = a.incompatibles;
            const missing = pairs.filter(
              (p) => !current.toLowerCase().includes(p.text.toLowerCase()),
            );
            if (missing.length === 0) return null;
            return (
              <button
                type="button"
                className="btn-ghost text-xs text-accent-700 hover:bg-accent-50 !px-2 !py-1 mt-1"
                onClick={() => {
                  let next = current;
                  for (const p of missing) next = appendUnique(next, p.text);
                  update({ incompatibles: next });
                }}
              >
                <Plus size={12} /> Add all {missing.length} detected pair{missing.length === 1 ? '' : 's'}
              </button>
            );
          })()}
        </Card>

        <Card title="Emergency response" defaultOpen>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ta(
              'emergencyFirstAid',
              'emergencyFirstAid',
              'First aid',
              'Record first-aid actions for credible exposure routes, when to seek medical advice, what SDS information must go with the person and how exposure incidents are reported.',
              true,
            )}
            {ta(
              'emergencySpills',
              'emergencySpills',
              'Spills',
              'Record spill response for foreseeable quantities, including evacuation or isolation, PPE, ventilation, absorbents, drain protection, waste collection and when to escalate.',
              true,
            )}
            {ta(
              'emergencyFire',
              'emergencyFire',
              'Fire',
              'Record relevant fire hazards, suitable extinguishing media from the SDS, substances that must not contact water, toxic fumes, cylinder risks and run-off control.',
              true,
            )}
          </div>
        </Card>

        <Card title="Waste & other" defaultOpen>
          {ta(
            'wasteHandling',
            'wasteHandling',
            'Waste handling',
            'Record waste containers, segregation, labelling, incompatible waste streams, temporary storage, collection route and any waste that needs specialist disposal.',
            true,
          )}
          {ta(
            'other',
            null,
            'Other',
            'Record additional COSHH requirements that do not fit elsewhere, such as transport, restricted access, local permits, environmental controls or special supervision.',
          )}
        </Card>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Card({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-zinc-50 transition"
      >
        {open ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
        <span className="font-medium text-zinc-900">{title}</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-4 border-t border-zinc-100">{children}</div>}
    </div>
  );
}

function Field({
  label,
  value,
  suggestions,
  onAppend,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  suggestions: ChipSuggestion[];
  onAppend: (text: string) => void;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  // Auto-show chips while the field is empty; collapse once the user has typed
  // or inserted anything. User can still toggle manually.
  const isEmpty = value.trim().length === 0;
  const [forced, setForced] = useState<boolean | null>(null);
  const showChips = forced ?? (isEmpty && suggestions.length > 0);
  const missing = required && isEmpty;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="field-label !mb-0">
          {label}
          {required && (
            <span className="text-red-600 ml-0.5" aria-label="required">*</span>
          )}
        </span>
        {suggestions.length > 0 && (
          <button
            type="button"
            onClick={() => setForced(!showChips)}
            className={clsx(
              'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition',
              showChips
                ? 'bg-accent-50 border-accent-200 text-accent-800'
                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50',
            )}
            aria-expanded={showChips}
          >
            <Lightbulb size={11} />
            {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}
            {showChips ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        )}
      </div>

      {showChips && (
        <ScrollableChipRow
          suggestions={suggestions}
          value={value}
          onAppend={(t) => {
            onAppend(t);
            // Once the user has clicked something, leave it as user-preference;
            // don't force-collapse — they may want another.
          }}
        />
      )}

      <textarea
        className={clsx('field-textarea', missing && 'field-missing')}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ScrollableChipRow({
  suggestions,
  value,
  onAppend,
}: {
  suggestions: ChipSuggestion[];
  value: string;
  onAppend: (text: string) => void;
}) {
  return (
    <div className="relative mb-2">
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => {
          const inUse = value.toLowerCase().includes(s.text.toLowerCase());
          return (
            <button
              key={s.text}
              type="button"
              onClick={() => onAppend(s.text)}
              title={s.hint || (inUse ? 'Already added' : 'Click to add')}
              className={clsx(
                'inline-flex items-start gap-1 px-2.5 py-1 rounded-md border text-xs text-left transition max-w-full',
                inUse
                  ? 'bg-accent-100 border-accent-300 text-accent-900 cursor-default'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-accent-50 hover:border-accent-200',
              )}
            >
              {!inUse && <Plus size={11} className="text-zinc-400 mt-0.5 shrink-0" />}
              {s.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
