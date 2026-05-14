import {
  Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, ExternalLink, Sparkles,
  AlertCircle, FlaskConical, Wand2, Loader2, CheckCircle2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useAssessment } from '@/store/assessment';
import { SectionHeader } from '@/components/common/SectionHeader';
import { HCodeList } from '@/components/common/GhsBadges';
import { GhsRow, GhsGrid } from '@/components/common/GhsPictograms';
import { ChemicalAutocomplete } from '@/components/common/ChemicalAutocomplete';
import { lookupChemical } from '@/services/pubchem';
import { volatilityFromBP } from '@/services/coshhEssentials';
import { extractChemicals, ExtractMatch } from '@/services/extractChemicals';
import {
  Substance, SubstanceForm, ExposureRoutes, ProcessStep,
  isChemicalIncomplete,
} from '@/types/assessment';

const FORMS: SubstanceForm[] = [
  'solid', 'liquid', 'gas', 'vapour', 'aerosol', 'mist', 'powder', 'other',
];

const ROUTES: { key: keyof ExposureRoutes; label: string }[] = [
  { key: 'inhalation', label: 'Inhalation' },
  { key: 'skin', label: 'Skin' },
  { key: 'ingestion', label: 'Ingestion' },
  { key: 'eye', label: 'Eye' },
];

const STEP_COLOURS = [
  'bg-accent-600 text-white',
  'bg-amber-500 text-white',
  'bg-indigo-500 text-white',
  'bg-rose-500 text-white',
  'bg-violet-600 text-white',
] as const;

const Req = () => <span className="text-red-600 ml-0.5" aria-label="required">*</span>;

function formatAutoVolatility(bpC: number): string {
  if (bpC > 150) return 'low';
  if (bpC >= 50) return 'medium';
  return 'high';
}

const UNITS_BY_FORM: Record<SubstanceForm, readonly string[]> = {
  liquid:  ['mL', 'L', 'µL'],
  gas:     ['L', 'm³', 'mL'],
  vapour:  ['L', 'm³', 'mL'],
  aerosol: ['mL', 'L', 'g'],
  mist:    ['mL', 'L'],
  solid:   ['g', 'kg', 'mg'],
  powder:  ['g', 'kg', 'mg'],
  other:   ['g', 'mL', 'L', 'kg'],
};

function defaultUnit(form: SubstanceForm): string {
  return UNITS_BY_FORM[form][0];
}

function splitQuantity(raw: string): { value: string; unit: string } {
  const m = raw.trim().match(/^([0-9.,\s]*)\s*(.*)$/);
  return { value: (m?.[1] ?? '').trim(), unit: (m?.[2] ?? '').trim() };
}

function joinQuantity(value: string, unit: string): string {
  const v = value.trim();
  if (!v) return '';
  return unit ? `${v} ${unit}` : v;
}

export function SubstancesSection() {
  const steps = useAssessment((s) => s.assessment.processSteps);
  const addStep = useAssessment((s) => s.addProcessStep);

  return (
    <section>
      <SectionHeader
        title="Process Steps & Chemicals"
        subtitle="Add each step of the activity, then attach the chemicals used in that step."
        right={
          <button className="btn-primary" onClick={addStep}>
            <Plus size={14} /> Add process step
          </button>
        }
      />

      {steps.length === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-500 flex flex-col items-center gap-2">
          <FlaskConical size={24} className="text-zinc-400" />
          No process steps yet. Add one to begin.
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <ProcessStepCard key={step.id} step={step} index={idx} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProcessStepCard({ step, index }: { step: ProcessStep; index: number }) {
  const updateStep = useAssessment((s) => s.updateProcessStep);
  const removeStep = useAssessment((s) => s.removeProcessStep);
  const addChemical = useAssessment((s) => s.addChemical);
  const [showSuggest, setShowSuggest] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const incompleteCount = step.chemicals.filter(isChemicalIncomplete).length;
  const isStepComplete =
    step.step.trim().length > 0 && step.chemicals.length > 0 && incompleteCount === 0;
  const aggregatedPictograms = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof step.chemicals[number]['ghsPictograms'] = [];
    for (const c of step.chemicals) {
      for (const p of c.ghsPictograms) {
        if (!seen.has(p)) { seen.add(p); out.push(p); }
      }
    }
    return out;
  }, [step.chemicals]);

  const suggestions = useMemo<ExtractMatch[]>(() => {
    if (!step.step.trim()) return [];
    const existing = new Set(
      step.chemicals.map((c) => (c.cas ?? c.name).toLowerCase()).filter(Boolean),
    );
    return extractChemicals(step.step).filter(
      (m) => !existing.has((m.cas ?? m.name).toLowerCase()),
    );
  }, [step.step, step.chemicals]);

  const addSuggested = async (m: ExtractMatch) => {
    const key = (m.cas ?? m.name).toLowerCase();
    setAdding(key);
    try {
      const r = await lookupChemical(m.cas ?? m.name);
      addChemical(step.id, {
        pubchemCid: r.cid,
        cas: r.cas ?? m.cas,
        name: r.name,
        hazardStatements: r.hazardStatements,
        ghsPictograms: r.pictograms,
        wel: {
          twa: r.wel.twa ?? 'n/a',
          stel: r.wel.stel ?? 'n/a',
          source: r.wel.source ?? 'Manual',
        },
        form: r.form ?? 'liquid',
        sdsUrl: r.sdsUrl,
        sdsSource: r.sdsSource,
        boilingPointC: r.boilingPointC,
        pubchemFetchedAt: r.fetchedAt,
      });
    } catch {
      // Fallback: PubChem unreachable. Seed the row with the EH40 data so the
      // user can refresh later. Row will remain red-starred until they do.
      addChemical(step.id, { name: m.name, cas: m.cas });
    } finally {
      setAdding(null);
    }
  };

  if (collapsed) {
    return (
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-full text-left p-3 flex items-center gap-3 hover:bg-zinc-50"
        >
          <div
            className={clsx(
              'shrink-0 w-7 h-7 rounded-full text-sm font-semibold flex items-center justify-center shadow-soft',
              STEP_COLOURS[index % STEP_COLOURS.length],
            )}
          >
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-zinc-900 truncate">
                {step.step.trim() || <span className="italic text-zinc-400">No description</span>}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px] text-zinc-500">
                {step.chemicals.length} chemical{step.chemicals.length === 1 ? '' : 's'}
              </span>
              {aggregatedPictograms.length > 0 && (
                <>
                  <span className="text-zinc-300">·</span>
                  <GhsRow ids={aggregatedPictograms} size={18} />
                </>
              )}
            </div>
          </div>
          {isStepComplete ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-medium shrink-0">
              <CheckCircle2 size={14} /> Complete
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700 text-[11px] font-medium shrink-0">
              <AlertCircle size={14} />
              {!step.step.trim() || step.chemicals.length === 0
                ? 'Incomplete'
                : `${incompleteCount} to finish`}
            </span>
          )}
          <ChevronRight size={16} className="text-zinc-400 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div
          className={clsx(
            'shrink-0 w-7 h-7 rounded-full text-sm font-semibold flex items-center justify-center mt-0.5 shadow-soft',
            STEP_COLOURS[index % STEP_COLOURS.length],
          )}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              Process step
            </span>
            <div className="flex items-center gap-2">
              {suggestions.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost text-xs px-2 py-1 text-accent-700 hover:bg-accent-50"
                  onClick={() => setShowSuggest((v) => !v)}
                >
                  <Wand2 size={12} />
                  Suggest {suggestions.length} chemical{suggestions.length === 1 ? '' : 's'}
                </button>
              )}
              <button
                type="button"
                className="btn-ghost text-xs px-2 py-1 text-zinc-600 hover:bg-zinc-100"
                onClick={() => setCollapsed(true)}
                title="Collapse step"
              >
                <ChevronDown size={14} /> Collapse
              </button>
              <button
                className="btn-ghost text-red-600 hover:bg-red-50 !px-2 !py-1"
                onClick={() => removeStep(step.id)}
                aria-label="Remove step"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <textarea
            className="field-textarea bg-white text-sm"
            value={step.step}
            onChange={(e) => updateStep(step.id, { step: e.target.value })}
            placeholder="Describe this step — e.g. dispense 500 mL acetone and 200 mL methanol into 1 L reactor"
            autoFocus={!step.step}
          />
        </div>
      </div>

      {showSuggest && suggestions.length > 0 && (
        <div className="border-t border-zinc-100 bg-accent-50/40 px-4 py-3">
          <div className="text-[11px] text-zinc-600 mb-2">
            Found these in your step text. Click to add as chemicals (you can still edit afterwards).
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((m) => {
              const key = (m.cas ?? m.name).toLowerCase();
              const loading = adding === key;
              return (
                <button
                  key={(m.cas ?? m.name) + m.matchedTerm}
                  type="button"
                  disabled={adding !== null}
                  onClick={() => addSuggested(m)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-accent-200 text-accent-800 text-xs hover:bg-accent-100 disabled:opacity-50"
                  title={m.cas ? `CAS ${m.cas} — adds with PubChem details` : undefined}
                >
                  {loading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  {m.name}
                  {m.cas && <span className="font-mono text-[10px] text-zinc-500">· {m.cas}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-100 bg-zinc-50/40 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            Chemicals in this step ({step.chemicals.length})
          </span>
          <button
            className="btn-ghost text-xs px-2 py-1 text-accent-700 hover:bg-accent-50"
            onClick={() => addChemical(step.id)}
          >
            <Plus size={12} /> Add chemical
          </button>
        </div>
        {step.chemicals.length === 0 ? (
          <div className="text-xs text-zinc-400 italic px-1 py-2">
            No chemicals added yet. Use "Add chemical" or, if you've described the step above, try
            "Suggest".
          </div>
        ) : (
          <div className="space-y-1.5">
            {step.chemicals.map((c) => (
              <ChemicalRow key={c.id} stepId={step.id} chemical={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChemicalRow({ stepId, chemical: c }: { stepId: string; chemical: Substance }) {
  const update = useAssessment((st) => st.updateChemical);
  const remove = useAssessment((st) => st.removeChemical);
  const incomplete = isChemicalIncomplete(c);
  const [open, setOpen] = useState(incomplete);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (patch: Partial<Substance>) => update(stepId, c.id, patch);

  const lookup = async (force = false, override?: string | number) => {
    const query = typeof override === 'number' ? override : (override ?? c.name).trim();
    if (!query) { setError('Enter a chemical name first.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await lookupChemical(query, { force });
      const isDifferentChemical = c.pubchemCid !== undefined && r.cid !== c.pubchemCid;
      // When switching to a different compound, clear stale fields from the
      // previous chemical rather than carrying them over.
      const form = r.form ?? (isDifferentChemical ? 'liquid' : c.form);
      const bp = r.boilingPointC ?? (isDifferentChemical ? undefined : c.boilingPointC);
      // On a fresh lookup, set volatility from BP for liquids — user can still
      // override afterwards. This keeps the dropdown in sync with the BP shown.
      const derivedVolatility =
        form === 'liquid' && typeof bp === 'number'
          ? volatilityFromBP(bp)
          : isDifferentChemical
            ? undefined
            : c.volatility;
      onChange({
        pubchemCid: r.cid,
        cas: r.cas,
        name: r.name,
        hazardStatements: r.hazardStatements,
        ghsPictograms: r.pictograms,
        wel: {
          twa: r.wel.twa ?? 'n/a',
          stel: r.wel.stel ?? 'n/a',
          source: r.wel.source ?? 'Manual',
        },
        form,
        sdsUrl: r.sdsUrl ?? (isDifferentChemical ? undefined : c.sdsUrl),
        sdsSource: r.sdsSource ?? (isDifferentChemical ? undefined : c.sdsSource),
        boilingPointC: bp,
        volatility: derivedVolatility,
        dustiness: isDifferentChemical ? undefined : c.dustiness,
        pubchemFetchedAt: r.fetchedAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={clsx(
        'rounded-md border bg-white',
        open ? 'border-accent-200 ring-1 ring-accent-100' : 'border-zinc-200',
        incomplete && !open && 'border-red-200 bg-red-50/40',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-zinc-50"
      >
        <span className="text-zinc-400">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {incomplete ? (
          <span
            className="text-red-600 inline-flex items-center gap-1 font-medium text-sm"
            title="Click to add details"
          >
            <AlertCircle size={14} />
            <span className="text-red-700">*</span>
            {c.name.trim() ? c.name : 'New chemical — click to add details'}
          </span>
        ) : (
          <span className="text-sm text-zinc-900 font-medium">{c.name}</span>
        )}

        {c.cas && (
          <span className="text-[11px] text-zinc-500 font-mono">· {c.cas}</span>
        )}

        <div className="flex-1" />

        {c.ghsPictograms.length > 0 && (
          <GhsRow ids={c.ghsPictograms} size={24} />
        )}
        {c.hazardStatements.length > 0 && (
          <span className="pill">{c.hazardStatements.length} H</span>
        )}
        {(c.wel.twa || c.wel.stel) && (
          <span className="pill" title={c.wel.source ? `Source: ${c.wel.source}` : undefined}>
            WEL{c.wel.twa ? ` ${c.wel.twa}` : ''}{c.wel.stel ? ` · STEL ${c.wel.stel}` : ''}
          </span>
        )}
        {c.quantity && <span className="text-[11px] text-zinc-500">· {c.quantity}</span>}
        {c.sdsUrl && (
          <a
            href={c.sdsUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-[11px] text-accent-700 hover:underline"
          >
            SDS <ExternalLink size={10} />
          </a>
        )}

        <button
          type="button"
          className="text-red-500 hover:bg-red-50 p-1 rounded shrink-0"
          onClick={(e) => { e.stopPropagation(); remove(stepId, c.id); }}
          aria-label="Remove chemical"
        >
          <Trash2 size={13} />
        </button>
      </button>

      {open && (() => {
        const miss = {
          name: !c.name.trim(),
          cas: !c.cas?.trim(),
          quantity: !splitQuantity(c.quantity).value,
          wel: !c.wel.twa?.trim() && !c.wel.stel?.trim(),
          duration: !c.exposureDuration.trim(),
          frequency: !c.exposureFrequency.trim(),
          routes: !Object.values(c.exposureRoutes).some(Boolean),
        };
        return (
        <div className="border-t border-zinc-100 px-3 py-2.5 bg-zinc-50/40">
          {error && <div className="text-xs text-red-600 mb-2">{error}</div>}

          <div className="grid grid-cols-2 gap-2.5">
            {/* Q1 — Identity */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Identity</div>
              <div>
                <span className="field-label">Chemical name or CAS<Req /></span>
                <div className="flex gap-1">
                  <ChemicalAutocomplete
                    value={c.name}
                    onChange={(v) => onChange({ name: v })}
                    onSelect={(selection) => {
                      onChange({ name: selection.name });
                      lookup(false, selection.cid ?? selection.name);
                    }}
                    placeholder="e.g. acetone or 67-64-1"
                    disabled={busy}
                    invalid={miss.name}
                  />
                  <button
                    className="btn-secondary !px-2 !py-1.5 shrink-0"
                    disabled={busy}
                    onClick={() => lookup(true)}
                    title={c.pubchemCid ? 'Refresh from PubChem (bypasses cache)' : 'Look up on PubChem'}
                  >
                    <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              <div>
                <span className="field-label">CAS number<Req /></span>
                <input
                  className={clsx('field-input !py-1.5 text-xs font-mono', miss.cas && 'field-missing')}
                  value={c.cas ?? ''}
                  onChange={(e) => onChange({ cas: e.target.value })}
                  placeholder="e.g. 67-64-1"
                />
              </div>
              {c.pubchemCid && (
                <div className="text-[10px] text-zinc-500 flex flex-wrap items-center gap-1.5">
                  <span className="pill !text-[10px] !py-0"><Sparkles size={9} /> CID {c.pubchemCid}</span>
                  {c.pubchemFetchedAt && <span>{c.pubchemFetchedAt.slice(0, 10)}</span>}
                  {c.sdsUrl && (
                    <a href={c.sdsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent-700 hover:underline">
                      SDS{c.sdsSource ? ` (${c.sdsSource})` : ''} <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Q2 — Physical state */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Physical state</div>
              <label>
                <span className="field-label">Form<Req /></span>
                <select
                  className="field-input !py-1.5 text-xs"
                  value={c.form}
                  onChange={(e) => {
                    const nextForm = e.target.value as SubstanceForm;
                    const { value, unit } = splitQuantity(c.quantity);
                    const allowed = UNITS_BY_FORM[nextForm];
                    const nextUnit = allowed.includes(unit) ? unit : defaultUnit(nextForm);
                    onChange({
                      form: nextForm,
                      quantity: joinQuantity(value, nextUnit),
                    });
                  }}
                >
                  {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              {c.form === 'liquid' && (
                <label>
                  <span className="field-label">Volatility <span className="text-zinc-400 font-normal text-[10px]">COSHH</span></span>
                  <select
                    className="field-input !py-1.5 text-xs"
                    value={c.volatility ?? ''}
                    onChange={(e) => onChange({ volatility: (e.target.value || undefined) as Substance['volatility'] })}
                  >
                    <option value="">{typeof c.boilingPointC === 'number' ? `Auto from BP (${formatAutoVolatility(c.boilingPointC)})` : '— select —'}</option>
                    <option value="low">{'Low (>150 °C)'}</option>
                    <option value="medium">Medium (50–150 °C)</option>
                    <option value="high">{'High (<50 °C)'}</option>
                  </select>
                  {typeof c.boilingPointC === 'number' && (
                    <div className="text-[10px] text-zinc-500 mt-0.5">BP ≈ {c.boilingPointC} °C</div>
                  )}
                </label>
              )}
              {(c.form === 'solid' || c.form === 'powder') && (
                <label>
                  <span className="field-label">Dustiness <span className="text-zinc-400 font-normal text-[10px]">COSHH</span></span>
                  <select
                    className="field-input !py-1.5 text-xs"
                    value={c.dustiness ?? ''}
                    onChange={(e) => onChange({ dustiness: (e.target.value || undefined) as Substance['dustiness'] })}
                  >
                    <option value="">— select —</option>
                    <option value="low">Low (pellet / waxy)</option>
                    <option value="medium">Medium (granular)</option>
                    <option value="high">High (fine powder)</option>
                  </select>
                </label>
              )}
              <label>
                <span className="field-label">Quantity<Req /></span>
                <QuantityInput
                  value={c.quantity}
                  form={c.form}
                  onChange={(next) => onChange({ quantity: next })}
                  invalid={miss.quantity}
                />
              </label>
            </div>

            {/* Q3 — WEL */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Workplace exposure limits</div>
              <div className="grid grid-cols-2 gap-1.5">
                <label>
                  <span className="field-label">TWA (8 h)<Req /></span>
                  <input
                    className={clsx('field-input !py-1.5 text-xs', miss.wel && 'field-missing')}
                    value={c.wel.twa ?? ''}
                    onChange={(e) => onChange({ wel: { ...c.wel, twa: e.target.value, source: e.target.value && !c.wel.source ? 'Manual' : c.wel.source } })}
                    placeholder="value or n/a"
                  />
                </label>
                <label>
                  <span className="field-label">STEL (15 min)<Req /></span>
                  <input
                    className={clsx('field-input !py-1.5 text-xs', miss.wel && 'field-missing')}
                    value={c.wel.stel ?? ''}
                    onChange={(e) => onChange({ wel: { ...c.wel, stel: e.target.value, source: e.target.value && !c.wel.source ? 'Manual' : c.wel.source } })}
                    placeholder="value or n/a"
                  />
                </label>
              </div>
              <div className="text-[10px] text-zinc-500">Enter "n/a" if no UK WEL applies.</div>
            </div>

            {/* Q4 — Exposure */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Exposure</div>
              <div>
                <span className="field-label">Routes<Req /></span>
                <div className={clsx('flex flex-wrap gap-1 mt-0.5 rounded-md', miss.routes && 'field-missing p-1')}>
                  {ROUTES.map(({ key, label }) => {
                    const on = c.exposureRoutes[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onChange({ exposureRoutes: { ...c.exposureRoutes, [key]: !on } })}
                        className={
                          'px-2.5 py-0.5 rounded-full text-xs border transition ' +
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
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <label>
                  <span className="field-label">Duration<Req /></span>
                  <input
                    className={clsx('field-input !py-1.5 text-xs', miss.duration && 'field-missing')}
                    value={c.exposureDuration}
                    onChange={(e) => onChange({ exposureDuration: e.target.value })}
                    placeholder="e.g. 30 min"
                  />
                </label>
                <label>
                  <span className="field-label">Frequency<Req /></span>
                  <input
                    className={clsx('field-input !py-1.5 text-xs', miss.frequency && 'field-missing')}
                    value={c.exposureFrequency}
                    onChange={(e) => onChange({ exposureFrequency: e.target.value })}
                    placeholder="e.g. weekly"
                  />
                </label>
              </div>
            </div>
          </div>

          {(c.hazardStatements.length > 0 || c.ghsPictograms.length > 0) && (
            <details className="mt-2 rounded border border-zinc-200 bg-white p-2.5">
              <summary className="cursor-pointer text-xs font-medium text-zinc-700">
                Hazard data ({c.ghsPictograms.length} pictograms · {c.hazardStatements.length} H-codes)
              </summary>
              <div className="mt-2.5 space-y-2.5">
                <GhsGrid ids={c.ghsPictograms} />
                <HCodeList codes={c.hazardStatements} />
              </div>
            </details>
          )}
        </div>
        );
      })()}
    </div>
  );
}

function QuantityInput({
  value,
  form,
  onChange,
  invalid,
}: {
  value: string;
  form: SubstanceForm;
  onChange: (next: string) => void;
  invalid?: boolean;
}) {
  const parsed = splitQuantity(value);
  const allowed = UNITS_BY_FORM[form];
  const unit = parsed.unit && allowed.includes(parsed.unit) ? parsed.unit : defaultUnit(form);
  const customUnit = parsed.unit && !allowed.includes(parsed.unit) ? parsed.unit : null;

  return (
    <div className="flex gap-1">
      <input
        className={clsx('field-input !py-1.5 text-xs flex-1 min-w-0', invalid && 'field-missing')}
        type="text"
        inputMode="decimal"
        value={parsed.value}
        onChange={(e) => onChange(joinQuantity(e.target.value, unit))}
        placeholder="e.g. 500"
      />
      <select
        className="field-input !py-1.5 text-xs !pr-6 w-[5.25rem] shrink-0"
        value={unit}
        onChange={(e) => onChange(joinQuantity(parsed.value, e.target.value))}
      >
        {allowed.map((u) => <option key={u} value={u}>{u}</option>)}
        {customUnit && <option value={customUnit}>{customUnit}</option>}
      </select>
    </div>
  );
}
