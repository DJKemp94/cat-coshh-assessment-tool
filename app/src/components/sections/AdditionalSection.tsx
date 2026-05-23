import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Plus, Lightbulb, RotateCw, Archive, Siren,
  Cross, Droplets, Flame, Trash2, Sparkles, Info,
  CheckCircle2, AlertTriangle, Package, ShieldAlert, Skull,
  FlaskConical, ExternalLink, Download, Beaker, Biohazard,
} from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { appendUnique, ChipSuggestion } from '@/components/common/SuggestionChips';
import { SuggestionDisclaimer } from '@/components/common/SuggestionDisclaimer';
import { suggestRequirements, RequirementField } from '@/services/suggestRequirements';
import { GhsIcon } from '@/components/common/GhsPictograms';
import { GhsPictogram, Substance } from '@/types/assessment';

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

      <div className="space-y-4">
        <Card
          title="Storage & SDS"
          subtitle="Storage requirements and controls generated from GHS symbols and hazard codes."
          icon={<Archive size={18} />}
          iconClass="text-accent-700"
          defaultOpen
          right={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" className="btn-secondary text-xs">
                <RotateCw size={14} /> Re-analyze chemicals
              </button>
              <button type="button" className="btn-primary text-xs">
                <Download size={14} /> Export storage plan
              </button>
            </div>
          }
        >
          <StorageSdsPanel
            chemicals={allChems}
            sdsVersion={a.sdsVersion}
            sdsDate={a.sdsDate}
            onUpdateSds={(patch) => update(patch)}
            cheminventoryLogged={a.cheminventoryLogged}
            onSetCheminventoryLogged={(cheminventoryLogged) => update({ cheminventoryLogged })}
          />
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
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 text-zinc-600">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {icon && <span className={clsx('shrink-0', iconClass)}>{icon}</span>}
        <button onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="font-semibold text-zinc-900">{title}</div>
          {subtitle && <div className="text-xs text-zinc-500">{subtitle}</div>}
        </button>
        {right && <div className="w-full sm:ml-auto sm:w-auto">{right}</div>}
      </div>
      {open && <div className="px-4 pb-4 space-y-4 border-t border-zinc-100">{children}</div>}
    </div>
  );
}

const FLAMMABLE_CODES = ['H220', 'H221', 'H222', 'H223', 'H224', 'H225', 'H226', 'H228', 'H242'];
const CORROSIVE_CODES = ['H290', 'H314', 'H318'];
const ACUTE_TOXIC_CODES = ['H300', 'H301', 'H310', 'H311', 'H330', 'H331'];
const CHRONIC_TOXIC_CODES = ['H340', 'H341', 'H350', 'H351', 'H360', 'H361', 'H370', 'H371', 'H372', 'H373'];
const OXIDISING_CODES = ['H270', 'H271', 'H272'];
const WATER_REACTIVE_CODES = ['H260', 'H261'];

type StorageGroupId = '1' | '2a' | '2b' | '3' | '4' | '5a' | '5b' | '5c' | '6';

type StorageGroupDef = {
  id: StorageGroupId;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: string;
  border: string;
  guidance: string;
  dot: string;
};

type ChemicalStorageAssignment = {
  chemical: Substance;
  group: StorageGroupDef | null;
  suggestedGroup: StorageGroupDef | null;
  hCodes: string[];
  primaryHazards: string[];
  alert: string;
  alertLevel: 'ok' | 'warn' | 'danger';
  reason: string;
  overridden: boolean;
};

type StorageGroup = StorageGroupDef & {
  chemicals: ChemicalStorageAssignment[];
};

type ManualChemical = {
  id: string;
  name: string;
};

type StorageGroupForDisplay = StorageGroup & {
  manualChemicals: ManualChemical[];
};

const STORAGE_GROUP_DEFS: StorageGroupDef[] = [
  { id: '1', title: 'Flammable Liquids', subtitle: 'Flammable liquids', icon: <Flame size={26} />, tone: 'text-red-600 bg-red-50', border: 'border-t-red-500', dot: 'bg-red-500', guidance: 'Store in a flammable cabinet. Keep away from oxidisers, heat and sparks.' },
  { id: '2a', title: 'Acids, Inorganic', subtitle: 'Inorganic acids', icon: <ShieldAlert size={26} />, tone: 'text-orange-600 bg-orange-50', border: 'border-t-orange-500', dot: 'bg-orange-500', guidance: 'Store in corrosion-resistant storage. Keep away from alkalis, cyanides, sulphides and oxidisers unless compatibility is confirmed.' },
  { id: '2b', title: 'Acids, Organic', subtitle: 'Organic acids', icon: <ShieldAlert size={26} />, tone: 'text-amber-600 bg-amber-50', border: 'border-t-amber-500', dot: 'bg-amber-500', guidance: 'Store as corrosive organic acid material. Keep away from alkalis and oxidisers unless compatibility is confirmed.' },
  { id: '3', title: 'Alkalis (Bases)', subtitle: 'Bases / Alkalis', icon: <FlaskConical size={26} />, tone: 'text-blue-600 bg-blue-50', border: 'border-t-blue-500', dot: 'bg-blue-500', guidance: 'Store in compatible alkali storage. Keep away from acids.' },
  { id: '4', title: 'Oxidizers', subtitle: 'Oxidizing substances', icon: <Beaker size={26} />, tone: 'text-emerald-600 bg-emerald-50', border: 'border-t-emerald-500', dot: 'bg-emerald-500', guidance: 'Store away from flammables, organic materials, acids and reducing agents.' },
  { id: '5a', title: 'Poisons, Inorganic', subtitle: 'Inorganic poisons / toxics', icon: <Skull size={26} />, tone: 'text-violet-600 bg-violet-50', border: 'border-t-violet-500', dot: 'bg-violet-500', guidance: 'Store securely and segregate from organic materials and reducing agents.' },
  { id: '5b', title: 'Poisons, Organic', subtitle: 'Organic poisons / toxics', icon: <Skull size={26} />, tone: 'text-purple-600 bg-purple-50', border: 'border-t-purple-500', dot: 'bg-purple-500', guidance: 'Store securely in compatible storage. Restrict access and keep in the original container.' },
  { id: '5c', title: 'Schedule 1 Poisons', subtitle: 'Schedule 1 poisons', icon: <Biohazard size={26} />, tone: 'text-fuchsia-600 bg-fuchsia-50', border: 'border-t-fuchsia-500', dot: 'bg-fuchsia-500', guidance: 'Store in secure, locked storage with restricted access.' },
  { id: '6', title: 'Air / Water Reactives', subtitle: 'Air / water reactive substances', icon: <Droplets size={26} />, tone: 'text-cyan-700 bg-cyan-50', border: 'border-t-cyan-500', dot: 'bg-cyan-500', guidance: 'Keep dry, tightly closed, and away from water, acids and incompatible materials.' },
];

const COMPATIBILITY: Record<StorageGroupId, Record<StorageGroupId, boolean>> = {
  '1': { '1': true, '2a': false, '2b': true, '3': false, '4': false, '5a': false, '5b': true, '5c': false, '6': false },
  '2a': { '1': false, '2a': true, '2b': false, '3': false, '4': true, '5a': false, '5b': false, '5c': false, '6': false },
  '2b': { '1': true, '2a': false, '2b': true, '3': false, '4': false, '5a': false, '5b': false, '5c': false, '6': false },
  '3': { '1': false, '2a': false, '2b': false, '3': true, '4': true, '5a': true, '5b': false, '5c': false, '6': false },
  '4': { '1': false, '2a': true, '2b': false, '3': true, '4': true, '5a': true, '5b': false, '5c': false, '6': false },
  '5a': { '1': false, '2a': false, '2b': false, '3': true, '4': true, '5a': true, '5b': false, '5c': false, '6': false },
  '5b': { '1': true, '2a': false, '2b': false, '3': false, '4': false, '5a': false, '5b': true, '5c': false, '6': false },
  '5c': { '1': false, '2a': false, '2b': false, '3': false, '4': false, '5a': false, '5b': false, '5c': true, '6': false },
  '6': { '1': false, '2a': false, '2b': false, '3': false, '4': false, '5a': false, '5b': false, '5c': false, '6': true },
};

const groupById = (id: StorageGroupId) => STORAGE_GROUP_DEFS.find((g) => g.id === id)!;
const hasPictogram = (c: Substance, p: GhsPictogram) => c.ghsPictograms.includes(p);
const codeList = (c: Substance) => c.hazardStatements.map((h) => h.code.trim().toUpperCase()).filter(Boolean);
const hasHCode = (c: Substance, codes: string[]) => codeList(c).some((code) => codes.includes(code));

function looksOrganic(name: string) {
  return /\b(acet|ethyl|methyl|propyl|butyl|benz|phen|formic|acetic|citric|oxalic|ethidium|organic)\b/i.test(name);
}

function looksAlkali(name: string) {
  return /\b(alkali|base|hydroxide|ammonia|ammonium hydroxide|sodium carbonate|potassium carbonate)\b/i.test(name);
}

function looksAcid(name: string) {
  return /\bacid\b/i.test(name);
}

function suggestedGroupForChemical(chemical: Substance) {
  const name = chemical.name || chemical.cas || 'Unnamed chemical';
  const flammable = hasPictogram(chemical, 'flammable') || hasHCode(chemical, FLAMMABLE_CODES);
  const corrosive = hasPictogram(chemical, 'corrosive') || hasHCode(chemical, CORROSIVE_CODES);
  const oxidising = hasPictogram(chemical, 'oxidising') || hasHCode(chemical, OXIDISING_CODES);
  const waterReactive = hasHCode(chemical, WATER_REACTIVE_CODES);
  const toxic = hasPictogram(chemical, 'toxic') || hasHCode(chemical, ACUTE_TOXIC_CODES) || hasHCode(chemical, CHRONIC_TOXIC_CODES);
  const acid = corrosive && looksAcid(name);
  const alkali = corrosive && looksAlkali(name);
  const organic = looksOrganic(name);

  let groupId: StorageGroupId | null = null;
  let reason = 'No recognised storage trigger in current GHS/H-code data.';
  if (waterReactive) {
    groupId = '6';
    reason = 'H260/H261 air or water reactive trigger.';
  } else if (oxidising) {
    groupId = '4';
    reason = 'Oxidising pictogram or H270/H271/H272 trigger.';
  } else if (flammable) {
    groupId = '1';
    reason = 'Flammable pictogram or H220-H226/H228/H242 trigger.';
  } else if (acid) {
    groupId = organic ? '2b' : '2a';
    reason = `${organic ? 'Organic' : 'Inorganic'} acid inferred from corrosive GHS/H-codes and chemical name.`;
  } else if (alkali) {
    groupId = '3';
    reason = 'Alkali/base inferred from corrosive GHS/H-codes and chemical name.';
  } else if (toxic) {
    groupId = organic ? '5b' : '5a';
    reason = `${organic ? 'Organic' : 'Inorganic'} poison inferred from toxic GHS/H-codes and chemical name.`;
  } else if (corrosive) {
    groupId = '2a';
    reason = 'Corrosive GHS/H-codes detected; acid/base type not explicit, so review SDS.';
  }
  return { groupId, reason };
}

function classifyChemical(
  chemical: Substance,
  override?: StorageGroupId | 'review',
): ChemicalStorageAssignment {
  const hCodes = codeList(chemical);
  const flammable = hasPictogram(chemical, 'flammable') || hasHCode(chemical, FLAMMABLE_CODES);
  const corrosive = hasPictogram(chemical, 'corrosive') || hasHCode(chemical, CORROSIVE_CODES);
  const oxidising = hasPictogram(chemical, 'oxidising') || hasHCode(chemical, OXIDISING_CODES);
  const waterReactive = hasHCode(chemical, WATER_REACTIVE_CODES);
  const toxic = hasPictogram(chemical, 'toxic') || hasHCode(chemical, ACUTE_TOXIC_CODES) || hasHCode(chemical, CHRONIC_TOXIC_CODES);
  const primaryHazards = [
    flammable && 'Flammable liquid',
    corrosive && 'Corrosive',
    oxidising && 'Oxidising',
    waterReactive && 'Water reactive',
    toxic && 'Toxic',
  ].filter(Boolean) as string[];

  const suggested = suggestedGroupForChemical(chemical);
  const groupId = override === 'review' ? null : override ?? suggested.groupId;
  const overridden = override !== undefined;

  const group = groupId ? groupById(groupId) : null;
  const suggestedGroup = suggested.groupId ? groupById(suggested.groupId) : null;
  const incompatible = group
    ? STORAGE_GROUP_DEFS
      .filter((candidate) => candidate.id !== group.id && !COMPATIBILITY[group.id][candidate.id])
      .map((candidate) => candidate.title)
    : [];
  const alert = !group
    ? 'Check SDS sections 7 and 10'
    : incompatible.length
      ? `Do not store with ${incompatible.join(', ')}`
      : 'None';

  return {
    chemical,
    group,
    suggestedGroup,
    hCodes,
    primaryHazards,
    alert,
    alertLevel: !group ? 'warn' : incompatible.length ? 'danger' : 'ok',
    reason: overridden ? 'Assessor override. Verify against SDS sections 7 and 10.' : suggested.reason,
    overridden,
  };
}

function buildStoragePlan(chemicals: Substance[], overrides: Record<string, StorageGroupId | 'review'>) {
  const usable = chemicals.filter((c) => c.name.trim() || c.cas?.trim());
  const assignments = usable.map((chemical) => classifyChemical(chemical, overrides[chemical.id]));
  const groups = STORAGE_GROUP_DEFS.map((group) => ({
    ...group,
    chemicals: assignments.filter((a) => a.group?.id === group.id),
  }));
  return { groups, assignments, activeGroups: groups.filter((g) => g.chemicals.length > 0) };
}

function StorageSdsPanel({
  chemicals,
  sdsVersion,
  sdsDate,
  onUpdateSds,
  cheminventoryLogged,
  onSetCheminventoryLogged,
}: {
  chemicals: Substance[];
  sdsVersion: string;
  sdsDate: string;
  onUpdateSds: (patch: { sdsVersion?: string; sdsDate?: string }) => void;
  cheminventoryLogged: boolean;
  onSetCheminventoryLogged: (value: boolean) => void;
}) {
  const [overrides, setOverrides] = useState<Record<string, StorageGroupId | 'review'>>({});
  const [hoveredPair, setHoveredPair] = useState<[StorageGroupId, StorageGroupId] | null>(null);
  const [manualChemicals, setManualChemicals] = useState<Record<StorageGroupId, ManualChemical[]>>({
    '1': [],
    '2a': [],
    '2b': [],
    '3': [],
    '4': [],
    '5a': [],
    '5b': [],
    '5c': [],
    '6': [],
  });
  const { groups, assignments } = useMemo(() => buildStoragePlan(chemicals, overrides), [chemicals, overrides]);
  const displayGroups: StorageGroupForDisplay[] = useMemo(() => groups.map((group) => ({
    ...group,
    manualChemicals: manualChemicals[group.id] ?? [],
  })), [groups, manualChemicals]);
  const activeDisplayGroups = displayGroups.filter((group) => group.chemicals.length > 0 || group.manualChemicals.length > 0);
  const actionCount = assignments.filter((a) => a.alertLevel !== 'ok').length;
  const activeGroupIds = activeDisplayGroups.map((g) => g.id);
  const matrixAlerts = activeDisplayGroups.flatMap((group, groupIndex) =>
    activeDisplayGroups
      .filter((other, otherIndex) => otherIndex > groupIndex && !COMPATIBILITY[group.id][other.id])
      .map((other) => `${group.title} must be stored separately from ${other.title}.`),
  );
  const addManualChemical = (groupId: StorageGroupId, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setManualChemicals((current) => ({
      ...current,
      [groupId]: [
        ...(current[groupId] ?? []),
        { id: `manual-${groupId}-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: trimmed },
      ],
    }));
  };
  const removeManualChemical = (groupId: StorageGroupId, id: string) => {
    setManualChemicals((current) => ({
      ...current,
      [groupId]: (current[groupId] ?? []).filter((chemical) => chemical.id !== id),
    }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 p-4 lg:grid-cols-4">
        <SummaryMetric icon={<Package size={17} />} value={chemicals.length} label="Chemicals added" tone="text-accent-700" />
        <SummaryMetric icon={<FlaskConical size={17} />} value={activeDisplayGroups.length} label="Storage groups created" tone="text-blue-700" />
        <SummaryMetric icon={<ShieldAlert size={17} />} value={matrixAlerts.length} label="Segregation rules applied" tone="text-violet-700" />
        <SummaryMetric icon={<AlertTriangle size={17} />} value={actionCount} label="Action required" tone="text-red-600" />
      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            Recommended storage groups <Info size={14} className="text-zinc-400" />
          </div>
          <button type="button" className="text-xs font-medium text-accent-700">View full guidance</button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayGroups.map((group) => (
            <StorageGroupCard
              key={group.id}
              group={group}
              highlighted={hoveredPair?.includes(group.id) ?? false}
              onAddManualChemical={addManualChemical}
              onRemoveManualChemical={removeManualChemical}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Groups are created automatically from GHS pictograms, H-codes and compatibility rules. Acid/base and organic/inorganic splits should be verified against the SDS where the name is ambiguous.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            Chemical classification & storage assignment <Info size={14} className="text-zinc-400" />
          </div>
          <button type="button" className="btn-secondary text-xs">Edit columns</button>
        </div>
        <div className="space-y-3 xl:hidden">
          {assignments.map((assignment) => (
              <ClassificationCard
                key={`${assignment.chemical.id}-${assignment.group?.id ?? 'review'}-${assignment.alert}`}
                assignment={assignment}
                highlighted={assignment.group ? hoveredPair?.includes(assignment.group.id) ?? false : false}
                onOverride={(groupId) => {
                setOverrides((current) => {
                  const next = { ...current };
                  if (groupId === 'suggested') delete next[assignment.chemical.id];
                  else next[assignment.chemical.id] = groupId;
                  return next;
                });
              }}
            />
          ))}
          {assignments.length === 0 && (
            <div className="rounded-md border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
              Add chemicals in Process Steps to generate storage groups and compatibility checks.
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden xl:block">
          <table className="w-full table-fixed border-collapse text-left text-[11px]">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[19%]" />
              <col className="w-[20%]" />
              <col className="w-[19%]" />
            </colgroup>
            <thead>
              <tr className="border-y border-zinc-200 bg-zinc-50 text-zinc-600">
                <th className="px-2 py-2 font-semibold">Chemical</th>
                <th className="px-2 py-2 font-semibold">GHS pictograms</th>
                <th className="px-2 py-2 font-semibold">Key H-codes</th>
                <th className="px-2 py-2 font-semibold">Primary hazard</th>
                <th className="px-2 py-2 font-semibold">Storage group (auto)</th>
                <th className="px-2 py-2 font-semibold">Storage guidance</th>
                <th className="px-2 py-2 font-semibold">Segregation alerts</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <ClassificationRow
                  key={`${assignment.chemical.id}-${assignment.group?.id ?? 'review'}-${assignment.alert}`}
                  assignment={assignment}
                  highlighted={assignment.group ? hoveredPair?.includes(assignment.group.id) ?? false : false}
                  onOverride={(groupId) => {
                    setOverrides((current) => {
                      const next = { ...current };
                      if (groupId === 'suggested') delete next[assignment.chemical.id];
                      else next[assignment.chemical.id] = groupId;
                      return next;
                    });
                  }}
                />
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm text-zinc-500">
                    Add chemicals in Process Steps to generate storage groups and compatibility checks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
          Compatibility between storage groups <Info size={14} className="text-zinc-400" />
        </div>
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-green-600" /> Maybe compatible</span>
          <span className="inline-flex items-center gap-1"><span className="text-base font-bold text-red-600">x</span> Not compatible</span>
          <span className="inline-flex items-center gap-1"><AlertTriangle size={14} className="text-amber-500" /> Confirm with SDS</span>
        </div>
        <CompatibilityMatrix
          activeGroupIds={activeGroupIds}
          groups={displayGroups}
          hoveredPair={hoveredPair}
          onHoverPair={setHoveredPair}
        />
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
          <span>Based on the supplied storage compatibility table. Highlighted cells show incompatibilities between storage groups currently used in this assessment. Always confirm with the SDS.</span>
          <button type="button" className="font-medium text-accent-700">View full matrix</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label>
          <span className="field-label">SDS version number</span>
          <input className="field-input" value={sdsVersion} onChange={(e) => onUpdateSds({ sdsVersion: e.target.value })} placeholder="e.g. v3.1" />
        </label>
        <label>
          <span className="field-label">SDS date</span>
          <input type="date" className="field-input" value={sdsDate} onChange={(e) => onUpdateSds({ sdsDate: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 md:col-span-2">
          <input
            type="checkbox"
            checked={cheminventoryLogged}
            onChange={(e) => onSetCheminventoryLogged(e.target.checked)}
          />
          Hazardous substance logged into ChemInventory
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-blue-800">
            <Info size={15} /> How this works
          </div>
          <p className="text-xs leading-relaxed text-zinc-600">
            We classify chemicals using the H-codes and GHS pictograms recorded in the COSHH assessment, then apply the supplied storage compatibility table.
          </p>
          <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
            Learn more <ExternalLink size={12} />
          </button>
        </div>
        <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-violet-800">
            <Info size={15} /> Important
          </div>
          <p className="text-xs leading-relaxed text-zinc-600">
            This is guidance only. Always verify the SDS and local storage procedures before storing chemicals.
          </p>
        </div>
      </div>
    </div>
  );
}

function StorageGroupCard({
  group,
  highlighted,
  onAddManualChemical,
  onRemoveManualChemical,
}: {
  group: StorageGroupForDisplay;
  highlighted?: boolean;
  onAddManualChemical: (groupId: StorageGroupId, name: string) => void;
  onRemoveManualChemical: (groupId: StorageGroupId, id: string) => void;
}) {
  const [manualName, setManualName] = useState('');
  const totalChemicals = group.chemicals.length + group.manualChemicals.length;
  const addManual = () => {
    onAddManualChemical(group.id, manualName);
    setManualName('');
  };

  return (
    <div className={clsx('min-h-44 rounded-lg border border-zinc-200 border-t-4 bg-white p-4 shadow-sm transition', group.border, highlighted && 'ring-2 ring-red-300 bg-red-50/30')}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-2">
          <span className={clsx('inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-bold', group.tone)}>
            {group.id}
          </span>
          <span className={clsx('flex h-11 w-11 items-center justify-center rounded-full', group.tone)}>
            {group.icon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-zinc-900">{group.title}</div>
          <div className="mt-1 text-sm text-zinc-600">{group.subtitle}</div>
        </div>
      </div>
      <div className="mt-4 border-t border-zinc-100 pt-3">
        <div className="text-xs font-semibold text-zinc-700">
          Chemicals ({totalChemicals})
        </div>
        {totalChemicals > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.chemicals.map(({ chemical }) => (
              <span key={chemical.id} className="inline-flex max-w-full items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-900 shadow-sm">
                {chemical.name || chemical.cas || 'Unnamed chemical'}
              </span>
            ))}
            {group.manualChemicals.map((chemical) => (
              <span key={chemical.id} className="inline-flex max-w-full items-center gap-1 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-semibold text-accent-900 shadow-sm">
                <span className="truncate">{chemical.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveManualChemical(group.id, chemical.id)}
                  className="rounded text-accent-700 hover:bg-accent-100"
                  aria-label={`Remove ${chemical.name} from ${group.title}`}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-1 text-xs text-zinc-500">No chemicals in this group</div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addManual();
            }
          }}
          placeholder="Add chemical manually"
        />
        <button type="button" onClick={addManual} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="mt-2">
        {group.chemicals.length > 0 && (
          <span className="inline-flex rounded-md bg-accent-50 px-2 py-1 text-[11px] font-medium text-accent-800">Auto-generated</span>
        )}
        {group.manualChemicals.length > 0 && (
          <span className="ml-1 inline-flex rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-700">Manual</span>
        )}
      </div>
    </div>
  );
}

function chemicalNamesForGroup(groups: StorageGroupForDisplay[], groupId: StorageGroupId) {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) return [];
  return [
    ...group.chemicals.map(({ chemical }) => chemical.name || chemical.cas || 'Unnamed chemical'),
    ...group.manualChemicals.map((chemical) => chemical.name),
  ];
}

function CompatibilityMatrix({
  activeGroupIds,
  groups,
  hoveredPair,
  onHoverPair,
}: {
  activeGroupIds: StorageGroupId[];
  groups: StorageGroupForDisplay[];
  hoveredPair: [StorageGroupId, StorageGroupId] | null;
  onHoverPair: (pair: [StorageGroupId, StorageGroupId] | null) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-center text-[11px]">
        <thead>
          <tr>
            <th className="border border-zinc-200 bg-zinc-50 p-2 text-left text-zinc-500">Group</th>
            {STORAGE_GROUP_DEFS.map((group) => (
              <th key={group.id} className={clsx('border border-zinc-200 bg-zinc-50 p-2 font-semibold text-zinc-700', activeGroupIds.includes(group.id) && 'bg-accent-50 text-accent-900')}>
                <div>{group.id}</div>
                <div className="mx-auto mt-1 max-w-16 leading-tight">{group.title}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STORAGE_GROUP_DEFS.map((row) => (
            <tr key={row.id}>
              <th className={clsx('border border-zinc-200 bg-zinc-50 p-2 text-left font-semibold text-zinc-700', activeGroupIds.includes(row.id) && 'bg-accent-50 text-accent-900')}>
                <span className={clsx('mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px]', row.tone)}>{row.id}</span>
                {row.title}
              </th>
              {STORAGE_GROUP_DEFS.map((col) => {
                const ok = COMPATIBILITY[row.id][col.id];
                const activePair = activeGroupIds.includes(row.id) && activeGroupIds.includes(col.id);
                const highlightedConflict = activePair && !ok;
                const activeHover = hoveredPair?.includes(row.id) && hoveredPair?.includes(col.id);
                const rowChemicals = chemicalNamesForGroup(groups, row.id);
                const colChemicals = chemicalNamesForGroup(groups, col.id);
                return (
                  <td
                    key={col.id}
                    onMouseEnter={() => highlightedConflict && onHoverPair([row.id, col.id])}
                    onMouseLeave={() => highlightedConflict && onHoverPair(null)}
                    className={clsx(
                      'group relative border border-zinc-200 p-2 transition',
                      highlightedConflict && 'bg-red-50 hover:bg-red-100 focus-within:bg-red-100',
                      activePair && 'hover:ring-2 hover:ring-red-200',
                      activeHover && 'bg-red-100 ring-2 ring-red-200',
                    )}
                  >
                    {highlightedConflict ? (
                      <button
                        type="button"
                        className="mx-auto flex h-6 w-6 items-center justify-center rounded text-base font-bold text-red-600 outline-none focus:ring-2 focus:ring-red-300"
                        onFocus={() => onHoverPair([row.id, col.id])}
                        onBlur={() => onHoverPair(null)}
                        aria-label={`${row.title} must be separated from ${col.title}. ${row.title}: ${rowChemicals.join(', ') || 'No chemicals'}. ${col.title}: ${colChemicals.join(', ') || 'No chemicals'}.`}
                      >
                        x
                      </button>
                    ) : ok ? (
                      <CheckCircle2 size={16} className="mx-auto text-green-600" />
                    ) : (
                      <span className="text-base font-bold text-red-600">x</span>
                    )}
                    {highlightedConflict && (
                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-lg group-hover:block group-focus-within:block">
                        <div className="text-xs font-semibold text-zinc-900">Separate these storage groups</div>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <MatrixChemicalList title={row.title} chemicals={rowChemicals} tone={row.tone} />
                          <MatrixChemicalList title={col.title} chemicals={colChemicals} tone={col.tone} />
                        </div>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixChemicalList({
  title,
  chemicals,
  tone,
}: {
  title: string;
  chemicals: string[];
  tone: string;
}) {
  return (
    <div>
      <div className={clsx('inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold', tone)}>{title}</div>
      <ul className="mt-1 space-y-1 text-[11px] leading-snug text-zinc-700">
        {chemicals.length > 0
          ? chemicals.map((chemical) => <li key={chemical}>{chemical}</li>)
          : <li className="text-zinc-400">No chemicals</li>}
      </ul>
    </div>
  );
}

function ClassificationRow({
  assignment,
  highlighted,
  onOverride,
}: {
  assignment: ChemicalStorageAssignment;
  highlighted: boolean;
  onOverride: (groupId: StorageGroupId | 'review' | 'suggested') => void;
}) {
  const { chemical, group } = assignment;
  const [guidance, setGuidance] = useState(group?.guidance ?? 'Check sections 7 and 10 before assigning storage.');
  const [alertText, setAlertText] = useState(assignment.alert);

  return (
    <tr className={clsx('border-b border-zinc-100 align-top transition', highlighted && 'bg-red-50/60')}>
      <td className="break-words px-3 py-3 font-semibold text-zinc-900">{chemical.name || chemical.cas || 'Unnamed chemical'}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {chemical.ghsPictograms.length > 0
            ? chemical.ghsPictograms.map((id) => <GhsIcon key={id} id={id} size={26} />)
            : <span className="text-zinc-400">None</span>}
        </div>
      </td>
      <td className="break-words px-3 py-3 text-zinc-700">{assignment.hCodes.join(', ') || 'None recorded'}</td>
      <td className="px-3 py-3">
        <div className="space-y-1">
          {(assignment.primaryHazards.length ? assignment.primaryHazards : ['Unclassified']).map((hazard) => (
            <div key={hazard} className="grid grid-cols-[0.625rem_1fr] items-start gap-2 text-zinc-700">
              <span className={clsx('mt-[0.35rem] h-2 w-2 rounded-full', group?.dot ?? 'bg-zinc-400')} />
              {hazard}
            </div>
          ))}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="relative">
          <select
            aria-label={`Storage group for ${chemical.name || chemical.cas || 'chemical'}`}
            className={clsx(
              'min-h-9 w-full whitespace-normal appearance-none rounded-md border px-2 py-1.5 pr-7 text-left text-[11px] font-semibold leading-tight outline-none focus:ring-2 focus:ring-accent-500',
              group ? `${group.tone} border-transparent` : 'border-zinc-200 bg-zinc-100 text-zinc-600',
              assignment.overridden && 'ring-1 ring-amber-300',
            )}
            value={assignment.overridden ? group?.id ?? 'review' : 'suggested'}
            onChange={(e) => onOverride(e.target.value as StorageGroupId | 'review' | 'suggested')}
          >
            <option value="suggested">
              {assignment.suggestedGroup ? `${assignment.suggestedGroup.id} - ${assignment.suggestedGroup.title}` : 'Review SDS'}
            </option>
            {STORAGE_GROUP_DEFS.map((g) => (
              <option key={g.id} value={g.id}>{g.id} - {g.title}</option>
            ))}
            <option value="review">Review SDS / unassigned</option>
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-70" />
        </div>
      </td>
      <td className="px-3 py-3">
        <textarea
          className="min-h-20 w-full resize-y rounded-md border border-transparent bg-transparent p-1 text-xs leading-relaxed text-zinc-700 outline-none hover:border-zinc-200 hover:bg-white focus:border-accent-300 focus:bg-white focus:ring-2 focus:ring-accent-100"
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          aria-label={`Storage guidance for ${chemical.name || chemical.cas || 'chemical'}`}
        />
      </td>
      <td className="px-3 py-3">
        <textarea
          className={clsx(
            'min-h-20 w-full resize-y rounded-md border border-transparent bg-transparent p-1 text-xs leading-relaxed outline-none hover:border-zinc-200 hover:bg-white focus:border-accent-300 focus:bg-white focus:ring-2 focus:ring-accent-100',
            assignment.alertLevel === 'danger' ? 'text-red-700' : assignment.alertLevel === 'ok' ? 'text-accent-700' : 'text-zinc-700',
          )}
          value={alertText}
          onChange={(e) => setAlertText(e.target.value)}
          aria-label={`Segregation alerts for ${chemical.name || chemical.cas || 'chemical'}`}
        />
      </td>
    </tr>
  );
}

function ClassificationCard({
  assignment,
  highlighted,
  onOverride,
}: {
  assignment: ChemicalStorageAssignment;
  highlighted: boolean;
  onOverride: (groupId: StorageGroupId | 'review' | 'suggested') => void;
}) {
  const { chemical, group } = assignment;
  const [guidance, setGuidance] = useState(group?.guidance ?? 'Check sections 7 and 10 before assigning storage.');
  const [alertText, setAlertText] = useState(assignment.alert);

  return (
    <div className={clsx('rounded-lg border border-zinc-200 bg-white p-3 transition', highlighted && 'border-red-200 bg-red-50/50 ring-2 ring-red-200')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-sm font-semibold text-zinc-900">{chemical.name || chemical.cas || 'Unnamed chemical'}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {chemical.ghsPictograms.length > 0
              ? chemical.ghsPictograms.map((id) => <GhsIcon key={id} id={id} size={24} />)
              : <span className="text-xs text-zinc-400">No GHS pictograms</span>}
          </div>
        </div>
        <div className="min-w-[13rem] max-w-full flex-1 sm:flex-none">
          <StorageGroupSelect assignment={assignment} chemical={chemical} group={group} onOverride={onOverride} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold text-zinc-500">Key H-codes</div>
          <div className="mt-1 break-words text-xs text-zinc-700">{assignment.hCodes.join(', ') || 'None recorded'}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-zinc-500">Primary hazard</div>
          <div className="mt-1 space-y-1">
            {(assignment.primaryHazards.length ? assignment.primaryHazards : ['Unclassified']).map((hazard) => (
              <div key={hazard} className="grid grid-cols-[0.625rem_1fr] items-start gap-2 text-xs text-zinc-700">
                <span className={clsx('mt-[0.35rem] h-2 w-2 rounded-full', group?.dot ?? 'bg-zinc-400')} />
                {hazard}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          <span className="text-[11px] font-semibold text-zinc-500">Storage guidance</span>
          <textarea
            className="mt-1 min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-xs leading-relaxed text-zinc-700 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
          />
        </label>
        <label>
          <span className="text-[11px] font-semibold text-zinc-500">Segregation alerts</span>
          <textarea
            className={clsx(
              'mt-1 min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-xs leading-relaxed outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100',
              assignment.alertLevel === 'danger' ? 'text-red-700' : assignment.alertLevel === 'ok' ? 'text-accent-700' : 'text-zinc-700',
            )}
            value={alertText}
            onChange={(e) => setAlertText(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function StorageGroupSelect({
  assignment,
  chemical,
  group,
  onOverride,
}: {
  assignment: ChemicalStorageAssignment;
  chemical: Substance;
  group: StorageGroupDef | null;
  onOverride: (groupId: StorageGroupId | 'review' | 'suggested') => void;
}) {
  return (
    <div className="relative">
      <select
        aria-label={`Storage group for ${chemical.name || chemical.cas || 'chemical'}`}
        className={clsx(
          'min-h-9 w-full whitespace-normal appearance-none rounded-md border px-2 py-1.5 pr-7 text-left text-[11px] font-semibold leading-tight outline-none focus:ring-2 focus:ring-accent-500',
          group ? `${group.tone} border-transparent` : 'border-zinc-200 bg-zinc-100 text-zinc-600',
          assignment.overridden && 'ring-1 ring-amber-300',
        )}
        value={assignment.overridden ? group?.id ?? 'review' : 'suggested'}
        onChange={(e) => onOverride(e.target.value as StorageGroupId | 'review' | 'suggested')}
      >
        <option value="suggested">
          {assignment.suggestedGroup ? `${assignment.suggestedGroup.id} - ${assignment.suggestedGroup.title}` : 'Review SDS'}
        </option>
        {STORAGE_GROUP_DEFS.map((g) => (
          <option key={g.id} value={g.id}>{g.id} - {g.title}</option>
        ))}
        <option value="review">Review SDS / unassigned</option>
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-70" />
    </div>
  );
}

function SummaryMetric({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  return (
    <div className="grid grid-cols-[2rem_3rem_1fr] items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2">
      <span className={tone}>{icon}</span>
      <span className="text-lg font-semibold text-zinc-700">{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
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
