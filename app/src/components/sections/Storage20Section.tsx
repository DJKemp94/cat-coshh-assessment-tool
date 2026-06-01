import { useMemo, useState } from 'react';
import type React from 'react';
import { AlertTriangle, CheckCircle2, Database, FlaskConical, Search, ShieldAlert, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { PageIntro } from '@/components/common/PageIntro';
import { SectionHeader } from '@/components/common/SectionHeader';
import {
  buildCameoPairs,
  CAMEO_GROUP_TO_CABINET,
  cameoMeta,
  CameoCompatibility,
  CameoGroupFinding,
  CameoPairFinding,
  CameoMatch,
  CameoReactiveGroup,
  findCameoChemicalById,
  lookupGroupPairReactivity,
  resolveCameoMatch,
  searchCameoChemicals,
} from '@/services/cameoStorage';
import { classifyStorage } from '@/services/storageClassifier';
import { Storage2MatchEdit, Storage2PairEdit, Substance } from '@/types/assessment';

export function Storage20Section() {
  const assessment = useAssessment((s) => s.assessment);
  const storage2 = useAssessment((s) => s.assessment.storage2);
  const updateStorage2 = useAssessment((s) => s.updateStorage2);

  const chemicals = useMemo(() => uniqueChemicals(assessment.processSteps.flatMap((step) => step.chemicals)), [assessment.processSteps]);
  const matches = useMemo(
    () => chemicals.map((chemical) => resolveCameoMatch(chemical, storage2.matches[chemical.id])),
    [chemicals, storage2.matches],
  );
  const pairs = useMemo(() => buildCameoPairs(matches, storage2.pairOverrides), [matches, storage2.pairOverrides]);
  const unmatched = matches.filter((match) => !match.cameo);
  const unconfirmed = matches.filter((match) => !match.confirmed);

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

  const updatePair = (pairKey: string, patch: Storage2PairEdit) => {
    updateStorage2({
      pairOverrides: {
        ...storage2.pairOverrides,
        [pairKey]: {
          ...(storage2.pairOverrides[pairKey] ?? {}),
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  };

  return (
    <section>
      <SectionHeader
        title="Storage 2.0"
        subtitle={
          chemicals.length > 0
            ? `CAMEO compatibility review for ${chemicals.length} chemical${chemicals.length === 1 ? '' : 's'} from Process Steps.`
            : 'Add chemicals in Process Steps to run CAMEO compatibility checks.'
        }
      />

      <PageIntro
        body="Use this experimental page to match assessment chemicals to CAMEO records, review CAMEO reactive-group incompatibilities, and plan physical segregation."
        steps={[
          { title: '1. Confirm matches', body: 'Check that each CAT chemical maps to the right CAMEO chemical or mark it unmatched for SDS review.' },
          { title: '2. Review pairs', body: 'Prioritise incompatible and caution findings before deciding whether chemicals can share storage.' },
          { title: '3. Separate where needed', body: 'Use the generated separation groups as evidence for cabinet or secondary containment decisions.' },
        ]}
        optionalStep={{
          title: 'Source',
          body: `CAMEO Chemicals ${cameoMeta.version}, imported ${cameoMeta.importDate.slice(0, 10)}. This is reactive compatibility evidence; still verify SDS sections 7 and 10.`,
        }}
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryTile label="CAMEO matches" value={`${matches.length - unmatched.length}/${matches.length}`} tone={unmatched.length ? 'warn' : 'ok'} />
        <SummaryTile label="Need confirmation" value={String(unconfirmed.length)} tone={unconfirmed.length ? 'warn' : 'ok'} />
        <SummaryTile label="High concern pairs" value={String(pairs.filter((pair) => matrixCompatibility(pair) === 'Incompatible').length)} tone="danger" />
        <SummaryTile label="Caution pairs" value={String(pairs.filter((pair) => matrixCompatibility(pair) === 'Caution').length)} tone="warn" />
      </div>

      <div className="mt-4 space-y-4">
        <MatchReviewPanel matches={matches} onUpdateMatch={updateMatch} />
        <PairFindingsPanel pairs={pairs} onUpdatePair={updatePair} />
        <CabinetSchemePanel matches={matches} pairs={pairs} notes={storage2.layoutNotes} onNotes={(layoutNotes) => updateStorage2({ layoutNotes })} />
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

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'danger' }) {
  return (
    <div className={clsx(
      'rounded-lg border bg-white p-4',
      tone === 'ok' && 'border-emerald-200',
      tone === 'warn' && 'border-amber-200',
      tone === 'danger' && 'border-red-200',
    )}>
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={clsx(
        'mt-2 text-2xl font-semibold',
        tone === 'ok' && 'text-emerald-700',
        tone === 'warn' && 'text-amber-700',
        tone === 'danger' && 'text-red-700',
      )}>{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) {
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

function MatchReviewPanel({ matches, onUpdateMatch }: { matches: CameoMatch[]; onUpdateMatch: (chemicalId: string, patch: Storage2MatchEdit) => void }) {
  return (
    <Panel title="CAMEO chemical matching" subtitle="CAS exact matches are preferred. Manually change a match where the CAMEO record is not the intended substance." icon={<Database size={18} />}>
      <div className="space-y-3">
        {matches.map((match) => (
          <MatchCard key={match.chemical.id} match={match} onUpdate={(patch) => onUpdateMatch(match.chemical.id, patch)} />
        ))}
        {matches.length === 0 && <EmptyMessage>Add chemicals in Process Steps to generate CAMEO matches.</EmptyMessage>}
      </div>
    </Panel>
  );
}

function MatchCard({ match, onUpdate }: { match: CameoMatch; onUpdate: (patch: Storage2MatchEdit) => void }) {
  const [query, setQuery] = useState(match.chemical.cas || match.chemical.name);
  const options = useMemo(() => searchCameoChemicals(query), [query]);
  const selected = match.cameo ? findCameoChemicalById(match.cameo.id) : null;

  return (
    <div className={clsx('rounded-lg border p-3', match.confirmed ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/30')}>
      <div className="grid gap-3 xl:grid-cols-[1fr_1.25fr_auto]">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{match.chemical.name || match.chemical.cas || 'Unnamed chemical'}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {match.chemical.cas ? `CAS ${match.chemical.cas}` : 'No CAS recorded'} · {match.reason}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <ConfidenceBadge confidence={match.confidence} />
            {match.groups.map((group) => <span key={group.id} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700">{group.name}</span>)}
            {match.groups.length === 0 && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] text-red-700">No reactive groups</span>}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-zinc-500">CAMEO record</label>
          <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_1.2fr]">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                className="w-full rounded-md border border-zinc-200 py-2 pl-7 pr-2 text-xs outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search CAMEO name or CAS"
              />
            </div>
            <select
              className="w-full rounded-md border border-zinc-200 px-2 py-2 text-xs outline-none focus:border-accent-300 focus:ring-2 focus:ring-accent-100"
              value={selected?.id ?? ''}
              onChange={(e) => onUpdate({ cameoChemicalId: e.target.value ? Number(e.target.value) : null, confirmed: false })}
            >
              <option value="">No CAMEO match / SDS review</option>
              {options.map((chemical) => (
                <option key={chemical.id} value={chemical.id}>{chemical.name}{chemical.cas[0] ? ` · ${chemical.cas[0]}` : ''}</option>
              ))}
              {selected && !options.some((option) => option.id === selected.id) && (
                <option value={selected.id}>{selected.name}{selected.cas[0] ? ` · ${selected.cas[0]}` : ''}</option>
              )}
            </select>
          </div>
          {match.cameo && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-600">
              {match.cameo.chemicalProfile || match.cameo.airWaterReactions || match.cameo.specialHazards || 'No CAMEO profile text available.'}
            </p>
          )}
        </div>

        <label className={clsx(
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold',
          match.confirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800',
        )}>
          <input
            type="checkbox"
            className="h-5 w-5 accent-accent-600"
            checked={match.confirmed}
            onChange={(e) => onUpdate({ confirmed: e.target.checked })}
          />
          {match.confirmed ? 'Match confirmed' : 'Confirm match'}
        </label>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: CameoMatch['confidence'] }) {
  const label = {
    'exact-cas': 'CAS match',
    'exact-name': 'Name match',
    synonym: 'Synonym match',
    manual: 'Manual match',
    unmatched: 'Unmatched',
  }[confidence];
  return (
    <span className={clsx(
      'rounded px-1.5 py-0.5 text-[11px] font-semibold',
      confidence === 'unmatched' ? 'bg-red-50 text-red-700' : confidence === 'manual' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700',
    )}>{label}</span>
  );
}

function PairFindingsPanel({ pairs, onUpdatePair }: { pairs: ReturnType<typeof buildCameoPairs>; onUpdatePair: (pairKey: string, patch: Storage2PairEdit) => void }) {
  const [selectedGroupPair, setSelectedGroupPair] = useState<string | null>(null);

  // Collect all distinct CAMEO reactive groups across all matches
  const allGroups = useMemo(() => {
    const groupMap = new Map<number, CameoReactiveGroup>();
    for (const pair of pairs) {
      for (const finding of pair.groupFindings) {
        groupMap.set(finding.leftGroup.id, finding.leftGroup);
        groupMap.set(finding.rightGroup.id, finding.rightGroup);
      }
    }
    return [...groupMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [pairs]);

  // Map each group → chemicals that belong to it
  const chemicalsByGroup = useMemo(() => {
    const map = new Map<number, CameoMatch[]>();
    for (const pair of pairs) {
      for (const finding of pair.groupFindings) {
        for (const group of [finding.leftGroup, finding.rightGroup]) {
          const list = map.get(group.id) ?? [];
          const candidates = [pair.left, pair.right];
          for (const candidate of candidates) {
            if (candidate.groups.some((g) => g.id === group.id) && !list.some((m) => m.chemical.id === candidate.chemical.id)) {
              list.push(candidate);
            }
          }
          map.set(group.id, list);
        }
      }
    }
    return map;
  }, [pairs]);

  // Group-pair → affected chemical pairs lookup
  const chemicalPairsByGroupPair = useMemo(() => {
    const map = new Map<string, CameoPairFinding[]>();
    for (const pair of pairs) {
      for (const finding of pair.groupFindings) {
        const key = pairKeyForGroups(finding.leftGroup.id, finding.rightGroup.id);
        const list = map.get(key) ?? [];
        if (!list.some((p) => p.key === pair.key)) {
          list.push(pair);
        }
        map.set(key, list);
      }
    }
    return map;
  }, [pairs]);

  const selectedFinding = selectedGroupPair ? lookupGroupPairReactivity(...selectedGroupPair.split(':').map(Number) as [number, number]) : null;
  const selectedChemicalPairs = selectedGroupPair ? (chemicalPairsByGroupPair.get(selectedGroupPair) ?? []) : [];

  return (
    <Panel title="Compatibility matrix (by reactive group)" subtitle="CAMEO reactive group compatibility. Hover a cell to see which chemicals belong to each group. Click to inspect evidence and affected chemical pairs." icon={<AlertTriangle size={18} />}>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} className="text-emerald-600" /> Compatible</span>
        <span className="inline-flex items-center gap-1"><ShieldAlert size={14} className="text-amber-600" /> Caution</span>
        <span className="inline-flex items-center gap-1"><span className="text-base font-bold text-red-600">x</span> Incompatible</span>
        <span className="inline-flex items-center gap-1"><span className="text-xs font-bold text-zinc-500">?</span> Unknown</span>
      </div>

      {allGroups.length > 1 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-center text-[11px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 p-2 text-left text-zinc-500">Reactive group</th>
                {allGroups.map((group, index) => (
                  <th key={group.id} className="border border-zinc-200 bg-zinc-50 p-2 align-bottom font-semibold text-zinc-700">
                    <div className="mx-auto flex flex-col items-center gap-0.5">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-zinc-100 text-[9px]">{index + 1}</span>
                      <span className="text-[10px] leading-tight" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>{shortGroupName(group)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allGroups.map((rowGroup, rowIndex) => (
                <tr key={rowGroup.id}>
                  <th className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 p-2 text-left font-semibold text-zinc-700">
                    <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-zinc-100 px-1 text-[10px]">{rowIndex + 1}</span>
                    <span className="text-[11px]">{shortGroupName(rowGroup)}</span>
                  </th>
                  {allGroups.map((colGroup, colIndex) => {
                    if (rowGroup.id === colGroup.id) {
                      return <td key={colGroup.id} className="border border-zinc-200 bg-zinc-50 p-2 text-zinc-300">-</td>;
                    }
                    const finding = lookupGroupPairReactivity(rowGroup.id, colGroup.id);
                    const compatibility = finding?.compatibility ?? 'Unknown';
                    const key = pairKeyForGroups(rowGroup.id, colGroup.id);
                    const isSelected = selectedGroupPair === key;
                    const leftChemicals = chemicalsByGroup.get(rowGroup.id) ?? [];
                    const rightChemicals = chemicalsByGroup.get(colGroup.id) ?? [];

                    return (
                      <td
                        key={colGroup.id}
                        className={clsx(
                          'group relative border border-zinc-200 p-2 transition',
                          colIndex < rowIndex && 'opacity-60',
                          isSelected && 'ring-2 ring-accent-300 ring-inset',
                          compatibility === 'Incompatible' && 'bg-red-50 hover:bg-red-100',
                          compatibility === 'Caution' && 'bg-amber-50 hover:bg-amber-100',
                          compatibility === 'Compatible' && 'bg-white hover:bg-emerald-50',
                          compatibility === 'Unknown' && 'bg-zinc-50 hover:bg-zinc-100',
                        )}
                      >
                        <button
                          type="button"
                          className="mx-auto flex h-7 w-7 items-center justify-center rounded outline-none focus:ring-2 focus:ring-accent-300"
                          aria-label={`${rowGroup.name} ↔ ${colGroup.name}: ${compatibility}`}
                          onClick={() => setSelectedGroupPair(isSelected ? null : key)}
                        >
                          <MatrixSymbol compatibility={compatibility} />
                        </button>
                        {/* Tooltip on hover */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 hidden whitespace-nowrap rounded bg-zinc-900 px-2.5 py-1.5 text-left text-xs text-white shadow-lg group-hover:block">
                          <div className="font-semibold">{rowGroup.name}</div>
                          {leftChemicals.slice(0, 5).map((m) => (
                            <div key={m.chemical.id} className="text-zinc-300">• {shortChemicalName(m)}</div>
                          ))}
                          {leftChemicals.length > 5 && <div className="text-zinc-400">... +{leftChemicals.length - 5} more</div>}
                          <div className="mt-1 border-t border-zinc-700 pt-1 font-semibold">{colGroup.name}</div>
                          {rightChemicals.slice(0, 5).map((m) => (
                            <div key={m.chemical.id} className="text-zinc-300">• {shortChemicalName(m)}</div>
                          ))}
                          {rightChemicals.length > 5 && <div className="text-zinc-400">... +{rightChemicals.length - 5} more</div>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyMessage>Add at least two CAMEO-matched chemicals to generate a compatibility matrix.</EmptyMessage>
      )}

      {/* Legend: group index → name */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-600">
        {allGroups.map((group, index) => (
          <span key={group.id} className="inline-flex items-center gap-1">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-zinc-100 text-[10px] font-semibold text-zinc-700">{index + 1}</span>
            {shortGroupName(group)}
          </span>
        ))}
      </div>

      {/* Selected group-pair evidence */}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        {selectedFinding ? (
          <GroupPairEvidence
            finding={selectedFinding}
            chemicalPairs={selectedChemicalPairs}
            onUpdatePair={onUpdatePair}
            leftChemicals={chemicalsByGroup.get(selectedFinding.leftGroup.id) ?? []}
            rightChemicals={chemicalsByGroup.get(selectedFinding.rightGroup.id) ?? []}
          />
        ) : (
          <div className="text-sm text-zinc-500">Click a matrix cell to view group-pair evidence and affected chemical pairs.</div>
        )}
      </div>
    </Panel>
  );
}

function MatrixSymbol({ compatibility }: { compatibility: CameoCompatibility }) {
  if (compatibility === 'Incompatible') return <span className="text-base font-bold text-red-600">x</span>;
  if (compatibility === 'Caution') return <ShieldAlert size={16} className="text-amber-600" />;
  if (compatibility === 'Compatible') return <CheckCircle2 size={16} className="text-emerald-600" />;
  return <span className="text-xs font-bold text-zinc-500">?</span>;
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

function shortChemicalName(match: CameoMatch) {
  const name = match.chemical.name || match.chemical.cas || 'Unnamed';
  return name.length > 28 ? `${name.slice(0, 25)}...` : name;
}

function shortGroupName(group: CameoReactiveGroup) {
  return group.name.length > 40 ? `${group.name.slice(0, 37)}...` : group.name;
}

function pairKeyForGroups(leftGroupId: number, rightGroupId: number) {
  return [leftGroupId, rightGroupId].sort((a, b) => a - b).join(':');
}

function GroupPairEvidence({
  finding,
  chemicalPairs,
  onUpdatePair,
  leftChemicals,
  rightChemicals,
}: {
  finding: CameoGroupFinding;
  chemicalPairs: CameoPairFinding[];
  onUpdatePair: (pairKey: string, patch: Storage2PairEdit) => void;
  leftChemicals: CameoMatch[];
  rightChemicals: CameoMatch[];
}) {
  return (
    <div className={clsx('rounded-lg border p-3', toneForCompatibility(finding.compatibility))}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">
            {finding.leftGroup.name} ↔ {finding.rightGroup.name}
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            CAMEO compatibility: {finding.compatibility}
          </div>
        </div>
        <CompatibilityBadge compatibility={finding.compatibility} original={finding.compatibility} />
      </div>

      {(finding.gasProducts.length > 0 || finding.hazards.length > 0) && (
        <div className="mt-3 rounded-md bg-white/70 p-2 text-xs">
          {finding.gasProducts.length > 0 && (
            <div className="font-medium text-red-700">Gas products: {finding.gasProducts.join(', ')}</div>
          )}
          {finding.hazards.length > 0 && (
            <div className="mt-1 text-zinc-600">{finding.hazards.slice(0, 4).join('; ')}</div>
          )}
          {finding.hazardsDocumentation && (
            <div className="mt-1 italic text-zinc-500">{finding.hazardsDocumentation.slice(0, 200)}</div>
          )}
        </div>
      )}

      <div className="mt-3">
        <div className="text-xs font-semibold text-zinc-500">Chemicals in these groups</div>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded-md bg-white/70 p-2 text-xs">
            <div className="font-semibold text-zinc-700">{finding.leftGroup.name}</div>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-zinc-600">
              {leftChemicals.map((m) => (
                <li key={m.chemical.id}>{m.chemical.name || m.chemical.cas}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md bg-white/70 p-2 text-xs">
            <div className="font-semibold text-zinc-700">{finding.rightGroup.name}</div>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-zinc-600">
              {rightChemicals.map((m) => (
                <li key={m.chemical.id}>{m.chemical.name || m.chemical.cas}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {chemicalPairs.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-zinc-500">
            Affected chemical pairs ({chemicalPairs.length})
          </div>
          <div className="mt-2 space-y-2">
            {chemicalPairs.slice(0, 6).map((pair) => (
              <div key={pair.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 p-2 text-xs">
                <div>
                  <span className="font-semibold text-zinc-800">
                    {pair.left.chemical.name || pair.left.chemical.cas}
                  </span>
                  <span className="mx-1 text-zinc-400">+</span>
                  <span className="font-semibold text-zinc-800">
                    {pair.right.chemical.name || pair.right.chemical.cas}
                  </span>
                  <span className="ml-2 text-zinc-500">({matrixCompatibility(pair)})</span>
                </div>
                <select
                  className="rounded border border-zinc-200 px-1.5 py-1 text-[11px] outline-none focus:border-accent-300"
                  value={pair.override?.assessorDecision ?? 'accept'}
                  onChange={(e) => onUpdatePair(pair.key, { assessorDecision: e.target.value as Storage2PairEdit['assessorDecision'] })}
                >
                  <option value="accept">Accept</option>
                  <option value="override-separate">Keep separate</option>
                  <option value="override-compatible">SDS: compatible</option>
                </select>
              </div>
            ))}
            {chemicalPairs.length > 6 && (
              <div className="text-xs text-zinc-500">... and {chemicalPairs.length - 6} more pairs</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompatibilityBadge({ compatibility, original }: { compatibility: CameoCompatibility; original: CameoCompatibility }) {
  const Icon = compatibility === 'Incompatible' ? XCircle : compatibility === 'Compatible' ? CheckCircle2 : ShieldAlert;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold',
      compatibility === 'Incompatible' && 'bg-red-100 text-red-800',
      compatibility === 'Caution' && 'bg-amber-100 text-amber-800',
      compatibility === 'Compatible' && 'bg-emerald-100 text-emerald-800',
      compatibility === 'Unknown' && 'bg-zinc-100 text-zinc-700',
    )}>
      <Icon size={14} /> {compatibility}{original !== compatibility ? ` · was ${original}` : ''}
    </span>
  );
}

function toneForCompatibility(compatibility: CameoCompatibility) {
  if (compatibility === 'Incompatible') return 'border-red-200 bg-red-50/45';
  if (compatibility === 'Caution') return 'border-amber-200 bg-amber-50/45';
  if (compatibility === 'Compatible') return 'border-emerald-200 bg-emerald-50/30';
  return 'border-zinc-200 bg-zinc-50';
}

type CabinetId = 'flammables' | 'corrosiveAcids' | 'corrosiveBases' | 'oxidizers' | 'toxins' | 'shelving' | 'specialReview' | 'review';
type ZoneId =
  | 'organicSolventsAcids'
  | 'volatilePoisonsChlorinated'
  | 'nonOxidizingAcids'
  | 'oxidizingAcids'
  | 'solidBases'
  | 'liquidBases'
  | 'oxidizersOnly'
  | 'dryPoisons'
  | 'liquidPoisons'
  | 'drySolids'
  | 'specialReview'
  | 'review';

interface CabinetZoneDef {
  id: ZoneId;
  cabinetId: CabinetId;
  cabinetTitle: string;
  zoneTitle: string;
  note: string;
  className: string;
  textClassName: string;
}

interface CabinetAssignment {
  match: CameoMatch;
  zone: CabinetZoneDef;
  confidence: 'high' | 'medium' | 'review';
  reasons: string[];
  requirements: string[];
  constraints: string[];
}

interface CabinetWarning {
  key: string;
  cabinetId: CabinetId;
  zoneId?: ZoneId;
  scope: 'same-zone' | 'same-cabinet';
  pair: CameoPairFinding;
  compatibility: CameoCompatibility;
  rawCompatibility: CameoCompatibility;
  message: string;
  evidence: string[];
}

const ZONES: Record<ZoneId, CabinetZoneDef> = {
  organicSolventsAcids: {
    id: 'organicSolventsAcids',
    cabinetId: 'flammables',
    cabinetTitle: 'Flammables Cabinet',
    zoneTitle: 'Organic solvents and organic acids',
    note: 'Use for flammable organic solvents and flammable organic acids where SDS confirms this is appropriate.',
    className: 'border-yellow-300 bg-yellow-100',
    textClassName: 'text-yellow-950',
  },
  volatilePoisonsChlorinated: {
    id: 'volatilePoisonsChlorinated',
    cabinetId: 'flammables',
    cabinetTitle: 'Flammables Cabinet',
    zoneTitle: 'Volatile poisons and chlorinated solvents',
    note: 'Requires secondary containment; keep from incompatible spill contact within the cabinet.',
    className: 'border-sky-300 bg-sky-100',
    textClassName: 'text-sky-950',
  },
  nonOxidizingAcids: {
    id: 'nonOxidizingAcids',
    cabinetId: 'corrosiveAcids',
    cabinetTitle: 'Corrosives Cabinet',
    zoneTitle: 'Non-oxidizing organic and mineral acids',
    note: 'Keep acids separate from bases; acids and bases should not share a cabinet.',
    className: 'border-violet-300 bg-violet-100',
    textClassName: 'text-violet-950',
  },
  oxidizingAcids: {
    id: 'oxidizingAcids',
    cabinetId: 'corrosiveAcids',
    cabinetTitle: 'Corrosives Cabinet',
    zoneTitle: 'Oxidizing acids in double containment',
    note: 'Double containment required; isolate from organic solvents/acids, bases and oxidizer cabinet contents.',
    className: 'border-red-300 bg-red-100',
    textClassName: 'text-red-950',
  },
  liquidBases: {
    id: 'liquidBases',
    cabinetId: 'corrosiveBases',
    cabinetTitle: 'Corrosives Cabinet',
    zoneTitle: 'Liquid bases',
    note: 'Bases must be separate from acids; strong acids and bases should not be in the same cabinet.',
    className: 'border-orange-300 bg-orange-100',
    textClassName: 'text-orange-950',
  },
  solidBases: {
    id: 'solidBases',
    cabinetId: 'corrosiveBases',
    cabinetTitle: 'Corrosives Cabinet',
    zoneTitle: 'Solid bases',
    note: 'Dry caustic bases such as hydroxide pellets/flakes; keep dry and separate from acids.',
    className: 'border-orange-300 bg-orange-50',
    textClassName: 'text-orange-950',
  },
  oxidizersOnly: {
    id: 'oxidizersOnly',
    cabinetId: 'oxidizers',
    cabinetTitle: 'Oxidizers Cabinet',
    zoneTitle: 'Oxidizers, excluding oxidizing acids or organic peroxides',
    note: 'Temperature-dependent oxidizers or peroxide-formers need separation from all other materials in secondary containment.',
    className: 'border-amber-300 bg-amber-100',
    textClassName: 'text-amber-950',
  },
  dryPoisons: {
    id: 'dryPoisons',
    cabinetId: 'toxins',
    cabinetTitle: 'Toxins Cabinet',
    zoneTitle: 'Non-volatile poisons - dry',
    note: 'Keep dry poisons separate from liquid poison spill paths.',
    className: 'border-pink-300 bg-pink-100',
    textClassName: 'text-pink-950',
  },
  liquidPoisons: {
    id: 'liquidPoisons',
    cabinetId: 'toxins',
    cabinetTitle: 'Toxins Cabinet',
    zoneTitle: 'Non-volatile poisons - liquid',
    note: 'Store liquids below dry poisons and use compatible secondary containment.',
    className: 'border-pink-300 bg-pink-100',
    textClassName: 'text-pink-950',
  },
  drySolids: {
    id: 'drySolids',
    cabinetId: 'shelving',
    cabinetTitle: 'Shelving',
    zoneTitle: 'Dry solids',
    note: 'Dry, compatible solids only; avoid shelves above/near incompatible liquids.',
    className: 'border-emerald-300 bg-emerald-100',
    textClassName: 'text-emerald-950',
  },
  specialReview: {
    id: 'specialReview',
    cabinetId: 'specialReview',
    cabinetTitle: 'Special / Review SDS',
    zoneTitle: 'Hard isolation / dedicated reactive storage',
    note: 'Water-reactive, pyrophoric, explosive, polymerizable, organic peroxides, radioactive. Requires dedicated cabinets, gas cabinets, or explosives lockers per SDS.',
    className: 'border-red-400 bg-red-100',
    textClassName: 'text-red-950',
  },
  review: {
    id: 'review',
    cabinetId: 'review',
    cabinetTitle: 'Review SDS',
    zoneTitle: 'Unassigned / assessor review',
    note: 'No confident cabinet assignment. Check SDS sections 7 and 10 and local storage rules.',
    className: 'border-zinc-300 bg-zinc-100',
    textClassName: 'text-zinc-800',
  },
};

const CABINET_ORDER: CabinetId[] = ['specialReview', 'flammables', 'corrosiveAcids', 'corrosiveBases', 'oxidizers', 'toxins', 'shelving', 'review'];

function CabinetSchemePanel({
  matches,
  pairs,
  notes,
  onNotes,
}: {
  matches: CameoMatch[];
  pairs: CameoPairFinding[];
  notes: string;
  onNotes: (value: string) => void;
}) {
  const assignments = useMemo(() => matches.map(assignCabinetZone), [matches]);
  const assignmentsByCabinet = useMemo(() => {
    const byCabinet = new Map<CabinetId, CabinetAssignment[]>();
    for (const assignment of assignments) {
      byCabinet.set(assignment.zone.cabinetId, [...(byCabinet.get(assignment.zone.cabinetId) ?? []), assignment]);
    }
    return byCabinet;
  }, [assignments]);
  const warningsByCabinet = useMemo(() => buildCabinetWarnings(assignments, pairs), [assignments, pairs]);
  const cabinetWarnings = useMemo(() => [...warningsByCabinet.values()].flat(), [warningsByCabinet]);

  return (
    <Panel
      title="Image-based cabinet layout"
      subtitle="Primary placement follows the supplied cabinet scheme; CAMEO pair findings are used as spill-contact and secondary-containment warnings."
      icon={<FlaskConical size={18} />}
    >
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <p className="font-semibold">CAMEO-driven cabinet assignment</p>
        <p className="mt-1">Chemicals are assigned to cabinets based on CAMEO reactive-group membership using a priority order: Special/Review (hard isolation) → Oxidizers → inert/low-reactivity Dry Solids (shelving) → cabinet by hazard group (Acids, Bases, Toxins, Flammables). When possible, isolate each cabinet group separately. Acids and bases must not share a cabinet. Oxidizing acids require double containment within the corrosives cabinet.</p>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {CABINET_ORDER.map((cabinetId) => {
          const cabinetAssignments = assignmentsByCabinet.get(cabinetId) ?? [];
          if (cabinetAssignments.length === 0) return null;
          const cabinetTitle = cabinetAssignments[0]?.zone.cabinetTitle ?? (cabinetId === 'review' ? 'Review SDS' : '');
          return (
            <div key={cabinetId} data-testid="storage2-cabinet" className="rounded-lg border border-zinc-200 bg-white p-3">
              <div data-testid="storage2-cabinet-title" className="text-sm font-semibold text-zinc-900">{cabinetTitle}</div>
              <div className="mt-3 space-y-2">
                {Object.values(ZONES)
                  .filter((zone) => zone.cabinetId === cabinetId)
                  .map((zone) => ({ zone, zoneAssignments: cabinetAssignments.filter((assignment) => assignment.zone.id === zone.id) }))
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
      {cabinetWarnings.length > 0 && (
        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <summary className="cursor-pointer font-semibold">
            {cabinetWarnings.length} CAMEO spill-contact warning{cabinetWarnings.length === 1 ? '' : 's'} for assigned cabinets
          </summary>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {cabinetWarnings.slice(0, 12).map((warning) => (
              <div key={warning.key} className="rounded-md border border-amber-200 bg-white/70 px-2.5 py-2 leading-snug">
                <div className="font-semibold">{warning.message}</div>
                <div className="mt-0.5 text-[11px] opacity-85">
                  {warning.pair.left.chemical.name || warning.pair.left.cameo?.name || 'Chemical'} ↔ {warning.pair.right.chemical.name || warning.pair.right.cameo?.name || 'Chemical'}
                  {warning.rawCompatibility !== warning.compatibility ? ` · CAMEO ${warning.rawCompatibility}, storage action ${warning.compatibility}` : ` · CAMEO ${warning.rawCompatibility}`}
                </div>
                {warning.evidence.length > 0 && <div className="mt-1 text-[11px] opacity-80">{warning.evidence.join('; ')}</div>}
              </div>
            ))}
            {cabinetWarnings.length > 12 && (
              <div className="rounded-md border border-amber-200 bg-white/70 px-2.5 py-2 font-medium">+{cabinetWarnings.length - 12} more warning{cabinetWarnings.length - 12 === 1 ? '' : 's'}</div>
            )}
          </div>
        </details>
      )}
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-zinc-500">Storage 2.0 layout notes</span>
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

function CabinetZone({ zone, assignments }: { zone: CabinetZoneDef; assignments: CabinetAssignment[] }) {
  return (
    <div className={clsx('min-h-28 rounded-md border p-3', zone.className, zone.textClassName)}>
      <div className="text-xs font-semibold leading-tight">{zone.zoneTitle}</div>
      <div className="mt-1 text-[11px] leading-snug opacity-85">{zone.note}</div>
      <div className="mt-2 space-y-1">
        {assignments.map((assignment) => (
          <div key={assignment.match.chemical.id} className="rounded bg-white/70 px-2 py-1 text-xs text-zinc-900">
            <div className="font-semibold">{assignment.match.chemical.name || assignment.match.chemical.cas || 'Unnamed chemical'}</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              <span className={clsx(
                'rounded px-1 py-0.5 text-[10px] font-semibold',
                assignment.confidence === 'high' && 'bg-emerald-100 text-emerald-800',
                assignment.confidence === 'medium' && 'bg-amber-100 text-amber-800',
                assignment.confidence === 'review' && 'bg-red-100 text-red-800',
              )}>{assignment.confidence}</span>
              {assignment.requirements.map((requirement) => (
                <span key={requirement} className="rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-700">{requirement}</span>
              ))}
            </div>
            {assignment.constraints.length > 0 && (
              <div className="mt-1 text-[10px] leading-snug text-red-700">
                {assignment.constraints.slice(0, 2).join('; ')}{assignment.constraints.length > 2 ? '...' : ''}
              </div>
            )}
          </div>
        ))}
        {assignments.length === 0 && <div className="rounded border border-dashed border-white/80 px-2 py-2 text-center text-[11px] opacity-70">No chemicals assigned</div>}
      </div>
    </div>
  );
}

function buildCabinetWarnings(assignments: CabinetAssignment[], pairs: CameoPairFinding[]) {
  const assignmentByChemicalId = new Map(assignments.map((assignment) => [assignment.match.chemical.id, assignment]));
  const warningsByCabinet = new Map<CabinetId, CabinetWarning[]>();

  for (const pair of pairs) {
    const left = assignmentByChemicalId.get(pair.left.chemical.id);
    const right = assignmentByChemicalId.get(pair.right.chemical.id);
    if (!left || !right || left.zone.cabinetId !== right.zone.cabinetId) continue;

    const compatibility = matrixCompatibility(pair);
    if (compatibility === 'Compatible' || compatibility === 'Unknown') continue;

    const sameZone = left.zone.id === right.zone.id;
    if (!sameZone && compatibility !== 'Incompatible') continue;

    const scope: CabinetWarning['scope'] = sameZone ? 'same-zone' : 'same-cabinet';
    const warning: CabinetWarning = {
      key: `${pair.key}:${left.zone.id}:${right.zone.id}`,
      cabinetId: left.zone.cabinetId,
      zoneId: sameZone ? left.zone.id : undefined,
      scope,
      pair,
      compatibility,
      rawCompatibility: pair.effectiveCompatibility,
      message: sameZone
        ? 'Same storage zone: add separation, secondary containment, or move one chemical.'
        : 'Same cabinet: prevent spill contact with separate trays/secondary containment or relocate.',
      evidence: warningEvidence(pair),
    };

    warningsByCabinet.set(warning.cabinetId, [...(warningsByCabinet.get(warning.cabinetId) ?? []), warning]);
  }

  for (const [cabinetId, warnings] of warningsByCabinet) {
    warningsByCabinet.set(cabinetId, warnings.sort((left, right) => {
      const leftScore = left.compatibility === 'Incompatible' ? 2 : 1;
      const rightScore = right.compatibility === 'Incompatible' ? 2 : 1;
      return rightScore - leftScore || left.scope.localeCompare(right.scope);
    }));
  }

  return warningsByCabinet;
}

function warningEvidence(pair: CameoPairFinding) {
  return pair.groupFindings
    .filter((finding) => finding.compatibility === 'Incompatible' || finding.compatibility === 'Caution')
    .slice(0, 2)
    .map((finding) => `${finding.leftGroup.name} / ${finding.rightGroup.name}: ${finding.compatibility}`);
}

function assignCabinetZone(match: CameoMatch): CabinetAssignment {
  const classification = classifyStorage(match.chemical);
  const groupIds = match.groups.map((g) => g.id);
  const groupNames = match.groups.map((g) => g.name.toLowerCase());
  const nameText = [match.chemical.name, match.cameo?.name].filter(Boolean).join(' ').toLowerCase();
  const dotText = match.cameo?.dotLabels.join(' ').toLowerCase() ?? '';
  const profileText = [match.cameo?.chemicalProfile, match.cameo?.airWaterReactions, match.cameo?.specialHazards].filter(Boolean).join(' ').toLowerCase();
  const reasons: string[] = [];
  const requirements: string[] = [];
  const constraints = storageConstraints(match, { text: [nameText, dotText, profileText, groupNames.join(' ')].filter(Boolean).join(' ').toLowerCase(), nameText, dotText, profileText, groupNames });
  let zone: CabinetZoneDef = ZONES.review;
  let confidence: CabinetAssignment['confidence'] = match.cameo ? 'medium' : 'review';

  const isSolid = match.chemical.form === 'solid' || match.chemical.form === 'powder';
  const isDryBase = isSolid || looksLikeNeatDryBase(match);
  const hasCameo = match.cameo !== null;

  // ── Unmatched: no CAMEO data → requires SDS review ─────────────────
  if (!hasCameo) {
    zone = ZONES.specialReview;
    confidence = 'review';
    reasons.push('No CAMEO chemical match — manual SDS review is required before storage assignment.');
    return {
      match,
      zone,
      confidence,
      reasons: unique(reasons),
      requirements: unique(requirements),
      constraints,
    };
  }

  // Determine cabinets from CAMEO groups
  const cabinets = new Set(groupIds.map((id) => CAMEO_GROUP_TO_CABINET[id]).filter(Boolean));

  // ── Priority 1: Special / Review ───────────────────────────────────
  if (cabinets.has('specialReview')) {
    zone = ZONES.specialReview;
    confidence = 'high';
    reasons.push('CAMEO reactive group requires dedicated reactive storage or manual SDS review.');

    if (groupIds.includes(30)) {
      requirements.push('temperature-controlled storage');
      requirements.push('explosion-proof fridge/freezer if needed');
    }
    if (groupIds.some((id) => [107, 109, 108, 21, 22, 35, 42, 51].includes(id))) {
      requirements.push('keep dry');
      requirements.push('air-tight sealed container');
    }
    if (groupIds.includes(102)) requirements.push('explosives locker');
    if (groupIds.some((id) => [103, 76].includes(id))) requirements.push('inhibit or refrigerate per SDS');

    return {
      match,
      zone,
      confidence,
      reasons: unique(reasons),
      requirements: unique(requirements),
      constraints,
    };
  }

  // ── Priority 2: Oxidizers ──────────────────────────────────────────
  if (cabinets.has('oxidizers')) {
    zone = ZONES.oxidizersOnly;
    confidence = hasCameo ? 'high' : 'medium';
    requirements.push('secondary containment');
    requirements.push('separate from organics and flammables');
    reasons.push('CAMEO oxidizer reactive group — isolate from all organic/flammable materials.');

    return {
      match,
      zone,
      confidence,
      reasons: unique(reasons),
      requirements: unique(requirements),
      constraints,
    };
  }

  // ── Priority 3: inert/low-reactivity solids → Shelving ─────────────
  if (isSolid && (cabinets.size === 0 || cabinets.has('shelving'))) {
    zone = ZONES.drySolids;
    confidence = hasCameo ? 'medium' : 'review';
    reasons.push('Dry solid with no stronger CAMEO cabinet signal — suitable for shelving after SDS confirmation.');
    requirements.push('keep dry');

    return {
      match,
      zone,
      confidence,
      reasons: unique(reasons),
      requirements: unique(requirements),
      constraints,
    };
  }

  // ── Priority 4: Liquids → cabinet by CAMEO group ───────────────────
  // Sub-rule: Strong Oxidizing Acids (group 2) → double containment
  if (groupIds.includes(2) || cabinets.has('corrosiveAcids')) {
    const isOxidizingAcid = groupIds.includes(2);
    zone = isOxidizingAcid ? ZONES.oxidizingAcids : ZONES.nonOxidizingAcids;
    confidence = hasCameo ? 'high' : (classification.confidence === 'review' ? 'review' : 'medium');
    if (isOxidizingAcid) {
      requirements.push('double containment');
      requirements.push('isolate from organic acids and bases');
      reasons.push('Strong Oxidizing Acid (CAMEO group 2) — requires double containment within Corrosives cabinet.');
    } else {
      requirements.push('separate from bases');
      reasons.push('CAMEO acid reactive group — assign to Corrosives — Acids cabinet.');
    }

    return {
      match,
      zone,
      confidence,
      reasons: unique(reasons),
      requirements: unique(requirements),
      constraints,
    };
  }

  if (cabinets.has('corrosiveBases')) {
    zone = isDryBase ? ZONES.solidBases : ZONES.liquidBases;
    confidence = hasCameo ? 'high' : (classification.confidence === 'review' ? 'review' : 'medium');
    requirements.push('separate from acids');
    if (isDryBase) {
      requirements.push('keep dry');
      reasons.push('CAMEO base reactive group with dry/neat form signal — assign to Corrosives — Solid bases.');
    } else {
      reasons.push('CAMEO base reactive group — assign to Corrosives — Liquid bases.');
    }

    return {
      match,
      zone,
      confidence,
      reasons: unique(reasons),
      requirements: unique(requirements),
      constraints,
    };
  }

  if (cabinets.has('toxins')) {
    zone = ZONES.liquidPoisons;
    confidence = hasCameo ? 'high' : 'medium';
    requirements.push('liquid containment');
    requirements.push('ventilated cabinet');
    reasons.push('CAMEO toxin reactive group — assign to Toxins cabinet.');

    return {
      match,
      zone,
      confidence,
      reasons: unique(reasons),
      requirements: unique(requirements),
      constraints,
    };
  }

  if (cabinets.has('flammables')) {
    zone = ZONES.organicSolventsAcids;
    confidence = hasCameo ? 'high' : (classification.confidence === 'review' ? 'review' : 'medium');
    reasons.push('CAMEO flammable organic reactive group — assign to Flammables cabinet.');

    return {
      match,
      zone,
      confidence,
      reasons: unique(reasons),
      requirements: unique(requirements),
      constraints,
    };
  }

  // ── Fallback: no CAMEO cabinet mapping ─────────────────────────────
  // Use classifier heuristics for unmatched or ambiguous chemicals
  if (!hasCameo) {
    confidence = 'review';
    reasons.push('No CAMEO match — falling back to classifier heuristics.');

    if (classification.traits.waterReactive || classification.traits.pyrophoric) {
      zone = ZONES.specialReview;
      requirements.push('water-reactive/pyrophoric — manual SDS review required');
    } else if (classification.traits.oxidising) {
      zone = ZONES.oxidizersOnly;
      requirements.push('secondary containment');
    } else if (isSolid) {
      zone = ZONES.drySolids;
    } else if (classification.traits.acid) {
      zone = ZONES.nonOxidizingAcids;
      requirements.push('separate from bases');
    } else if (classification.traits.base) {
      zone = isDryBase ? ZONES.solidBases : ZONES.liquidBases;
      requirements.push('separate from acids');
      if (isDryBase) requirements.push('keep dry');
    } else if (classification.traits.toxic) {
      zone = ZONES.liquidPoisons;
    } else if (classification.traits.flammable) {
      zone = ZONES.organicSolventsAcids;
    }
  } else {
    reasons.push('CAMEO groups do not map to a specific cabinet — falling back to review.');
  }

  if (constraints.length > 0) {
    requirements.push(...constraints.slice(0, 4));
    if (constraints.some((c) => /pyrophoric|self-heating|reactive metals\/hydrides|peroxide\/polymerization/i.test(c))) {
      confidence = 'review';
    }
  }

  return {
    match,
    zone,
    confidence,
    reasons: unique(reasons),
    requirements: unique(requirements),
    constraints,
  };
}

function looksLikeNeatDryBase(match: CameoMatch) {
  const chemicalText = [match.chemical.name, match.chemical.formNote].filter(Boolean).join(' ').toLowerCase();
  const cameoText = match.cameo?.name.toLowerCase() ?? '';
  const combined = `${chemicalText} ${cameoText}`;
  if (!/(sodium hydroxide|potassium hydroxide|calcium hydroxide|lithium hydroxide|barium hydroxide|magnesium hydroxide)/.test(combined)) return false;
  return !/(solution|aqueous|aq\.|\b\d+\s*%|\b\d+(\.\d+)?\s*m\b|\b\d+(\.\d+)?\s*mol)/.test(chemicalText);
}

function storageConstraints(match: CameoMatch, signals: { text: string; nameText: string; dotText: string; profileText: string; groupNames: string[] }) {
  const constraints: string[] = [];
  const absorbents = match.cameo?.incompatibleAbsorbents ?? [];
  const hasGroup = (pattern: RegExp) => signals.groupNames.some((name) => pattern.test(name));

  const specialHazards = match.cameo?.specialHazards.toLowerCase() ?? '';
  if (specialHazards.includes('water-reactive')) constraints.push('water-reactive - keep dry/review');
  if (specialHazards.includes('air-reactive')) constraints.push('air-reactive - sealed compatible container');
  if (/pyrophoric|self-heating|spontaneously ignite/.test(signals.nameText) || match.chemical.hazardStatements.some((h) => ['H250', 'H251', 'H252', 'H260', 'H261'].includes(h.code))) constraints.push('pyrophoric/self-heating review');
  if (/attacks glass|etch glass|silica|silicon compounds|silicides|concrete|quartz/.test(signals.profileText)) constraints.push('container compatibility: avoid glass/silica');
  if (absorbents.length > 0) constraints.push(`incompatible absorbents: ${absorbents.slice(0, 3).join(', ')}${absorbents.length > 3 ? '...' : ''}`);
  if (/corrosive/.test(signals.dotText) && /poison|toxic/.test(signals.dotText)) constraints.push('special corrosive poison review');
  if (/cyanide/.test(signals.nameText) || hasGroup(/cyanides/)) constraints.push('hard separate from acids - HCN risk');
  if (/(sulfide|sulphide)/.test(signals.nameText) || hasGroup(/sulfides/)) constraints.push('hard separate from acids - H2S risk');
  if (/organic peroxide|peroxide-form|peroxidizable/.test(signals.nameText) || hasGroup(/peroxides/)) constraints.push('peroxide/polymerization review');
  if (hasGroup(/polymerizable/)) constraints.push('polymerization/pressure review');
  if (/sodium metal|potassium metal|lithium metal|metal hydride|hydride\b/.test(signals.nameText) || hasGroup(/hydrides|alkali metals/)) constraints.push('reactive metals/hydrides review');
  if (/generate flammable hydrogen|hydrogen gas/i.test(signals.profileText) && /metal|hydride|hydrofluoric|hydrogen fluoride/.test(signals.nameText)) constraints.push('hydrogen generation risk');
  if (/fluoride salts, soluble/.test(signals.groupNames.join(' ')) && /acid|hydrogen fluoride|hydrofluoric/.test(signals.text)) constraints.push('HF/fluoride special review');

  return unique(constraints);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-200 p-4 text-center text-sm text-zinc-500">
      {children}
    </div>
  );
}
