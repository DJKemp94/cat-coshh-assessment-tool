import { useMemo, useState } from 'react';
import type React from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Database, FlaskConical, Info, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { PageIntro } from '@/components/common/PageIntro';
import { SectionHeader } from '@/components/common/SectionHeader';
import { GhsIcon } from '@/components/common/GhsPictograms';
import {
  buildCameoPairs,
  cameoMeta,
  CameoCompatibility,
  CameoPairFinding,
  CameoMatch,
  findCameoChemicalById,
  resolveCameoMatch,
  searchCameoChemicals,
} from '@/services/cameoStorage';
import {
  classifyStorage20,
  Storage20Assignment,
  Storage20CabinetId,
  Storage20Category,
  Storage20ZoneId,
  CabinetZoneDef,
  ZONES,
  CABINET_ORDER,
  storage20ConfidenceLabel,
  storage20EvidenceText,
  storage20SourceLabel,
} from '@/services/storage20Classifier';
import { Storage2AssignmentEdit, Storage2MatchEdit, Substance } from '@/types/assessment';

export function StorageSection() {
  const assessment = useAssessment((s) => s.assessment);
  const storage2 = useAssessment((s) => s.assessment.storage2);
  const updateStorage2 = useAssessment((s) => s.updateStorage2);

  const chemicals = useMemo(() => uniqueChemicals(assessment.processSteps.flatMap((step) => step.chemicals)), [assessment.processSteps]);
  const matches = useMemo(
    () => chemicals.map((chemical) => resolveCameoMatch(chemical, storage2.matches[chemical.id])),
    [chemicals, storage2.matches],
  );
  const pairs = useMemo(() => buildCameoPairs(matches, storage2.pairOverrides), [matches, storage2.pairOverrides]);

  const updateMatch = (chemicalId: string, patch: Storage2MatchEdit) => {
    updateStorage2({
      matches: {
        ...storage2.matches,
        [chemicalId]: {
          ...(storage2.matches[chemicalId] ?? {}),
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  const updateAssignment = (chemicalId: string, patch: Storage2AssignmentEdit) => {
    updateStorage2({
      assignmentOverrides: {
        ...(storage2.assignmentOverrides ?? {}),
        [chemicalId]: {
          ...((storage2.assignmentOverrides ?? {})[chemicalId] ?? {}),
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  return (
    <section>
      <SectionHeader
        title="Storage"
        subtitle={
          chemicals.length > 0
          ? `Storage recommendations for ${chemicals.length} chemical${chemicals.length === 1 ? '' : 's'} from Process Steps.`
          : 'Add chemicals in Process Steps to see storage recommendations.'
        }
      />

      <PageIntro
        body="Review and confirm the suggested storage groups, chemical matching, and cabinet layout for the chemicals in this assessment."
        steps={[
          { title: '1. Check each row', body: 'Compare the suggested storage group, guidance and compatibility information with SDS sections 7 and 10.' },
          { title: '2. Update if needed', body: 'Change the reference record, storage group or requirements where the SDS or local rules require something different.' },
          { title: '3. Confirm storage', body: 'Tick each chemical once you are satisfied the storage assignment is correct.' },
        ]}
        optionalStep={{
          title: 'Check storage layout',
          body: 'Review the cabinet layout against storage in practice and ensure chemicals are correctly segregated. Use the layout as guidance and always confirm via the SDS.',
        }}
      />

      <Panel
        title="How storage recommendations work"
        subtitle="Understand what powers the storage group suggestions on this page."
        icon={<Info size={18} />}
        collapsible
        defaultOpen={false}
      >
        <div className="space-y-2 text-xs text-zinc-600">
          <p>
            The system starts with <strong>GHS hazard data</strong> — hazard statements, pictograms
            and signal words — from the Safety Data Sheet or <strong>PubChem</strong>. These codes
            determine core properties (flammable, corrosive, toxic, water-reactive, etc.) for every
            chemical in the assessment.
          </p>
          <p>
            To refine those classifications, the system also cross-references against the{' '}
            <strong>CAMEO Chemicals</strong> dataset (NOAA, U.S.), which covers{' '}
            {cameoMeta.counts.chemicals.toLocaleString()} chemicals grouped into{' '}
            {cameoMeta.counts.reactiveGroups} reactive groups with over{' '}
            {cameoMeta.counts.reactivity.toLocaleString()} known chemical-pair reactions. If a
            match is found, the chemical's reactive group membership is used alongside the GHS data
            to produce the final storage recommendation.
          </p>
          <p className="text-zinc-400">
            Database: CAMEO Chemicals v{cameoMeta.version}, imported{' '}
            {cameoMeta.importDate.slice(0, 10)} &middot; Always verify against the Safety Data
            Sheet.
          </p>
        </div>
      </Panel>

      <div className="mt-4 space-y-4">
        <MatchReviewPanel matches={matches} assignmentEdits={storage2.assignmentOverrides ?? {}} onUpdateMatch={updateMatch} onUpdateAssignment={updateAssignment} />
        <PairFindingsPanel matches={matches} pairs={pairs} assignmentEdits={storage2.assignmentOverrides ?? {}} />
        <CabinetSchemePanel matches={matches} assignmentEdits={storage2.assignmentOverrides ?? {}} notes={storage2.layoutNotes} onNotes={(layoutNotes) => updateStorage2({ layoutNotes })} />
      </div>
    </section>
  );
}

function uniqueChemicals(chemicals: Substance[]) {
  const seen = new Set<string>();
  return chemicals.filter((chemical) => {
    const key = (chemical.cas?.trim() || chemical.name).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function Panel({ title, subtitle, icon, children, collapsible = false, defaultOpen = true }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-start gap-3 border-b border-zinc-100 px-4 py-3">
          <span className="mt-0.5 text-accent-700">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-start gap-3 border-b border-zinc-100 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className={open ? 'mt-0.5 text-accent-700' : 'mt-0.5 text-zinc-400'}>{icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
        </div>
        <ChevronRight
          size={16}
          className={`mt-1 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function EditableStar() {
  return <span className="text-red-600" title="Editable field">*</span>;
}

function MatchReviewPanel({
  matches,
  assignmentEdits,
  onUpdateMatch,
  onUpdateAssignment,
}: {
  matches: CameoMatch[];
  assignmentEdits: Record<string, Storage2AssignmentEdit>;
  onUpdateMatch: (chemicalId: string, patch: Storage2MatchEdit) => void;
  onUpdateAssignment: (chemicalId: string, patch: Storage2AssignmentEdit) => void;
}) {
  const assignmentRows = useMemo(() => matches
    .map((match) => {
      const automaticAssignment = classifyStorage20(match);
      const autoMatch = resolveCameoMatch(match.chemical);
      const recordChanged = match.confidence === 'manual' && match.cameo?.id !== autoMatch.cameo?.id;
      return {
        automaticAssignment,
        assignment: applyAssignmentEdit(automaticAssignment, assignmentEdits[match.chemical.id]),
        recordChanged,
      };
    })
    .sort((a, b) => {
      const nameA = (a.assignment.match.chemical.name || a.assignment.match.chemical.cas || '').toLowerCase();
      const nameB = (b.assignment.match.chemical.name || b.assignment.match.chemical.cas || '').toLowerCase();
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
    }), [matches, assignmentEdits]);

  return (
    <Panel title="Chemical classification and database matching" subtitle="Review GHS hazards, reactive groups and the generated storage group assignment in one place." icon={<Database size={18} />}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] table-fixed border-collapse text-left text-[11px]">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[24%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead>
            <tr className="border-y border-zinc-200 bg-zinc-50 text-zinc-600">
              <th className="px-2 py-2 font-semibold">Confirm</th>
              <th className="px-2 py-2 font-semibold">Chemical</th>
              <th className="px-2 py-2 font-semibold">GHS</th>
              <th className="px-2 py-2 font-semibold">H-codes</th>
              <th className="px-2 py-2 font-semibold">
                <span className="inline-flex items-center gap-1">
                  Reference record <EditableStar />
                  <details className="group relative inline-block align-text-top">
                    <summary
                      className="flex h-4 w-4 cursor-pointer list-none items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 transition hover:border-accent-300 hover:text-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-100 [&::-webkit-details-marker]:hidden"
                      aria-label="About Reference record column"
                      title="About this column"
                    >
                      <Info size={10} />
                    </summary>
                    <div className="absolute left-1/2 z-20 mt-1 w-72 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 text-[11px] leading-relaxed text-zinc-600 shadow-lg">
                      <strong className="block text-xs font-semibold text-zinc-900">What is this column?</strong>
                      <p className="mt-1">
                        This column shows the reference database record matched to your chemical. The database
                        record determines the reactive groups used for storage recommendations.
                      </p>
                      <p className="mt-1">
                        <strong>Check:</strong> verify the matched name matches your chemical. If not, use the
                        dropdown to search for and select the correct record.
                      </p>
                      <p className="mt-1">
                        <strong>No database match:</strong> no record was found for this chemical. Storage
                        recommendations will be based on GHS hazard data alone. You can try searching the
                        dropdown for a suitable record, or check back when the chemical data is updated.
                      </p>
                    </div>
                  </details>
                </span>
              </th>
              <th className="px-2 py-2 font-semibold">Reactive groups</th>
              <th className="px-2 py-2 font-semibold">Storage Group Assignment <EditableStar /></th>
              <th className="px-2 py-2 font-semibold">Requirements <EditableStar /></th>
            </tr>
          </thead>
          <tbody>
            {assignmentRows.map(({ automaticAssignment, assignment, recordChanged }) => (
              <ClassificationMatchRow
                key={assignment.match.chemical.id}
                assignment={assignment}
                automaticAssignment={automaticAssignment}
                edit={assignmentEdits[assignment.match.chemical.id]}
                recordChanged={recordChanged}
                onUpdate={(patch) => onUpdateMatch(assignment.match.chemical.id, patch)}
                onUpdateAssignment={(patch) => onUpdateAssignment(assignment.match.chemical.id, patch)}
              />
            ))}
            {assignmentRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-sm text-zinc-500">
                  Add chemicals in Process Steps to generate storage recommendations.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ClassificationMatchRow({
  assignment,
  automaticAssignment,
  edit,
  recordChanged,
  onUpdate,
  onUpdateAssignment,
}: {
  assignment: Storage20Assignment;
  automaticAssignment: Storage20Assignment;
  edit?: Storage2AssignmentEdit;
  recordChanged: boolean;
  onUpdate: (patch: Storage2MatchEdit) => void;
  onUpdateAssignment: (patch: Storage2AssignmentEdit) => void;
}) {
  const match = assignment.match;
  const chemical = match.chemical;
  const query = chemical.name || chemical.cas || '';
  const options = useMemo(() => searchCameoChemicals(query), [query]);
  const selected = match.cameo ? findCameoChemicalById(match.cameo.id) : null;
  const requirementText = edit?.requirements ?? requirementTextForAssignment(assignment);

  return (
    <tr className={clsx('border-b border-zinc-100 align-top transition', !match.confirmed && 'bg-amber-50/35')}>
      <td className="px-2 py-3">
        <label className={clsx(
          'inline-flex min-h-9 w-full items-center justify-center rounded-md border px-1.5 py-1.5',
          match.confirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800',
        )}>
          <input
            type="checkbox"
            className="h-5 w-5 accent-accent-600"
            checked={match.confirmed}
            onChange={(e) => onUpdate({ confirmed: e.target.checked })}
            aria-label={`Confirm reference match for ${chemical.name || chemical.cas || 'chemical'}`}
          />
        </label>
      </td>
      <td className="break-words px-2 py-3">
        <div className="font-semibold text-zinc-900">{chemical.name || chemical.cas || 'Unnamed chemical'}</div>
        <div className="mt-1 text-zinc-500">{chemical.cas ? `CAS ${chemical.cas}` : 'No CAS recorded'}</div>
      </td>
      <td className="px-2 py-3">
        <div className="flex flex-wrap gap-1">
          {chemical.ghsPictograms.length > 0
            ? chemical.ghsPictograms.map((id) => <GhsIcon key={id} id={id} size={24} />)
            : <span className="text-zinc-400">None</span>}
        </div>
      </td>
      <td className="break-words px-2 py-3 text-zinc-700">
        {chemical.hazardStatements.length > 0
          ? chemical.hazardStatements.map((h) => h.code).join(', ')
          : 'None recorded'}
      </td>
      <td className="px-2 py-3">
        <div className="grid gap-1.5">
          <select
            className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-[11px] outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
            value={selected?.id ?? ''}
            onChange={(e) => onUpdate({ cameoChemicalId: e.target.value ? Number(e.target.value) : null, confirmed: false })}
          >
            <option value="">No database match</option>
            {options.map((chemicalOption) => (
              <option key={chemicalOption.id} value={chemicalOption.id}>{chemicalOption.name}</option>
            ))}
            {selected && !options.some((option) => option.id === selected.id) && (
              <option value={selected.id}>{selected.name}</option>
            )}
          </select>
          {recordChanged && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">User override</span>}
        </div>
      </td>
      <td className="px-2 py-3">
        <div className="flex flex-wrap gap-1">
          {match.groups.length > 0
            ? match.groups.map((group) => <span key={group.id} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700">{group.id}: {group.name}</span>)
            : <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">No reactive groups matched</span>}
        </div>
      </td>
      <td className="px-2 py-3">
        <select
          className={clsx('w-full rounded-md border px-2 py-1.5 text-[11px] font-semibold outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100', assignmentClassName(assignment.zoneId))}
          value={edit?.zoneOverride ?? assignment.zoneId}
          onChange={(event) => onUpdateAssignment({ zoneOverride: event.target.value === automaticAssignment.zoneId ? undefined : event.target.value })}
          aria-label={`Storage Group Assignment for ${chemical.name || chemical.cas || 'chemical'}`}
        >
          {STORAGE20_ZONE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <div className="mt-1 flex flex-wrap gap-1">
          <InfoBadge label={`Confidence: ${storage20ConfidenceLabel(assignment.confidence)}`} title="Confidence reflects how strong the automatic classification evidence is." tone={assignment.confidence} />
          <AssignmentInfo assignment={assignment} />
          {edit?.zoneOverride && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">User override</span>}
        </div>
        <div className="mt-1 line-clamp-3 text-[10px] leading-relaxed text-zinc-500">
          {storage20EvidenceText(assignment)}
        </div>
      </td>
      <td className="px-2 py-3">
        <textarea
          className="min-h-16 w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-[11px] leading-relaxed text-zinc-700 outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
          value={requirementText}
          onChange={(event) => onUpdateAssignment({ requirements: event.target.value })}
          aria-label={`Storage requirements for ${chemical.name || chemical.cas || 'chemical'}`}
        />
      </td>
    </tr>
  );
}

const STORAGE20_ZONE_OPTIONS = [
  { id: 'organicSolventsAcids', label: 'Organic solvents and organic acids' },
  { id: 'volatilePoisonsChlorinated', label: 'Volatile poisons and chlorinated solvents' },
  { id: 'nonOxidizingAcids', label: 'Non-oxidizing organic and mineral acids' },
  { id: 'oxidizingAcids', label: 'Oxidizing acids in double containment' },
  { id: 'solidBases', label: 'Solid bases' },
  { id: 'liquidBases', label: 'Liquid bases' },
  { id: 'oxidizersOnly', label: 'Oxidizers, excluding oxidizing acids or organic peroxides' },
  { id: 'dryPoisons', label: 'Non-volatile poisons - dry' },
  { id: 'liquidPoisons', label: 'Non-volatile poisons - liquid' },
  { id: 'compressedGases', label: 'Compressed gases' },
  { id: 'drySolids', label: 'Dry solids' },
  { id: 'generalStorage', label: 'General low-hazard storage' },
  { id: 'specialReview', label: 'Hard isolation / dedicated reactive storage' },
  { id: 'review', label: 'Unassigned / assessor review' },
] satisfies Array<{ id: Storage20ZoneId; label: string }>;

function applyAssignmentEdit(assignment: Storage20Assignment, edit?: Storage2AssignmentEdit): Storage20Assignment {
  const zoneOverride = isStorage20ZoneId(edit?.zoneOverride) ? edit.zoneOverride : undefined;
  if (!zoneOverride && !edit?.requirements) return assignment;
  return {
    ...assignment,
    zoneId: zoneOverride ?? assignment.zoneId,
    cabinetId: zoneOverride ? ZONES[zoneOverride].cabinetId : assignment.cabinetId,
    category: zoneOverride ? categoryForZone(zoneOverride) : assignment.category,
    requirements: edit?.requirements !== undefined ? splitRequirements(edit.requirements) : assignment.requirements,
    source: zoneOverride ? 'review' : assignment.source,
    confidence: zoneOverride ? 'review' : assignment.confidence,
    reasons: zoneOverride ? ['User selected the storage group assignment. Verify against SDS sections 7 and 10.'] : assignment.reasons,
  };
}

function isStorage20ZoneId(value: string | undefined): value is Storage20ZoneId {
  return Boolean(value && Object.prototype.hasOwnProperty.call(ZONES, value));
}

function categoryForZone(zoneId: Storage20ZoneId): Storage20Category {
  if (zoneId === 'specialReview') return 'waterReactive';
  if (zoneId === 'oxidizersOnly') return 'oxidizingAgent';
  if (zoneId === 'oxidizingAcids') return 'oxidizingAcid';
  if (zoneId === 'nonOxidizingAcids') return 'inorganicAcid';
  if (zoneId === 'solidBases') return 'solidBase';
  if (zoneId === 'liquidBases') return 'liquidBase';
  if (zoneId === 'organicSolventsAcids') return 'organicSolvent';
  if (zoneId === 'volatilePoisonsChlorinated') return 'volatilePoison';
  if (zoneId === 'dryPoisons') return 'inorganicPoison';
  if (zoneId === 'liquidPoisons') return 'organicPoison';
  if (zoneId === 'compressedGases') return 'compressedGas';
  if (zoneId === 'drySolids') return 'drySolid';
  if (zoneId === 'generalStorage') return 'generalStorage';
  return 'review';
}

function splitRequirements(value: string) {
  return value.split(/[;\n]/).map((item) => item.trim()).filter(Boolean);
}

function requirementTextForAssignment(assignment: Storage20Assignment) {
  return [...assignment.requirements, ...assignment.constraints].slice(0, 4).join('; ') || 'Check SDS sections 7 and 10';
}

function InfoBadge({ label, title, tone }: { label: string; title: string; tone?: Storage20Assignment['confidence'] }) {
  return (
    <span
      title={title}
      className={clsx(
        'rounded px-1.5 py-0.5 text-[10px] font-semibold',
        tone === 'high' && 'bg-emerald-100 text-emerald-800',
        tone === 'medium' && 'bg-amber-100 text-amber-800',
        tone === 'review' && 'bg-red-100 text-red-800',
        !tone && 'bg-zinc-100 text-zinc-700',
      )}
    >
      {label}
    </span>
  );
}

function AssignmentInfo({ assignment }: { assignment: Storage20Assignment }) {
  return (
    <details className="group relative inline-block">
      <summary
        className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:border-accent-300 hover:text-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-100 [&::-webkit-details-marker]:hidden"
        aria-label={`Assignment source: ${storage20SourceLabel(assignment.source)}`}
        title="Show assignment source"
      >
        <Info size={12} />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-3 text-[11px] leading-relaxed text-zinc-700 shadow-lg">
        <div className="font-semibold text-zinc-900">Assignment source</div>
        <div className="mt-1">{storage20SourceLabel(assignment.source)}</div>
        <div className="mt-2 font-semibold text-zinc-900">Reason</div>
        <div className="mt-1">{storage20EvidenceText(assignment) || 'No automatic reason recorded.'}</div>
      </div>
    </details>
  );
}

function assignmentClassName(zoneId: Storage20ZoneId) {
  const zone = ZONES[zoneId];
  return clsx(zone.className, zone.textClassName, 'border-transparent');
}

function PairFindingsPanel({ matches, pairs, assignmentEdits }: { matches: CameoMatch[]; pairs: ReturnType<typeof buildCameoPairs>; assignmentEdits: Record<string, Storage2AssignmentEdit> }) {
  const assignments = useMemo(() => matches.map((match) => applyAssignmentEdit(classifyStorage20(match), assignmentEdits[match.chemical.id])), [matches, assignmentEdits]);
  const assignmentsByGroup = useMemo(() => {
    const map = new Map<MatrixGroupId, Storage20Assignment[]>();
    for (const assignment of assignments) {
      const groupId = matrixGroupForAssignment(assignment);
      if (!groupId) continue;
      map.set(groupId, [...(map.get(groupId) ?? []), assignment]);
    }
    return map;
  }, [assignments]);
  const pairsByChemicalKey = useMemo(() => new Map(pairs.map((pair) => [pair.key, pair])), [pairs]);

  return (
    <Panel title="Compatibility matrix (by storage group)" subtitle="Storage-group compatibility based on the supplied cabinet scheme. Hover or focus a cell to see the chemicals in each group and compatibility evidence where available." icon={<AlertTriangle size={18} />} collapsible defaultOpen={false}>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-600" /> Maybe compatible - check SDS</span>
        <span className="inline-flex items-center gap-1"><XCircle size={14} className="text-red-600" /> Not compatible for shared storage</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent-600" /> Relevant to this assessment</span>
      </div>
      <div className="overflow-x-auto pb-24">
        <table className="w-full min-w-[920px] border-collapse text-center text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 border border-zinc-200 bg-zinc-50 p-2 text-left font-semibold text-zinc-500">Group</th>
              {MATRIX_GROUPS.map((group) => (
                <th key={group.id} className="border border-zinc-200 bg-zinc-50 p-2 font-semibold leading-tight text-zinc-700">
                  <div className="mx-auto max-w-20">{group.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_GROUPS.map((row, rowIndex) => (
              <tr key={row.id}>
                <th className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 p-2 text-left font-semibold leading-tight text-zinc-700">{row.label}</th>
                {MATRIX_GROUPS.map((col, colIndex) => {
                  const compatible = STORAGE20_MATRIX[row.id][col.id];
                  const rowAssignments = assignmentsByGroup.get(row.id) ?? [];
                  const colAssignments = assignmentsByGroup.get(col.id) ?? [];
                  const affectedPairs = affectedMatrixPairs(rowAssignments, colAssignments, pairsByChemicalKey);
                  const relevantToAssessment = isRelevantMatrixCell(row.id, col.id, rowAssignments, colAssignments);
                  const isDiagonal = row.id === col.id;
                  const showRelevantDot = relevantToAssessment && !isDiagonal;

                  return (
                    <td
                      key={col.id}
                      className={clsx(
                        'group relative h-12 border p-1 transition',
                        isDiagonal ? 'bg-zinc-100 text-zinc-300 opacity-70' : compatible ? 'bg-white hover:bg-emerald-50' : 'bg-red-50 hover:bg-red-100',
                        'border-zinc-200',
                      )}
                    >
                      {showRelevantDot && (
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent-600" title="Relevant to this assessment" />
                      )}
                      <button
                        type="button"
                        className={clsx(
                          'mx-auto flex h-8 w-8 items-center justify-center rounded outline-none focus:ring-2 focus:ring-accent-300',
                          !showRelevantDot && !isDiagonal && 'opacity-55',
                        )}
                        aria-label={`${row.label} and ${col.label}: ${compatible ? 'maybe compatible' : 'not compatible'}`}
                      >
                        {!isDiagonal && (
                          compatible
                            ? <CheckCircle2 size={17} className="text-emerald-600" />
                            : <span className="text-base font-bold text-red-600">x</span>
                        )}
                      </button>
                      <MatrixHoverCard
                        row={row}
                        col={col}
                        compatible={compatible}
                        rowAssignments={rowAssignments}
                        colAssignments={colAssignments}
                        affectedPairs={affectedPairs}
                        relevantToAssessment={relevantToAssessment}
                        align={colIndex >= MATRIX_GROUPS.length - 3 ? 'right' : colIndex <= 2 ? 'left' : 'center'}
                        verticalAlign={rowIndex >= MATRIX_GROUPS.length - 3 ? 'top' : 'bottom'}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

type MatrixGroupId =
  | 'inorganicAcids'
  | 'oxidizingAcids'
  | 'organicAcids'
  | 'alkaliCaustic'
  | 'oxidizingAgents'
  | 'inorganicPoisons'
  | 'organicPoisons'
  | 'waterReactive'
  | 'organicSolvents';

interface MatrixGroupDef {
  id: MatrixGroupId;
  label: string;
}

const MATRIX_GROUPS: MatrixGroupDef[] = [
  { id: 'inorganicAcids', label: 'Inorganic Acids' },
  { id: 'oxidizingAcids', label: 'Oxidising Acids' },
  { id: 'organicAcids', label: 'Organic Acids' },
  { id: 'alkaliCaustic', label: 'Alkali / Caustic' },
  { id: 'oxidizingAgents', label: 'Oxidising Agents' },
  { id: 'inorganicPoisons', label: 'Inorganic Poisons' },
  { id: 'organicPoisons', label: 'Organic Poisons' },
  { id: 'waterReactive', label: 'Water Reactive' },
  { id: 'organicSolvents', label: 'Organic Solvents' },
];

const STORAGE20_MATRIX: Record<MatrixGroupId, Record<MatrixGroupId, boolean>> = {
  inorganicAcids: { inorganicAcids: true, oxidizingAcids: true, organicAcids: false, alkaliCaustic: false, oxidizingAgents: true, inorganicPoisons: false, organicPoisons: false, waterReactive: false, organicSolvents: false },
  oxidizingAcids: { inorganicAcids: true, oxidizingAcids: true, organicAcids: false, alkaliCaustic: false, oxidizingAgents: true, inorganicPoisons: false, organicPoisons: false, waterReactive: false, organicSolvents: false },
  organicAcids: { inorganicAcids: false, oxidizingAcids: false, organicAcids: true, alkaliCaustic: false, oxidizingAgents: false, inorganicPoisons: false, organicPoisons: false, waterReactive: false, organicSolvents: true },
  alkaliCaustic: { inorganicAcids: false, oxidizingAcids: false, organicAcids: false, alkaliCaustic: true, oxidizingAgents: true, inorganicPoisons: true, organicPoisons: false, waterReactive: false, organicSolvents: false },
  oxidizingAgents: { inorganicAcids: true, oxidizingAcids: true, organicAcids: false, alkaliCaustic: true, oxidizingAgents: true, inorganicPoisons: true, organicPoisons: false, waterReactive: false, organicSolvents: false },
  inorganicPoisons: { inorganicAcids: false, oxidizingAcids: false, organicAcids: false, alkaliCaustic: true, oxidizingAgents: true, inorganicPoisons: true, organicPoisons: false, waterReactive: false, organicSolvents: false },
  organicPoisons: { inorganicAcids: false, oxidizingAcids: false, organicAcids: false, alkaliCaustic: false, oxidizingAgents: false, inorganicPoisons: false, organicPoisons: true, waterReactive: true, organicSolvents: true },
  waterReactive: { inorganicAcids: false, oxidizingAcids: false, organicAcids: false, alkaliCaustic: false, oxidizingAgents: false, inorganicPoisons: false, organicPoisons: true, waterReactive: true, organicSolvents: true },
  organicSolvents: { inorganicAcids: false, oxidizingAcids: false, organicAcids: true, alkaliCaustic: false, oxidizingAgents: false, inorganicPoisons: false, organicPoisons: true, waterReactive: true, organicSolvents: true },
};

function matrixGroupForAssignment(assignment: Storage20Assignment): MatrixGroupId | null {
  const categoryMap: Partial<Record<Storage20Category, MatrixGroupId>> = {
    waterReactive: 'waterReactive',
    oxidizingAgent: 'oxidizingAgents',
    oxidizingAcid: 'oxidizingAcids',
    inorganicAcid: 'inorganicAcids',
    organicAcid: 'organicAcids',
    solidBase: 'alkaliCaustic',
    liquidBase: 'alkaliCaustic',
    organicSolvent: 'organicSolvents',
    volatilePoison: 'organicPoisons',
    inorganicPoison: 'inorganicPoisons',
    organicPoison: 'organicPoisons',
  };
  return categoryMap[assignment.category] ?? null;
}

function affectedMatrixPairs(rowAssignments: Storage20Assignment[], colAssignments: Storage20Assignment[], pairsByChemicalKey: Map<string, CameoPairFinding>) {
  const results: CameoPairFinding[] = [];
  for (const left of rowAssignments) {
    for (const right of colAssignments) {
      if (left.match.chemical.id === right.match.chemical.id) continue;
      const key = [left.match.chemical.id, right.match.chemical.id].sort().join('::');
      const pair = pairsByChemicalKey.get(key);
      if (pair && !results.some((candidate) => candidate.key === pair.key)) results.push(pair);
    }
  }
  return results;
}

function isRelevantMatrixCell(rowId: MatrixGroupId, colId: MatrixGroupId, rowAssignments: Storage20Assignment[], colAssignments: Storage20Assignment[]) {
  if (rowId === colId) return rowAssignments.length > 0;
  return rowAssignments.length > 0 && colAssignments.length > 0;
}

function MatrixHoverCard({
  row,
  col,
  compatible,
  rowAssignments,
  colAssignments,
  affectedPairs,
  relevantToAssessment,
  align,
  verticalAlign,
}: {
  row: MatrixGroupDef;
  col: MatrixGroupDef;
  compatible: boolean;
  rowAssignments: Storage20Assignment[];
  colAssignments: Storage20Assignment[];
  affectedPairs: CameoPairFinding[];
  relevantToAssessment: boolean;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'bottom';
}) {
  return (
    <div className={clsx(
      'pointer-events-none absolute z-30 hidden w-96 rounded-lg border border-zinc-200 bg-white p-3 text-left text-zinc-800 shadow-xl group-hover:block group-focus-within:block',
      verticalAlign === 'bottom' && 'top-full mt-2',
      verticalAlign === 'top' && 'bottom-full mb-2',
      align === 'left' && 'left-0',
      align === 'center' && 'left-1/2 -translate-x-1/2',
      align === 'right' && 'right-0',
    )} data-testid={`storage2-matrix-hover-${row.id}-${col.id}`}>
      <div className={clsx('inline-flex rounded px-2 py-1 text-xs font-semibold', compatible ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
        {compatible ? 'Maybe compatible - check SDS' : 'Not compatible for shared storage'}
      </div>
      {relevantToAssessment && (
        <div className="mt-2 inline-flex rounded bg-accent-50 px-2 py-1 text-[11px] font-semibold text-accent-800">Relevant to this assessment</div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-3">
        <MatrixChemicalList title={row.label} assignments={rowAssignments} />
        <MatrixChemicalList title={col.label} assignments={colAssignments} />
      </div>
      <div className="mt-3 border-t border-zinc-100 pt-2">
        <div className="text-[11px] font-semibold text-zinc-500">Compatibility evidence</div>
        {affectedPairs.length > 0 ? (
          <ul className="mt-1 space-y-1 text-[11px] leading-snug text-zinc-700">
            {affectedPairs.slice(0, 5).map((pair) => (
              <li key={pair.key}>
                <span className="font-semibold">{pair.left.chemical.name || pair.left.chemical.cas}</span>
                <span className="mx-1 text-zinc-400">↔</span>
                <span className="font-semibold">{pair.right.chemical.name || pair.right.chemical.cas}</span>
                <span className="ml-1 text-zinc-500">({matrixCompatibility(pair)})</span>
              </li>
            ))}
            {affectedPairs.length > 5 && <li className="text-zinc-500">+{affectedPairs.length - 5} more pairs</li>}
          </ul>
        ) : (
          <div className="mt-1 text-[11px] text-zinc-500">No direct compatibility evidence for this cell. Use the storage group rule and SDS.</div>
        )}
      </div>
    </div>
  );
}

function MatrixChemicalList({ title, assignments }: { title: string; assignments: Storage20Assignment[] }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-zinc-900">{title}</div>
      <ul className="mt-1 space-y-1 text-[11px] leading-snug text-zinc-700">
        {assignments.length > 0
          ? assignments.map((assignment) => <li key={assignment.match.chemical.id}>{assignment.match.chemical.name || assignment.match.chemical.cas}</li>)
          : <li className="text-zinc-400">No chemicals in this group</li>}
      </ul>
    </div>
  );
}

function matrixCompatibility(pair: CameoPairFinding): CameoCompatibility {
  if (pair.effectiveCompatibility !== 'Incompatible') return pair.effectiveCompatibility;
  return hasStrongStorageEvidence(pair) ? 'Incompatible' : 'Caution';
}

function hasStrongStorageEvidence(pair: CameoPairFinding) {
  const text = pair.groupFindings
    .filter((finding) => finding.compatibility === 'Incompatible')
    .flatMap((finding) => [
      finding.leftGroup.name,
      finding.rightGroup.name,
      finding.hazardsDocumentation,
      finding.hazards.join(' '),
      finding.gasProducts.join(' '),
    ])
    .join(' ')
    .toLowerCase();
  const names = `${pair.left.chemical.name} ${pair.right.chemical.name} ${pair.left.cameo?.name ?? ''} ${pair.right.cameo?.name ?? ''}`.toLowerCase();

  // Genuinely dangerous gas products — these justify hard separation
  if (/hydrogen cyanide|hcn|hydrogen sulfide|h2s|chlorine gas|chlorine\b|phosgene|hydrogen chloride|hcl gas|nitrogen dioxide|no2|sulfur dioxide|so2|hydrogen fluoride|hf\b|hydrogen\b.*gas|h2\b|phosphine|arsine|silane|diborane/.test(text)) return true;
  // Violent or explosive reactions
  if (/explosive|violent|detonat|intense|pressurization|pressurisation|exothermic|spontaneously|autoignit/.test(text)) return true;
  // Specific dangerous combinations
  if (/cyanide|sulfide|sulphide/.test(names) && /acid/.test(names)) return true;
  if (/nitric acid|perchloric acid|hydrofluoric acid|hydrogen fluoride|acetic anhydride/.test(names) && /organic|flammable|solvent|alcohol|acetone/.test(names)) return true;
  // Reactive metals with water or acids
  if (/alkali metal|sodium metal|potassium metal|lithium metal|metal hydride|organometallic/.test(names) && /water|acid|alcohol/.test(names)) return true;
  // Oxidizer + flammable/combustible
  if (/strong oxidiz/.test(text) && /flammable|combustible|organic|hydrocarbon/.test(text)) return true;

  return false;
}




function CabinetSchemePanel({
  matches,
  assignmentEdits,
  notes,
  onNotes,
}: {
  matches: CameoMatch[];
  assignmentEdits: Record<string, Storage2AssignmentEdit>;
  notes: string;
  onNotes: (value: string) => void;
}) {
  const assignments = useMemo(() => matches.map((match) => applyAssignmentEdit(classifyStorage20(match), assignmentEdits[match.chemical.id])), [matches, assignmentEdits]);
  const assignmentsByCabinet = useMemo(() => {
    const byCabinet = new Map<Storage20CabinetId, Storage20Assignment[]>();
    for (const assignment of assignments) {
      byCabinet.set(assignment.cabinetId, [...(byCabinet.get(assignment.cabinetId) ?? []), assignment]);
    }
    return byCabinet;
  }, [assignments]);

  return (
    <Panel
      title="Image-based cabinet layout"
      subtitle="Primary placement follows the supplied cabinet scheme and the confirmed storage group assignments."
      icon={<FlaskConical size={18} />}
      collapsible
      defaultOpen={false}
    >
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <p className="font-semibold">Storage group cabinet assignment</p>
        <p className="mt-1">Chemicals are assigned using a priority order: Special/Review (hard isolation) → Oxidizers → inert/low-reactivity Dry Solids (shelving) → cabinet by hazard group (Acids, Bases, Toxins, Flammables). Acids and bases must not share a cabinet. Oxidizing acids require double containment within the corrosives cabinet.</p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {CABINET_ORDER.map((cabinetId) => {
          const cabinetAssignments = assignmentsByCabinet.get(cabinetId) ?? [];
          if (cabinetAssignments.length === 0) return null;
          const cabinetTitle = ZONES[cabinetAssignments[0]?.zoneId]?.cabinetTitle ?? (cabinetId === 'review' ? 'Review SDS' : '');
          return (
            <div key={cabinetId} data-testid="storage2-cabinet" className="rounded-lg border border-zinc-200 bg-white p-3">
              <div data-testid="storage2-cabinet-title" className="text-sm font-semibold text-zinc-900">{cabinetTitle}</div>
              <div className="mt-3 space-y-2">
                {Object.values(ZONES)
                  .filter((zone) => zone.cabinetId === cabinetId)
                  .map((zone) => ({ zone, zoneAssignments: cabinetAssignments.filter((assignment) => assignment.zoneId === zone.id) }))
                  .filter(({ zoneAssignments }) => zoneAssignments.length > 0)
                  .map(({ zone, zoneAssignments }) => (
                    <CabinetZone key={zone.id} zone={zone} assignments={zoneAssignments} />
                  ))}
              </div>
            </div>
          );
        })}
        {assignments.length === 0 && <EmptyMessage>Add chemicals in Process Steps to generate the cabinet layout.</EmptyMessage>}
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-zinc-500">Storage layout notes</span>
        <textarea
          className="mt-1 min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white p-2 text-sm leading-relaxed outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="Record cabinet, tray or local segregation decisions here."
        />
      </label>
    </Panel>
  );
}

function CabinetZone({ zone, assignments }: { zone: CabinetZoneDef; assignments: Storage20Assignment[] }) {
  return (
    <div className={clsx('min-h-28 rounded-md border p-3', zone.className, zone.textClassName)}>
      <div className="text-xs font-semibold leading-tight">{zone.zoneTitle}</div>
      <div className="mt-1 text-[11px] leading-snug opacity-85">{zone.note}</div>
      <div className="mt-2 space-y-1">
        {assignments.map((assignment) => <CabinetChemicalCard key={assignment.match.chemical.id} assignment={assignment} />)}
        {assignments.length === 0 && <div className="rounded border border-dashed border-white/80 px-2 py-2 text-center text-[11px] opacity-70">No chemicals assigned</div>}
      </div>
    </div>
  );
}

function CabinetChemicalCard({ assignment }: { assignment: Storage20Assignment }) {
  const notices = cabinetNotices(assignment);

  return (
    <details className="group rounded bg-white/70 px-2 py-1 text-xs text-zinc-900">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold outline-none focus:ring-2 focus:ring-accent-200 [&::-webkit-details-marker]:hidden">
        <span className="mr-auto">{assignment.match.chemical.name || assignment.match.chemical.cas || 'Unnamed chemical'}</span>
        <span className="text-[10px] font-normal text-zinc-500 group-open:hidden">Show</span>
        <span className="hidden text-[10px] font-normal text-zinc-500 group-open:inline">Hide</span>
      </summary>
      {notices.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-100 pt-2">
          {notices.map((notice) => (
            <span key={notice} className="rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-700">{notice}</span>
          ))}
        </div>
      ) : (
        <div className="mt-2 border-t border-zinc-100 pt-2 text-[10px] text-zinc-500">No extra storage notices.</div>
      )}
    </details>
  );
}

function cabinetNotices(assignment: Storage20Assignment) {
  return [...new Set([...assignment.requirements, ...assignment.constraints])].slice(0, 5);
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}
