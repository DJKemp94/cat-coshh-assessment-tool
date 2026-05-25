import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Plus, Archive,
  Droplets, Flame, Info,
  CheckCircle2, Package, ShieldAlert, Skull,
  FlaskConical, ExternalLink, Download, Beaker, Biohazard,
  Grid3X3,
} from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { SuggestionDisclaimer } from '@/components/common/SuggestionDisclaimer';
import { GhsIcon } from '@/components/common/GhsPictograms';
import { Substance } from '@/types/assessment';
import { classifyStorage, StorageConfidence, StorageGroupId } from '@/services/storageClassifier';

export function AdditionalSection() {
  const a = useAssessment((s) => s.assessment.additional);
  const assessment = useAssessment((s) => s.assessment);
  const update = useAssessment((s) => s.updateStorage);

  const allChems = useMemo(() => {
    const seen = new Set<string>();
    return assessment.processSteps
      .flatMap((st) => st.chemicals)
      .filter((c) => {
        const key = (c.cas ?? c.name).toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [assessment.processSteps]);
  const totalChems = allChems.length;

  return (
    <section>
      <SectionHeader
        title="Storage"
        subtitle={
          totalChems > 0
            ? `Suggestions below are derived from H-codes and GHS pictograms across the ${totalChems} chemical${totalChems === 1 ? '' : 's'} you've added.`
            : 'Add chemicals in the Process Steps section to see hazard-driven suggestions here.'
        }
      />
      <SuggestionDisclaimer variant="storage" />

      <div className="space-y-4">
        <Card
          title="Storage & SDS"
          subtitle="Storage requirements and controls generated from GHS symbols and hazard codes."
          icon={<Archive size={18} />}
          iconClass="text-accent-700"
          defaultOpen
          right={
            <button type="button" className="btn-primary text-xs">
              <Download size={14} /> Export storage plan
            </button>
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
  confidence: StorageConfidence;
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
  { id: '1', title: 'Flammable Cabinet', subtitle: 'Flammable liquids', icon: <Flame size={26} />, tone: 'text-blue-700 bg-blue-50', border: 'border-t-blue-500', dot: 'bg-blue-500', guidance: 'Keep away from heat, sparks, ignition sources and oxidizers.' },
  { id: '2a', title: 'Corrosives Cabinet (Acids)', subtitle: 'Inorganic acids', icon: <ShieldAlert size={26} />, tone: 'text-violet-700 bg-violet-50', border: 'border-t-violet-500', dot: 'bg-violet-500', guidance: 'Store acids separately from bases, cyanides, sulphides and oxidizers.' },
  { id: '2b', title: 'Organic Acids Cabinet', subtitle: 'Organic acids', icon: <ShieldAlert size={26} />, tone: 'text-amber-700 bg-amber-50', border: 'border-t-amber-500', dot: 'bg-amber-500', guidance: 'Store organic acids separately from bases and oxidizers unless the SDS confirms compatibility.' },
  { id: '3', title: 'Corrosives Cabinet (Bases)', subtitle: 'Bases / Alkalis', icon: <FlaskConical size={26} />, tone: 'text-orange-700 bg-orange-50', border: 'border-t-orange-500', dot: 'bg-orange-500', guidance: 'Store bases separately from acids and oxidizers.' },
  { id: '4', title: 'Oxidizers Cabinet', subtitle: 'Oxidizing substances', icon: <Beaker size={26} />, tone: 'text-amber-700 bg-amber-50', border: 'border-t-amber-500', dot: 'bg-amber-500', guidance: 'Keep away from organic materials, flammables, acids and reducing agents.' },
  { id: '5a', title: 'Toxins Cabinet', subtitle: 'Inorganic poisons / toxics', icon: <Skull size={26} />, tone: 'text-rose-700 bg-rose-50', border: 'border-t-rose-500', dot: 'bg-rose-500', guidance: 'Store securely with restricted access and compatible secondary containment.' },
  { id: '5b', title: 'Toxins Cabinet', subtitle: 'Organic poisons / toxics', icon: <Skull size={26} />, tone: 'text-rose-700 bg-rose-50', border: 'border-t-rose-500', dot: 'bg-rose-500', guidance: 'Store securely with restricted access. Keep liquids below solids where practicable.' },
  { id: '5c', title: 'Locked Poisons Cabinet', subtitle: 'Schedule 1 poisons', icon: <Biohazard size={26} />, tone: 'text-pink-700 bg-pink-50', border: 'border-t-pink-500', dot: 'bg-pink-500', guidance: 'Store in locked storage with access restricted to authorised users.' },
  { id: '6', title: 'Reactive Materials Cabinet', subtitle: 'Air / water reactive substances', icon: <Droplets size={26} />, tone: 'text-cyan-700 bg-cyan-50', border: 'border-t-cyan-500', dot: 'bg-cyan-500', guidance: 'Keep dry, tightly closed, and away from water, acids and incompatible materials.' },
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
const storageGroupLabel = (group: Pick<StorageGroupDef, 'id' | 'title'>) => {
  switch (group.id) {
    case '1': return 'Flammable liquids';
    case '2a': return 'Corrosive acids';
    case '2b': return 'Organic acids';
    case '3': return 'Corrosive bases';
    case '4': return 'Oxidizers';
    case '5a': return 'Inorganic toxins';
    case '5b': return 'Organic toxins';
    case '5c': return 'Schedule 1 poisons';
    case '6': return 'Reactive materials';
    default: return group.title.replace(/\s+Cabinet\b/g, '');
  }
};
function suggestedGroupForChemical(chemical: Substance) {
  const classification = classifyStorage(chemical);
  return {
    groupId: classification.groupId,
    reason: classification.reason,
    confidence: classification.confidence,
    hCodes: classification.hCodes,
    primaryHazards: classification.primaryHazards,
  };
}

function classifyChemical(
  chemical: Substance,
  override?: StorageGroupId | 'review',
): ChemicalStorageAssignment {
  const suggested = suggestedGroupForChemical(chemical);
  const groupId = override === 'review' ? null : override ?? suggested.groupId;
  const overridden = override !== undefined;

  const group = groupId ? groupById(groupId) : null;
  const suggestedGroup = suggested.groupId ? groupById(suggested.groupId) : null;
  const incompatible = group
    ? STORAGE_GROUP_DEFS
      .filter((candidate) => candidate.id !== group.id && !COMPATIBILITY[group.id][candidate.id])
      .map((candidate) => storageGroupLabel(candidate))
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
    hCodes: suggested.hCodes,
    primaryHazards: suggested.primaryHazards,
    alert,
    alertLevel: !group ? 'warn' : incompatible.length ? 'danger' : 'ok',
    reason: overridden ? 'Assessor override. Verify against SDS sections 7 and 10.' : suggested.reason,
    confidence: overridden ? 'review' : suggested.confidence,
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
      .map((other) => `${storageGroupLabel(group)} must be stored separately from ${storageGroupLabel(other)}.`),
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

      <StoragePlanDashboard
        groups={displayGroups}
        assignments={assignments}
        highlightedGroupIds={hoveredPair ?? []}
        matrixAlertCount={matrixAlerts.length}
        actionCount={actionCount}
        onAddManualChemical={addManualChemical}
        onRemoveManualChemical={removeManualChemical}
      />

      <div id="storage-compatibility-matrix" className="rounded-lg border border-zinc-200 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
          Compatibility between storage groups <Info size={14} className="text-zinc-400" />
        </div>
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-green-600" /> Maybe compatible - check SDS</span>
          <span className="inline-flex items-center gap-1"><span className="text-base font-bold text-red-600">x</span> Not compatible</span>
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

const CABINET_STYLE: Record<StorageGroupId, {
  border: string;
  header: string;
  text: string;
  soft: string;
  shelf: string;
}> = {
  '1': {
    border: 'border-blue-400',
    header: 'bg-blue-50 text-blue-700',
    text: 'text-blue-700',
    soft: 'bg-blue-50/80 border-blue-200',
    shelf: 'from-blue-50/45',
  },
  '2a': {
    border: 'border-violet-400',
    header: 'bg-violet-50 text-violet-700',
    text: 'text-violet-700',
    soft: 'bg-violet-50/80 border-violet-200',
    shelf: 'from-violet-50/45',
  },
  '2b': {
    border: 'border-amber-400',
    header: 'bg-amber-50 text-amber-700',
    text: 'text-amber-700',
    soft: 'bg-amber-50/80 border-amber-200',
    shelf: 'from-amber-50/45',
  },
  '3': {
    border: 'border-orange-400',
    header: 'bg-orange-50 text-orange-700',
    text: 'text-orange-700',
    soft: 'bg-orange-50/80 border-orange-200',
    shelf: 'from-orange-50/45',
  },
  '4': {
    border: 'border-amber-400',
    header: 'bg-amber-50 text-amber-700',
    text: 'text-amber-700',
    soft: 'bg-amber-50/80 border-amber-200',
    shelf: 'from-amber-50/45',
  },
  '5a': {
    border: 'border-rose-400',
    header: 'bg-rose-50 text-rose-700',
    text: 'text-rose-700',
    soft: 'bg-rose-50/80 border-rose-200',
    shelf: 'from-rose-50/45',
  },
  '5b': {
    border: 'border-rose-400',
    header: 'bg-rose-50 text-rose-700',
    text: 'text-rose-700',
    soft: 'bg-rose-50/80 border-rose-200',
    shelf: 'from-rose-50/45',
  },
  '5c': {
    border: 'border-pink-400',
    header: 'bg-pink-50 text-pink-700',
    text: 'text-pink-700',
    soft: 'bg-pink-50/80 border-pink-200',
    shelf: 'from-pink-50/45',
  },
  '6': {
    border: 'border-cyan-400',
    header: 'bg-cyan-50 text-cyan-700',
    text: 'text-cyan-700',
    soft: 'bg-cyan-50/80 border-cyan-200',
    shelf: 'from-cyan-50/45',
  },
};

const STORAGE_LAYOUT_ORDER: StorageGroupId[] = ['1', '2a', '3', '4', '2b', '5a', '5b', '5c', '6'];

const hasGroupChemicals = (group: StorageGroupForDisplay) =>
  group.chemicals.length > 0 || group.manualChemicals.length > 0;

const cabinetZoneLabels = (groupId: StorageGroupId) => {
  switch (groupId) {
    case '1':
      return ['Organic solvents and organic acids', 'Volatile poisons and chlorinated solvents'];
    case '2a':
      return ['Non-oxidizing organic and mineral acids', 'Oxidizing acids in double containment'];
    case '2b':
      return ['Organic acids', 'Organic acids in secondary containment'];
    case '3':
      return ['Solid/powder bases', 'Liquid bases'];
    case '4':
      return ['Oxidizers'];
    case '5a':
    case '5b':
    case '5c':
      return ['Non-volatile poisons - dry', 'Non-volatile poisons - liquid'];
    case '6':
      return ['Air / water reactive materials', 'Keep dry and isolated'];
    default:
      return ['Compatible materials', 'Compatible materials'];
  }
};

function StoragePlanDashboard({
  groups,
  assignments,
  highlightedGroupIds,
  matrixAlertCount,
  actionCount,
  onAddManualChemical,
  onRemoveManualChemical,
}: {
  groups: StorageGroupForDisplay[];
  assignments: ChemicalStorageAssignment[];
  highlightedGroupIds: StorageGroupId[];
  matrixAlertCount: number;
  actionCount: number;
  onAddManualChemical: (groupId: StorageGroupId, name: string) => void;
  onRemoveManualChemical: (groupId: StorageGroupId, id: string) => void;
}) {
  const orderedGroups = STORAGE_LAYOUT_ORDER
    .map((id) => groups.find((group) => group.id === id))
    .filter(Boolean) as StorageGroupForDisplay[];
  const visibleGroups = orderedGroups.filter(hasGroupChemicals);
  const unassigned = assignments.filter((assignment) => !assignment.group);
  const activeGroupCount = visibleGroups.length + (unassigned.length > 0 ? 1 : 0);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Recommended Storage Layout</h3>
              <p className="mt-1 text-sm text-zinc-600">Store chemicals in separate cabinets based on compatibility.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill">{activeGroupCount} active group{activeGroupCount === 1 ? '' : 's'}</span>
              <span className={clsx('pill', matrixAlertCount > 0 && '!border-rose-200 !bg-rose-50 !text-rose-700')}>{matrixAlertCount} separation alert{matrixAlertCount === 1 ? '' : 's'}</span>
              <span className={clsx('pill', actionCount > 0 && '!border-amber-200 !bg-amber-50 !text-amber-800')}>{actionCount} review item{actionCount === 1 ? '' : 's'}</span>
              <a href="#storage-compatibility-matrix" className="btn-secondary text-xs">
                <Grid3X3 size={14} /> View compatibility matrix
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleGroups.map((group) => (
              <StorageCabinetCard
                key={group.id}
                group={group}
                compact={visibleGroups.length > 4}
                highlighted={highlightedGroupIds.includes(group.id)}
                onAddManualChemical={onAddManualChemical}
                onRemoveManualChemical={onRemoveManualChemical}
              />
            ))}
            {unassigned.length > 0 && <GeneralShelvingCard assignments={unassigned} />}
            {visibleGroups.length === 0 && unassigned.length === 0 && (
              <div className="rounded-md border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                Add chemicals in Process Steps to generate active storage cabinets.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
            <span><strong className="text-zinc-800">Important note:</strong> This layout is guidance based on recorded GHS/H-code data. Always verify SDS sections 7 and 10 and local chemical storage rules.</span>
            <button type="button" className="btn-secondary text-xs">
              <Download size={14} /> Download Storage Plan
            </button>
          </div>
    </div>
  );
}

function StorageCabinetCard({
  group,
  compact,
  highlighted,
  onAddManualChemical,
  onRemoveManualChemical,
}: {
  group: StorageGroupForDisplay;
  compact?: boolean;
  highlighted?: boolean;
  onAddManualChemical: (groupId: StorageGroupId, name: string) => void;
  onRemoveManualChemical: (groupId: StorageGroupId, id: string) => void;
}) {
  const [manualName, setManualName] = useState('');
  const style = CABINET_STYLE[group.id];
  const totalChemicals = group.chemicals.length + group.manualChemicals.length;
  const addManual = () => {
    onAddManualChemical(group.id, manualName);
    setManualName('');
  };

  return (
    <div
      className={clsx('overflow-hidden rounded-lg border bg-white transition', style.border, highlighted && 'ring-2 ring-rose-300')}
      data-storage-cabinet={group.id}
    >
      <div className={clsx('flex items-center gap-2 border-b px-3 py-3 text-sm font-semibold', style.header, style.border)}>
        <span className={style.text}>{group.icon}</span>
        <span className="min-w-0 leading-tight">{group.title}</span>
      </div>

      <div className="p-2">
        <CabinetShelf group={group} compact={compact} />
        <p className="mt-2 min-h-8 text-center text-xs leading-snug text-zinc-600">{group.guidance}</p>
        <div className={clsx('mt-3 rounded-md border p-3 text-xs', style.soft)}>
          <div className={clsx('font-semibold', style.text)}>What can be stored:</div>
          <p className="mt-1 leading-relaxed text-zinc-700">{group.subtitle}. {group.guidance}</p>
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
            placeholder="Add chemical"
          />
          <button type="button" onClick={addManual} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">
            <Plus size={12} /> Add
          </button>
        </div>
        {totalChemicals === 0 && <div className="mt-2 text-center text-[11px] text-zinc-400">No chemicals assigned</div>}
        {group.manualChemicals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {group.manualChemicals.map((chemical) => (
              <button
                key={chemical.id}
                type="button"
                onClick={() => onRemoveManualChemical(group.id, chemical.id)}
                className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100"
                title="Click to remove"
              >
                {chemical.name} x
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CabinetShelf({ group, compact }: { group: StorageGroupForDisplay; compact?: boolean }) {
  const minRows = group.id === '4' ? 1 : 2;
  const visibleSlotCount = minRows * 3;
  const items = [
    ...group.chemicals.map((assignment) => ({ id: assignment.chemical.id, name: assignment.chemical.name || assignment.chemical.cas || 'Unnamed chemical', form: assignment.chemical.form, assignment })),
    ...group.manualChemicals.map((chemical) => ({ id: chemical.id, name: chemical.name, form: 'liquid' as Substance['form'] })),
  ];
  const rowCount = Math.max(minRows, Math.ceil(Math.max(items.length, visibleSlotCount) / 3));
  const style = CABINET_STYLE[group.id];
  const zones = cabinetZoneLabels(group.id);
  const rows = Array.from({ length: rowCount }, (_, index) => index);

  return (
    <div
      className={clsx(
        'relative grid overflow-hidden rounded-md border border-zinc-200 bg-gradient-to-br to-white shadow-inner',
        compact ? 'min-h-64' : 'min-h-72',
        style.shelf,
      )}
      style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
    >
      {rows.map((row) => (
        <div key={row} className="relative grid grid-cols-3 items-end gap-3 border-b border-zinc-200/80 px-3 pb-6 pt-10 last:border-b-0">
          <div
            className={clsx('absolute inset-x-0 top-0 min-h-7 border-b px-2 py-1 text-center text-[10px] font-semibold leading-tight', style.header, style.border)}
            data-zone-label
          >
            {zones[row] ?? zones[zones.length - 1] ?? 'Compatible materials'}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-3 border-t border-zinc-200 bg-zinc-100/80" data-shelf-bottom />
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 h-5 border-x border-b border-zinc-300/90" />
          {items.slice(row * 3, row * 3 + 3).map((item) => (
            <ChemicalContainer key={item.id} name={item.name} form={item.form} tone={group.id} />
          ))}
          {Array.from({ length: Math.max(0, 3 - items.slice(row * 3, row * 3 + 3).length) }).map((_, index) => (
            <ChemicalContainer key={`placeholder-${row}-${index}`} name="" form="liquid" muted />
          ))}
        </div>
      ))}
    </div>
  );
}

function ChemicalContainer({
  name,
  form,
  tone,
  muted,
}: {
  name: string;
  form: Substance['form'];
  tone?: StorageGroupId;
  muted?: boolean;
}) {
  const isGas = form === 'gas' || form === 'vapour' || form === 'aerosol' || form === 'mist';
  const isSolid = form === 'solid' || form === 'powder';
  const color = muted
    ? 'bg-zinc-100 border-zinc-200 opacity-40'
    : tone === '1'
      ? 'bg-orange-700 border-orange-800'
      : tone === '5a' || tone === '5b' || tone === '5c'
        ? 'bg-zinc-800 border-zinc-900'
        : 'bg-white border-zinc-300';
  const cap = tone === '1' || tone === '5a' || tone === '5b' || tone === '5c' ? 'bg-red-600' : tone === '3' ? 'bg-blue-600' : 'bg-zinc-100';

  return (
    <div className="relative z-10 flex min-w-0 flex-col items-center justify-end gap-1.5">
      <div
        data-muted-container={muted ? true : undefined}
        className={clsx(
          'relative border shadow-sm',
          isGas
            ? 'h-14 w-8 rounded-full'
            : isSolid
              ? 'h-10 w-11 rounded-md'
              : 'h-12 w-8 rounded-b-md rounded-t-lg',
          color,
        )}
      >
        {!muted && isSolid && <span className="absolute inset-x-1 top-1 h-2 rounded-sm bg-white/35" />}
        {!muted && isSolid && <span className="absolute bottom-1 left-1 right-1 h-1 rounded-full bg-black/10" />}
        {!isSolid && <span className={clsx('absolute -top-2 left-1/2 h-2 w-5 -translate-x-1/2 rounded-t-sm border border-zinc-300', cap)} />}
        {!muted && !isGas && !isSolid && <span className="absolute inset-x-0 bottom-3 h-4 bg-white/75" />}
        {!muted && isGas && <span className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full bg-white/70" />}
      </div>
      {name ? (
        <div className="min-h-9 max-w-[6.25rem] px-0.5 text-center text-[10px] font-semibold leading-[1.08] text-zinc-900" data-chemical-label>
          <span className="line-clamp-2 break-words">{name}</span>
          <span className="mt-0.5 block text-[9px] font-medium leading-none text-zinc-500">{formatChemicalState({ form } as Substance)}</span>
        </div>
      ) : (
        <div className={muted ? 'h-0' : 'h-6'} />
      )}
    </div>
  );
}

function GeneralShelvingCard({ assignments }: { assignments: ChemicalStorageAssignment[] }) {
  const rowCount = Math.max(1, Math.ceil(Math.max(assignments.length, 6) / 6));
  const placeholders = Array.from({ length: Math.max(0, rowCount * 6 - assignments.length) });
  return (
    <div className="overflow-hidden rounded-lg border border-emerald-300 bg-white">
      <div className="flex items-center gap-2 border-b border-emerald-300 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">
        <Package size={22} />
        <span>General Shelving</span>
      </div>
      <div className="p-2">
        <div
          className="relative grid min-h-28 grid-cols-6 items-end gap-2 overflow-hidden rounded-md border border-zinc-200 bg-gradient-to-br from-emerald-50/50 to-white px-4 pb-4 shadow-inner"
          style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
        >
          <div className="absolute inset-x-0 bottom-0 h-3 border-t border-zinc-200 bg-zinc-100/70" />
          {assignments.map((assignment) => (
            <ChemicalContainer key={assignment.chemical.id} name={assignment.chemical.name || assignment.chemical.cas || 'Unnamed chemical'} form={assignment.chemical.form} />
          ))}
          {placeholders.map((_, index) => (
            <ChemicalContainer key={`placeholder-${index}`} name="" form="liquid" muted />
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-zinc-600">For non-hazardous items and compatible materials. Review SDS before assigning uncertain chemicals here.</p>
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/80 p-3 text-xs">
          <div className="font-semibold text-emerald-700">What can be stored:</div>
          <p className="mt-1 leading-relaxed text-zinc-700">Dry solids and other compatible low-hazard materials.</p>
        </div>
      </div>
    </div>
  );
}

function formatChemicalState(chemical: Pick<Substance, 'form'>) {
  const form = chemical.form || 'other';
  if (form === 'powder') return 'Powder / solid';
  if (form === 'vapour' || form === 'mist') return form[0].toUpperCase() + form.slice(1);
  return form[0].toUpperCase() + form.slice(1);
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
                <div className="mx-auto mt-1 max-w-16 leading-tight">{storageGroupLabel(group)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STORAGE_GROUP_DEFS.map((row) => (
            <tr key={row.id}>
              <th className={clsx('border border-zinc-200 bg-zinc-50 p-2 text-left font-semibold text-zinc-700', activeGroupIds.includes(row.id) && 'bg-accent-50 text-accent-900')}>
                <span className={clsx('mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px]', row.tone)}>{row.id}</span>
                {storageGroupLabel(row)}
              </th>
              {STORAGE_GROUP_DEFS.map((col) => {
                const ok = COMPATIBILITY[row.id][col.id];
                const activePair = activeGroupIds.includes(row.id) && activeGroupIds.includes(col.id);
                const highlightedConflict = activePair && !ok;
                const activeHover = Boolean(
                  hoveredPair &&
                  (
                    (hoveredPair[0] === row.id && hoveredPair[1] === col.id) ||
                    (hoveredPair[0] === col.id && hoveredPair[1] === row.id)
                  ),
                );
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
                        aria-label={`${storageGroupLabel(row)} must be separated from ${storageGroupLabel(col)}. ${storageGroupLabel(row)}: ${rowChemicals.join(', ') || 'No chemicals'}. ${storageGroupLabel(col)}: ${colChemicals.join(', ') || 'No chemicals'}.`}
                      >
                        x
                      </button>
                    ) : ok ? (
	                      <CheckCircle2 aria-label="Maybe compatible - check SDS" size={16} className="mx-auto text-green-600" />
                    ) : (
                      <span className="text-base font-bold text-red-600">x</span>
                    )}
                    {highlightedConflict && (
                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-lg group-hover:block group-focus-within:block">
                        <div className="text-xs font-semibold text-zinc-900">Separate these storage groups</div>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <MatrixChemicalList title={storageGroupLabel(row)} chemicals={rowChemicals} tone={row.tone} />
                          <MatrixChemicalList title={storageGroupLabel(col)} chemicals={colChemicals} tone={col.tone} />
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
        <div className="mt-1 text-[10px] leading-snug text-zinc-500">
          {assignment.confidence === 'review' ? 'Review needed' : `${assignment.confidence} confidence`}: {assignment.reason}
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
              {assignment.suggestedGroup ? `${assignment.suggestedGroup.id} - ${storageGroupLabel(assignment.suggestedGroup)}` : 'Review SDS'}
            </option>
            {STORAGE_GROUP_DEFS.map((g) => (
              <option key={g.id} value={g.id}>{g.id} - {storageGroupLabel(g)}</option>
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
          <div className="mt-1 text-[10px] leading-snug text-zinc-500">
            {assignment.confidence === 'review' ? 'Review needed' : `${assignment.confidence} confidence`}: {assignment.reason}
          </div>
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
          {assignment.suggestedGroup ? `${assignment.suggestedGroup.id} - ${storageGroupLabel(assignment.suggestedGroup)}` : 'Review SDS'}
        </option>
        {STORAGE_GROUP_DEFS.map((g) => (
          <option key={g.id} value={g.id}>{g.id} - {storageGroupLabel(g)}</option>
        ))}
        <option value="review">Review SDS / unassigned</option>
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-70" />
    </div>
  );
}
