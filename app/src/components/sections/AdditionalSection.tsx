import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Plus, Archive,
  Droplets, Flame,
  CheckCircle2, Package, ShieldAlert, Skull,
  FlaskConical, Beaker, Biohazard,
} from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { PageIntro } from '@/components/common/PageIntro';
import { SuggestionDisclaimer } from '@/components/common/SuggestionDisclaimer';
import { GhsIcon } from '@/components/common/GhsPictograms';
import { StorageAssignmentEdit, StorageAssignmentGroup, Substance } from '@/types/assessment';
import { classifyStorage, StorageConfidence, StorageGroupId } from '@/services/storageClassifier';

export function AdditionalSection() {
  const storage = useAssessment((s) => s.assessment.additional);
  const assessment = useAssessment((s) => s.assessment);
  const updateStorage = useAssessment((s) => s.updateStorage);

  const allChems = useMemo(() => {
    const seen = new Set<string>();
    return assessment.processSteps
      .flatMap((st) => st.chemicals)
      .filter((c) => {
        const key = (c.cas?.trim() || c.name).toLowerCase().trim();
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

      <PageIntro
        body="Use this page to review the suggested storage group for each chemical, check the SDS, update any asterisked fields, and confirm that the final storage assignment is suitable."
        steps={[
          { title: '1. Check each row', body: 'Compare the suggested group, guidance and segregation alert with SDS sections 7 and 10.' },
          { title: '2. Update if needed', body: 'Change the storage group or text where the SDS or local rules require something different.' },
          { title: '3. Confirm storage', body: 'Tick each chemical once you are satisfied the storage assignment is correct.' },
        ]}
        optionalStep={{
          title: 'Optional: Check Storage Layout',
          body: 'Review the storage layout against your storage in practice, and ensure that chemicals are correctly segregated as required. Use the layout as guidance, and always confirm via the SDS.',
        }}
      />

      <div className="space-y-4">
        <Card
          title="Storage classification"
          subtitle="Review and update chemical storage assignments before checking the supporting cabinet layout."
          icon={<Archive size={18} />}
          iconClass="text-accent-700"
          defaultOpen
        >
          <StorageSdsPanel
            chemicals={allChems}
            assignmentEdits={storage.assignments ?? {}}
            onUpdateAssignment={(chemicalId, patch) => {
              const clearsConfirmation = patch.groupOverride !== undefined || patch.guidance !== undefined || patch.alert !== undefined;
              updateStorage({
                assignments: {
                  ...(storage.assignments ?? {}),
                  [chemicalId]: {
                    ...(storage.assignments?.[chemicalId] ?? {}),
                    ...patch,
                    ...(clearsConfirmation ? { confirmed: false } : {}),
                    updatedAt: new Date().toISOString(),
                  },
                },
              });
            }}
            onResetAssignmentGroup={(chemicalId) => {
              const current = storage.assignments ?? {};
              const existing = current[chemicalId] ?? {};
              const { groupOverride: _drop, updatedAt: _dropUpdatedAt, ...rest } = existing;
              void _drop;
              void _dropUpdatedAt;
              updateStorage({
                assignments: {
                  ...current,
                  [chemicalId]: Object.keys(rest).length > 0
                    ? { ...rest, confirmed: false, updatedAt: new Date().toISOString() }
                    : rest,
                },
              });
            }}
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
  generalShelving: boolean;
  hCodes: string[];
  primaryHazards: string[];
  alert: string;
  alertLevel: 'ok' | 'warn' | 'danger';
  guidance: string;
  confirmed: boolean;
  assessorEdited: boolean;
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

type StorageOverride = StorageAssignmentGroup;

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
  edit?: StorageAssignmentEdit,
): ChemicalStorageAssignment {
  const suggested = suggestedGroupForChemical(chemical);
  const override = edit?.groupOverride;
  const generalShelving = override === 'general';
  const groupId = override === 'review' || generalShelving ? null : override ?? suggested.groupId;
  const overridden = override !== undefined;

  const group = groupId ? groupById(groupId) : null;
  const suggestedGroup = suggested.groupId ? groupById(suggested.groupId) : null;
  const incompatible = group
    ? STORAGE_GROUP_DEFS
      .filter((candidate) => candidate.id !== group.id && !COMPATIBILITY[group.id][candidate.id])
      .map((candidate) => storageGroupLabel(candidate))
    : [];
  const generatedAlert = generalShelving
    ? 'General shelving / non-hazardous item. Confirm SDS and local procedure.'
    : !group
      ? 'Check SDS sections 7 and 10'
      : incompatible.length
        ? `Do not store with ${incompatible.join(', ')}`
        : 'None';
  const generatedGuidance = group?.guidance ?? 'Check sections 7 and 10 before assigning storage.';
  const guidance = edit?.guidance ?? generatedGuidance;
  const alert = edit?.alert ?? generatedAlert;

  return {
    chemical,
    group,
    suggestedGroup,
    generalShelving,
    hCodes: suggested.hCodes,
    primaryHazards: suggested.primaryHazards,
    alert,
    guidance,
    confirmed: edit?.confirmed === true,
    alertLevel: generalShelving ? 'ok' : !group ? 'warn' : incompatible.length ? 'danger' : 'ok',
    assessorEdited: Boolean(edit?.groupOverride || edit?.guidance !== undefined || edit?.alert !== undefined),
    reason: overridden ? 'Assessor override. Verify against SDS sections 7 and 10.' : suggested.reason,
    confidence: overridden ? 'review' : suggested.confidence,
    overridden,
  };
}

function buildStoragePlan(chemicals: Substance[], edits: Record<string, StorageAssignmentEdit>) {
  const usable = chemicals.filter((c) => c.name.trim() || c.cas?.trim());
  const assignments = usable.map((chemical) => classifyChemical(chemical, edits[chemical.id]));
  const groups = STORAGE_GROUP_DEFS.map((group) => ({
    ...group,
    chemicals: assignments.filter((a) => a.group?.id === group.id),
  }));
  return { groups, assignments, activeGroups: groups.filter((g) => g.chemicals.length > 0) };
}

function StorageSdsPanel({
  chemicals,
  assignmentEdits,
  onUpdateAssignment,
  onResetAssignmentGroup,
}: {
  chemicals: Substance[];
  assignmentEdits: Record<string, StorageAssignmentEdit>;
  onUpdateAssignment: (chemicalId: string, patch: StorageAssignmentEdit) => void;
  onResetAssignmentGroup: (chemicalId: string) => void;
}) {
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
  const { groups, assignments } = useMemo(() => buildStoragePlan(chemicals, assignmentEdits), [chemicals, assignmentEdits]);
  const unconfirmedCount = assignments.filter((assignment) => !assignment.confirmed).length;
  const sortedAssignments = useMemo(() => {
    const groupOrder = new Map<StorageGroupId, number>(
      STORAGE_LAYOUT_ORDER.map((id, index) => [id, index]),
    );
    return [...assignments].sort((left, right) => {
      const leftGroup = left.group ? groupOrder.get(left.group.id) ?? 99 : left.generalShelving ? 100 : 101;
      const rightGroup = right.group ? groupOrder.get(right.group.id) ?? 99 : right.generalShelving ? 100 : 101;
      if (leftGroup !== rightGroup) return leftGroup - rightGroup;
      const leftName = left.chemical.name || left.chemical.cas || '';
      const rightName = right.chemical.name || right.chemical.cas || '';
      return leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
    });
  }, [assignments]);
  const displayGroups: StorageGroupForDisplay[] = useMemo(() => groups.map((group) => ({
    ...group,
    manualChemicals: manualChemicals[group.id] ?? [],
  })), [groups, manualChemicals]);
  const activeDisplayGroups = displayGroups.filter((group) => group.chemicals.length > 0 || group.manualChemicals.length > 0);
  const activeGroupIds = activeDisplayGroups.map((g) => g.id);
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
      <div id="storage-classification-details" className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-zinc-900">Chemical classification and storage assignment</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Review each suggested group, amend it where needed, then tick Confirmed for every chemical before moving on.
          </p>
        </div>
        {unconfirmedCount > 0 && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            Confirm storage for {unconfirmedCount} chemical{unconfirmedCount === 1 ? '' : 's'} before continuing. Ensure the SDS has been checked to confirm suitable storage, and any fields marked with an asterisk are updated to match the requirements listed.
          </div>
        )}
        <div className="space-y-3 xl:hidden">
          {sortedAssignments.map((assignment) => (
            <ClassificationCard
              key={`${assignment.chemical.id}-${assignment.group?.id ?? 'review'}-${assignment.alert}`}
              assignment={assignment}
              highlighted={assignment.group ? hoveredPair?.includes(assignment.group.id) ?? false : false}
              onOverride={(groupId) => {
                if (groupId === 'suggested') onResetAssignmentGroup(assignment.chemical.id);
                else onUpdateAssignment(assignment.chemical.id, { groupOverride: groupId });
              }}
              onEdit={(patch) => onUpdateAssignment(assignment.chemical.id, patch)}
              onConfirm={(confirmed) => onUpdateAssignment(assignment.chemical.id, { confirmed })}
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
              <col className="w-[9%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[16%]" />
              <col className="w-[17.5%]" />
              <col className="w-[17.5%]" />
            </colgroup>
            <thead>
              <tr className="border-y border-zinc-200 bg-zinc-50 text-zinc-600">
                <th className="px-2 py-2 font-semibold">Confirm <RequiredMark /></th>
                <th className="px-2 py-2 font-semibold">Chemical</th>
                <th className="px-2 py-2 font-semibold">GHS pictograms</th>
                <th className="px-2 py-2 font-semibold">Key H-codes</th>
                <th className="px-2 py-2 font-semibold">Primary hazard</th>
                <th className="px-2 py-2 font-semibold">Storage group <RequiredMark /></th>
                <th className="px-2 py-2 font-semibold">Storage guidance <RequiredMark /></th>
                <th className="px-2 py-2 font-semibold">Segregation alerts <RequiredMark /></th>
              </tr>
            </thead>
            <tbody>
              {sortedAssignments.map((assignment) => (
                <ClassificationRow
                  key={`${assignment.chemical.id}-${assignment.group?.id ?? 'review'}-${assignment.alert}`}
                  assignment={assignment}
                  highlighted={assignment.group ? hoveredPair?.includes(assignment.group.id) ?? false : false}
                  onOverride={(groupId) => {
                    if (groupId === 'suggested') onResetAssignmentGroup(assignment.chemical.id);
                    else onUpdateAssignment(assignment.chemical.id, { groupOverride: groupId });
                  }}
                  onEdit={(patch) => onUpdateAssignment(assignment.chemical.id, patch)}
                  onConfirm={(confirmed) => onUpdateAssignment(assignment.chemical.id, { confirmed })}
                />
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-sm text-zinc-500">
                    Add chemicals in Process Steps to generate storage groups and compatibility checks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DetailDisclosure
        title="Suggested storage layout"
        subtitle="Visual cabinet layout generated from the reviewed assignments."
      >
        <StoragePlanDashboard
          groups={displayGroups}
          assignments={assignments}
          highlightedGroupIds={hoveredPair ?? []}
          onAddManualChemical={addManualChemical}
          onRemoveManualChemical={removeManualChemical}
        />
      </DetailDisclosure>

      <DetailDisclosure
        id="storage-compatibility-matrix"
        title="Compatibility matrix"
        subtitle="Use this when you need to inspect the source table behind the cabinet layout."
      >
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
        <p className="mt-3 text-xs text-zinc-500">
          Based on the supplied storage compatibility table. Highlighted cells show incompatibilities between storage groups currently used in this assessment.
        </p>
      </DetailDisclosure>
    </div>
  );
}

function DetailDisclosure({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} className="rounded-lg border border-zinc-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-left marker:hidden">
        <ChevronRight size={16} className="shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900">{title}</span>
          <span className="block text-xs text-zinc-500">{subtitle}</span>
        </span>
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-4 pt-4">
        {children}
      </div>
    </details>
  );
}

function RequiredMark() {
  return <span className="text-red-600" aria-hidden="true">*</span>;
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
  onAddManualChemical,
  onRemoveManualChemical,
}: {
  groups: StorageGroupForDisplay[];
  assignments: ChemicalStorageAssignment[];
  highlightedGroupIds: StorageGroupId[];
  onAddManualChemical: (groupId: StorageGroupId, name: string) => void;
  onRemoveManualChemical: (groupId: StorageGroupId, id: string) => void;
}) {
  const orderedGroups = STORAGE_LAYOUT_ORDER
    .map((id) => groups.find((group) => group.id === id))
    .filter(Boolean) as StorageGroupForDisplay[];
  const visibleGroups = orderedGroups.filter(hasGroupChemicals);
  const generalShelving = assignments.filter((assignment) => assignment.generalShelving);
  const activeGroupCount = visibleGroups.length + (generalShelving.length > 0 ? 1 : 0);

  return (
    <div>
          <div className="mb-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Suggested Storage Layout</h3>
              <p className="mt-1 text-sm text-zinc-600">
                {activeGroupCount > 0
                  ? 'Store chemicals in separate cabinets based on compatibility.'
                  : 'Add chemicals in Process Steps to generate active storage cabinets.'}
              </p>
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
            {generalShelving.length > 0 && <GeneralShelvingCard assignments={generalShelving} />}
            {visibleGroups.length === 0 && generalShelving.length === 0 && (
              <div className="rounded-md border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                Add chemicals in Process Steps to generate active storage cabinets.
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
            <span><strong className="text-zinc-800">Important note:</strong> This layout is guidance based on recorded GHS/H-code data. Always verify SDS sections 7 and 10 and local chemical storage rules.</span>
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
  const isGas = form === 'gas' || form === 'vapour' || form === 'mist';
  const isAerosol = form === 'aerosol';
  const isPowder = form === 'powder';
  const isSolid = form === 'solid';
  const vesselColor = muted
    ? 'bg-zinc-100 border-zinc-200 opacity-40'
    : tone === '1'
      ? 'bg-orange-700 border-orange-800'
      : tone === '5a' || tone === '5b' || tone === '5c'
        ? 'bg-zinc-800 border-zinc-900'
        : 'bg-white border-zinc-300';
  const capColor = muted
    ? 'bg-zinc-100 border-zinc-200'
    : tone === '1' || tone === '5a' || tone === '5b' || tone === '5c'
      ? 'bg-red-600 border-red-700'
      : tone === '3'
        ? 'bg-blue-600 border-blue-700'
        : 'bg-zinc-100 border-zinc-300';
  const labelColor = muted
    ? 'bg-white/50'
    : tone === '5a' || tone === '5b' || tone === '5c'
      ? 'bg-zinc-200/80'
      : 'bg-white/75';

  return (
    <div className="relative z-10 flex min-w-0 flex-col items-center justify-end gap-1.5">
      {isGas ? (
        <div data-muted-container={muted ? true : undefined} className="relative h-16 w-8">
          <span className={clsx('absolute left-1/2 top-0 h-2 w-4 -translate-x-1/2 rounded-t-sm border', capColor)} />
          <span className={clsx('absolute inset-x-0 top-2 h-14 rounded-full border shadow-sm', vesselColor)} />
          {!muted && <span className="absolute left-1/2 top-5 h-3 w-3 -translate-x-1/2 rounded-full bg-white/70" />}
          {!muted && <span className="absolute bottom-2 left-1/2 h-5 w-1 -translate-x-1/2 rounded-full bg-black/10" />}
        </div>
      ) : isAerosol ? (
        <div data-muted-container={muted ? true : undefined} className="relative h-14 w-8">
          <span className={clsx('absolute left-1/2 top-0 h-1.5 w-4 -translate-x-1/2 rounded-t-sm border', capColor)} />
          <span className={clsx('absolute inset-x-0 top-1.5 h-12 rounded-b-md rounded-t-lg border shadow-sm', vesselColor)} />
          {!muted && <span className={clsx('absolute inset-x-1 top-6 h-4 rounded-sm', labelColor)} />}
          {!muted && <span className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-black/10" />}
        </div>
      ) : isPowder ? (
        <div data-muted-container={muted ? true : undefined} className="relative h-12 w-11">
          <span className={clsx('absolute left-1/2 top-0 h-2 w-9 -translate-x-1/2 rounded-t-md border', capColor)} />
          <span className={clsx('absolute inset-x-0 bottom-0 h-10 rounded-b-lg rounded-t-md border shadow-sm', vesselColor)} />
          {!muted && <span className={clsx('absolute inset-x-1 bottom-3 h-3 rounded-sm', labelColor)} />}
          {!muted && <span className="absolute bottom-1 left-2 right-2 h-1 rounded-full bg-black/10" />}
        </div>
      ) : isSolid ? (
        <div data-muted-container={muted ? true : undefined} className="relative h-[3.25rem] w-9">
          <span className={clsx('absolute left-1/2 top-0 h-2 w-5 -translate-x-1/2 rounded-t-sm border', capColor)} />
          <span className={clsx('absolute left-1/2 top-2 h-2 w-6 -translate-x-1/2 border-x border-t', vesselColor)} />
          <span className={clsx('absolute inset-x-0 bottom-0 h-10 rounded-b-lg rounded-t-md border shadow-sm', vesselColor)} />
          {!muted && <span className={clsx('absolute inset-x-1 bottom-3 h-3 rounded-sm', labelColor)} />}
          {!muted && <span className="absolute bottom-1 left-2 right-2 h-1 rounded-full bg-black/10" />}
        </div>
      ) : (
        <div data-muted-container={muted ? true : undefined} className="relative h-14 w-8">
          <span className={clsx('absolute left-1/2 top-0 h-2 w-5 -translate-x-1/2 rounded-t-sm border', capColor)} />
          <span className={clsx('absolute left-1/2 top-2 h-2 w-6 -translate-x-1/2 border-x border-t', vesselColor)} />
          <span className={clsx('absolute inset-x-0 bottom-0 h-11 rounded-b-md rounded-t-lg border shadow-sm', vesselColor)} />
          {!muted && <span className={clsx('absolute inset-x-0 bottom-3 h-4', labelColor)} />}
          {!muted && <span className="absolute bottom-1 left-2 right-2 h-1 rounded-full bg-black/10" />}
        </div>
      )}
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
  onEdit,
  onConfirm,
}: {
  assignment: ChemicalStorageAssignment;
  highlighted: boolean;
  onOverride: (groupId: StorageOverride | 'suggested') => void;
  onEdit: (patch: StorageAssignmentEdit) => void;
  onConfirm: (confirmed: boolean) => void;
}) {
  const { chemical, group } = assignment;

  return (
    <tr className={clsx(
      'border-b border-zinc-100 align-top transition',
      !assignment.confirmed && 'bg-red-50/35',
      highlighted && 'bg-red-50/60',
    )}>
      <td className="px-2 py-3">
        <label className={clsx(
          'inline-flex min-h-10 w-full max-w-[5rem] flex-col items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-semibold',
          assignment.confirmed
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700',
        )}>
          <input
            type="checkbox"
            checked={assignment.confirmed}
            onChange={(e) => onConfirm(e.target.checked)}
            aria-label={`Confirm storage assignment for ${chemical.name || chemical.cas || 'chemical'}`}
            className="h-6 w-6 accent-accent-600"
          />
          <span>{assignment.confirmed ? 'Done' : 'Required'}</span>
        </label>
      </td>
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
              group ? `${group.tone} border-transparent` : assignment.generalShelving ? 'border-transparent bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-600',
              assignment.overridden && 'ring-1 ring-amber-300',
            )}
            value={assignment.overridden ? assignment.generalShelving ? 'general' : group?.id ?? 'review' : 'suggested'}
            onChange={(e) => onOverride(e.target.value as StorageOverride | 'suggested')}
          >
            <option value="suggested">
              {assignment.suggestedGroup ? `${assignment.suggestedGroup.id} - ${storageGroupLabel(assignment.suggestedGroup)}` : 'Review SDS'}
            </option>
            {STORAGE_GROUP_DEFS.map((g) => (
              <option key={g.id} value={g.id}>{g.id} - {storageGroupLabel(g)}</option>
            ))}
            <option value="general">General shelving / non-hazardous</option>
            <option value="review">Review SDS / unassigned</option>
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-70" />
        </div>
        {assignment.assessorEdited && (
          <div className="mt-1 text-[10px] font-medium text-amber-700">
            Edited by assessor
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <textarea
          className="min-h-20 w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-xs leading-relaxed text-zinc-700 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
          value={assignment.guidance}
          onChange={(e) => onEdit({ guidance: e.target.value })}
          aria-label={`Storage guidance for ${chemical.name || chemical.cas || 'chemical'}`}
        />
      </td>
      <td className="px-3 py-3">
        <textarea
          className={clsx(
            'min-h-20 w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-xs leading-relaxed outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100',
            assignment.alertLevel === 'danger' ? 'text-red-700' : assignment.alertLevel === 'ok' ? 'text-accent-700' : 'text-zinc-700',
          )}
          value={assignment.alert}
          onChange={(e) => onEdit({ alert: e.target.value })}
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
  onEdit,
  onConfirm,
}: {
  assignment: ChemicalStorageAssignment;
  highlighted: boolean;
  onOverride: (groupId: StorageOverride | 'suggested') => void;
  onEdit: (patch: StorageAssignmentEdit) => void;
  onConfirm: (confirmed: boolean) => void;
}) {
  const { chemical, group } = assignment;

  return (
    <div className={clsx(
      'rounded-lg border bg-white p-3 transition',
      assignment.confirmed ? 'border-zinc-200' : 'border-red-200 bg-red-50/35',
      highlighted && 'border-red-200 bg-red-50/50 ring-2 ring-red-200',
    )}>
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
          <label className={clsx(
            'mb-2 inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold',
            assignment.confirmed
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700',
          )}>
            <input
              type="checkbox"
              checked={assignment.confirmed}
              onChange={(e) => onConfirm(e.target.checked)}
              aria-label={`Confirm storage assignment for ${chemical.name || chemical.cas || 'chemical'}`}
              className="h-5 w-5 accent-accent-600"
            />
            <span>{assignment.confirmed ? 'Storage confirmed' : <>Confirm storage <RequiredMark /></>}</span>
          </label>
          <StorageGroupSelect assignment={assignment} chemical={chemical} group={group} onOverride={onOverride} />
          {assignment.assessorEdited && (
            <div className="mt-1 text-[10px] font-medium text-amber-700">
              Edited by assessor
            </div>
          )}
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
          <span className="text-[11px] font-semibold text-zinc-500">Storage guidance <RequiredMark /></span>
          <textarea
            className="mt-1 min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-xs leading-relaxed text-zinc-700 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
            value={assignment.guidance}
            onChange={(e) => onEdit({ guidance: e.target.value })}
          />
        </label>
        <label>
          <span className="text-[11px] font-semibold text-zinc-500">Segregation alerts <RequiredMark /></span>
          <textarea
            className={clsx(
              'mt-1 min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-xs leading-relaxed outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100',
              assignment.alertLevel === 'danger' ? 'text-red-700' : assignment.alertLevel === 'ok' ? 'text-accent-700' : 'text-zinc-700',
            )}
            value={assignment.alert}
            onChange={(e) => onEdit({ alert: e.target.value })}
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
  onOverride: (groupId: StorageOverride | 'suggested') => void;
}) {
  return (
    <div className="relative">
      <select
        aria-label={`Storage group for ${chemical.name || chemical.cas || 'chemical'}`}
        className={clsx(
          'min-h-9 w-full whitespace-normal appearance-none rounded-md border px-2 py-1.5 pr-7 text-left text-[11px] font-semibold leading-tight outline-none focus:ring-2 focus:ring-accent-500',
          group ? `${group.tone} border-transparent` : assignment.generalShelving ? 'border-transparent bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-600',
          assignment.overridden && 'ring-1 ring-amber-300',
        )}
        value={assignment.overridden ? assignment.generalShelving ? 'general' : group?.id ?? 'review' : 'suggested'}
        onChange={(e) => onOverride(e.target.value as StorageOverride | 'suggested')}
      >
        <option value="suggested">
          {assignment.suggestedGroup ? `${assignment.suggestedGroup.id} - ${storageGroupLabel(assignment.suggestedGroup)}` : 'Review SDS'}
        </option>
        {STORAGE_GROUP_DEFS.map((g) => (
          <option key={g.id} value={g.id}>{g.id} - {storageGroupLabel(g)}</option>
        ))}
        <option value="general">General shelving / non-hazardous</option>
        <option value="review">Review SDS / unassigned</option>
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-70" />
      <span className="pointer-events-none absolute -right-2 -top-2 text-sm font-bold leading-none text-red-600" aria-hidden="true">*</span>
    </div>
  );
}
