import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Plus, Lightbulb, RotateCw, Archive, Siren,
  Cross, Droplets, Flame, Trash2, Sparkles, Info, Box, Thermometer,
  Network, Umbrella, PackageCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { appendUnique, ChipSuggestion } from '@/components/common/SuggestionChips';
import { SuggestionDisclaimer } from '@/components/common/SuggestionDisclaimer';
import { suggestRequirements, RequirementField } from '@/services/suggestRequirements';
import { GhsIcon, GHS_LABELS } from '@/components/common/GhsPictograms';
import { GhsPictogram } from '@/types/assessment';

export function AdditionalSection() {
  const a = useAssessment((s) => s.assessment.additional);
  const assessment = useAssessment((s) => s.assessment);
  const update = useAssessment((s) => s.updateAdditional);

  const suggestions = useMemo(() => suggestRequirements(assessment), [assessment]);

  const totalChems = useMemo(
    () => assessment.processSteps.reduce((n, st) => n + st.chemicals.length, 0),
    [assessment.processSteps],
  );
  const allChems = useMemo(
    () => assessment.processSteps.flatMap((st) => st.chemicals),
    [assessment.processSteps],
  );
  const keyHazards = useMemo(() => {
    const seen = new Set<GhsPictogram>();
    const out: GhsPictogram[] = [];
    for (const c of allChems) {
      for (const p of c.ghsPictograms) {
        if (!seen.has(p)) {
          seen.add(p);
          out.push(p);
        }
      }
    }
    return out.slice(0, 4);
  }, [allChems]);

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
        right={
          <button type="button" className="btn-secondary">
            <RotateCw size={14} /> Re-apply suggestions
          </button>
        }
      />
      <SuggestionDisclaimer />

      {totalChems > 0 && (
        <div className="card mb-5 grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-600">
              Key hazards (from GHS) <Info size={13} />
            </div>
            <div className="flex flex-wrap gap-3">
              {keyHazards.length > 0 ? keyHazards.map((id) => (
                <div key={id} className="inline-flex min-h-12 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900">
                  <GhsIcon id={id} size={30} />
                  {GHS_LABELS[id]}
                </div>
              )) : <span className="text-sm text-zinc-500">No GHS pictograms recorded yet.</span>}
            </div>
          </div>
          <div className="border-t border-zinc-200 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="mb-2 text-xs font-medium text-zinc-600">Storage implications</div>
            <ul className="list-disc space-y-1 pl-4 text-sm text-zinc-700">
              {(suggestions.storage.length > 0 ? suggestions.storage.slice(0, 3).map((s) => s.text) : [
                'Keep containers closed except during use.',
                'Store according to SDS section 7 and local segregation rules.',
                'Keep only the working quantity at the point of use.',
              ]).map((text) => <li key={text}>{text}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <Card
          title="Storage & SDS"
          subtitle="Record storage conditions and reference the SDS."
          icon={<Archive size={18} />}
          iconClass="text-accent-700"
          defaultOpen
          right={
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={a.cheminventoryLogged}
                onChange={(e) => update({ cheminventoryLogged: e.target.checked })}
              />
              Hazardous substance logged into ChemInventory
            </label>
          }
        >

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

          <StorageRequirements
            value={a.storage}
            suggestions={suggestions.storage ?? []}
            onChange={(v) => update({ storage: v })}
          />
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

        <Card
          title="Emergency response"
          subtitle="Record actions for likely emergency scenarios."
          icon={<Siren size={20} />}
          iconClass="text-red-500"
          defaultOpen
          right={<button type="button" className="text-xs font-medium text-accent-700">Expand all</button>}
        >
          <div className="overflow-hidden rounded-md border border-zinc-200">
            <EmergencyRow
              title="First aid"
              subtitle="For exposure to the substance"
              icon={<Cross size={18} />}
              iconClass="bg-sky-500 text-white"
              field={ta(
                'emergencyFirstAid',
                'emergencyFirstAid',
                'First aid',
                'Record first-aid actions for credible exposure routes, when to seek medical advice, what SDS information must go with the person and how exposure incidents are reported.',
                true,
              )}
              suggestions={suggestions.emergencyFirstAid.length}
              preview={a.emergencyFirstAid}
            />
            <EmergencyRow
              title="Spills"
              subtitle="Spill control and clean up"
              icon={<Droplets size={18} />}
              iconClass="bg-amber-500 text-white"
              field={ta(
                'emergencySpills',
                'emergencySpills',
                'Spills',
                'Record spill response for foreseeable quantities, including evacuation or isolation, PPE, ventilation, absorbents, drain protection, waste collection and when to escalate.',
                true,
              )}
              suggestions={suggestions.emergencySpills.length}
              preview={a.emergencySpills}
            />
            <EmergencyRow
              title="Fire response"
              subtitle="In case of fire"
              icon={<Flame size={18} />}
              iconClass="bg-red-500 text-white"
              field={ta(
                'emergencyFire',
                'emergencyFire',
                'Fire',
                'Record relevant fire hazards, suitable extinguishing media from the SDS, substances that must not contact water, toxic fumes, cylinder risks and run-off control.',
                true,
              )}
              suggestions={suggestions.emergencyFire.length}
              preview={a.emergencyFire}
            />
            <EmergencyRow
              title="Disposal"
              subtitle="Waste and disposal"
              icon={<Trash2 size={18} />}
              iconClass="bg-violet-500 text-white"
              field={ta(
                'wasteHandling',
                'wasteHandling',
                'Disposal',
                'Record waste containers, segregation, labelling, incompatible waste streams, temporary storage, collection route and any waste that needs specialist disposal.',
                true,
              )}
              suggestions={suggestions.wasteHandling.length}
              preview={a.wasteHandling}
            />
          </div>

          <div className="rounded-md border border-zinc-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900">
                <Sparkles size={16} className="text-sky-500" />
                Generated summary <span className="text-xs font-normal text-zinc-500">(editable)</span>
              </div>
              <span className="pill">{Math.max(1, suggestions.emergencyFire.length)} suggestion</span>
            </div>
            {ta(
              'other',
              null,
              '',
              'Summarise storage and emergency controls, or add other COSHH requirements that do not fit elsewhere.',
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Card({
  title,
  subtitle,
  icon,
  iconClass,
  right,
  defaultOpen,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconClass?: string;
  right?: React.ReactNode;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 text-zinc-600">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {icon && <span className={clsx('shrink-0', iconClass)}>{icon}</span>}
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="font-semibold text-zinc-900">{title}</div>
          {subtitle && <div className="text-xs text-zinc-500">{subtitle}</div>}
        </button>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {open && <div className="px-4 pb-4 space-y-4 border-t border-zinc-100">{children}</div>}
    </div>
  );
}

const STORAGE_ROWS = [
  ['Storage type', 'Flammable cabinet', Box],
  ['Segregation', 'Away from oxidisers and incompatible chemicals', Network],
  ['Ventilation', 'Use in well-ventilated area', Umbrella],
  ['Temperature', 'Ambient (below 25 °C if possible)', Thermometer],
  ['Max working quantity', 'e.g. 500 mL', PackageCheck],
] as const;

function readStorageLine(value: string, label: string) {
  const line = value.split('\n').find((l) => l.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.slice(label.length + 1).trim() : '';
}

function writeStorageLine(value: string, label: string, nextValue: string) {
  const lines = value.split('\n').filter(Boolean);
  const idx = lines.findIndex((l) => l.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  const nextLine = `${label}: ${nextValue}`;
  if (idx >= 0) lines[idx] = nextLine;
  else lines.push(nextLine);
  return lines.join('\n');
}

function StorageRequirements({
  value,
  suggestions,
  onChange,
}: {
  value: string;
  suggestions: ChipSuggestion[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="field-label !mb-0">
          Storage requirements <span className="text-red-600">*</span>
        </div>
        {suggestions.length > 0 && <span className="pill"><Lightbulb size={11} /> {suggestions.length} suggestion{suggestions.length === 1 ? '' : 's'}</span>}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-md border border-zinc-200">
          {STORAGE_ROWS.map(([label, placeholder, Icon]) => (
            <label key={label} className="grid grid-cols-[11rem_1fr] border-b border-zinc-200 last:border-b-0">
              <span className="flex items-center gap-2 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800">
                <Icon size={15} className="text-accent-700" />
                {label}
              </span>
              <input
                className="min-w-0 border-0 px-3 py-2 text-sm text-zinc-800 outline-none focus:ring-2 focus:ring-accent-500"
                value={readStorageLine(value, label)}
                placeholder={placeholder}
                onChange={(e) => onChange(writeStorageLine(value, label, e.target.value))}
              />
            </label>
          ))}
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-700">Suggested controls (click to insert)</div>
          <ScrollableChipRow suggestions={suggestions.slice(0, 6)} value={value} onAppend={(text) => onChange(appendUnique(value, text))} />
        </div>
      </div>
    </div>
  );
}

function EmergencyRow({
  title,
  subtitle,
  icon,
  iconClass,
  field,
  suggestions,
  preview,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconClass: string;
  field: React.ReactNode;
  suggestions: number;
  preview: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-zinc-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[2.5rem_8rem_1fr_auto_1.5rem] items-center gap-3 px-3 py-3 text-left hover:bg-zinc-50"
      >
        <span className={clsx('flex h-8 w-8 items-center justify-center rounded-full', iconClass)}>{icon}</span>
        <span className="font-semibold text-zinc-900">{title}</span>
        <span className="hidden text-xs text-zinc-500 sm:block">{preview || subtitle}</span>
        <span className="pill">{suggestions || 1} suggestion{suggestions === 1 ? '' : 's'}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div className="border-t border-zinc-100 bg-zinc-50/50 p-3">{field}</div>}
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
