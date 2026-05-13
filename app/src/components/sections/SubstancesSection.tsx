import {
  Plus, Trash2, RefreshCw, ChevronDown, ChevronRight, ExternalLink, Sparkles,
  AlertCircle, FlaskConical, Wand2, Loader2,
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
        wel: r.wel,
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
            No chemicals added yet. Use “Add chemical” or, if you've described the step above, try
            “Suggest”.
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

  const lookup = async (force = false, override?: string) => {
    const query = (override ?? c.name).trim();
    if (!query) { setError('Enter a chemical name first.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await lookupChemical(query, { force });
      const form = r.form ?? c.form;
      const bp = r.boilingPointC ?? c.boilingPointC;
      // On a fresh lookup, set volatility from BP for liquids — user can still
      // override afterwards. This keeps the dropdown in sync with the BP shown.
      const derivedVolatility =
        form === 'liquid' && typeof bp === 'number'
          ? volatilityFromBP(bp)
          : c.volatility;
      onChange({
        pubchemCid: r.cid,
        cas: r.cas,
        name: r.name,
        hazardStatements: r.hazardStatements,
        ghsPictograms: r.pictograms,
        wel: {
          ...c.wel,
          twa: r.wel.twa ?? c.wel.twa,
          stel: r.wel.stel ?? c.wel.stel,
          source: r.wel.source ?? c.wel.source,
        },
        form,
        sdsUrl: r.sdsUrl ?? c.sdsUrl,
        sdsSource: r.sdsSource ?? c.sdsSource,
        boilingPointC: bp,
        volatility: derivedVolatility,
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

      {open && (
        <div className="border-t border-zinc-100 p-4 bg-zinc-50/40 space-y-4">
          {/* Identity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <span className="field-label">Chemical name or CAS<Req /></span>
              <div className="flex gap-2">
                <ChemicalAutocomplete
                  value={c.name}
                  onChange={(v) => onChange({ name: v })}
                  onSelect={(name) => { onChange({ name }); lookup(false, name); }}
                  placeholder="e.g. acetone or 67-64-1"
                  disabled={busy}
                />
                <button
                  className="btn-secondary !px-2 !py-2 shrink-0"
                  disabled={busy}
                  onClick={() => lookup(true)}
                  title={c.pubchemCid ? 'Refresh from PubChem (bypasses cache)' : 'Look up on PubChem'}
                >
                  <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <div>
              <span className="field-label">CAS number<Req /></span>
              <input
                className="field-input font-mono"
                value={c.cas ?? ''}
                onChange={(e) => onChange({ cas: e.target.value })}
                placeholder="e.g. 67-64-1"
              />
            </div>
          </div>

          {c.pubchemCid && (
            <div className="text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
              <span className="pill"><Sparkles size={10} /> CID {c.pubchemCid}</span>
              {c.pubchemFetchedAt && <span>Fetched {c.pubchemFetchedAt.slice(0, 10)}</span>}
              {c.sdsUrl && (
                <a href={c.sdsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-700 hover:underline">
                  Open latest SDS{c.sdsSource ? ` (${c.sdsSource})` : ''} <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}
          {error && <div className="text-xs text-red-600">{error}</div>}

          {/* Amount & physical state */}
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
              Amount &amp; physical state
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label>
                <span className="field-label">Form<Req /></span>
                <select
                  className="field-input !py-1.5 text-xs"
                  value={c.form}
                  onChange={(e) => onChange({ form: e.target.value as SubstanceForm })}
                >
                  {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              {(c.form === 'liquid') && (
                <label>
                  <span className="field-label">
                    Volatility
                    <span className="ml-1 text-[10px] font-normal text-zinc-400">COSHH Essentials</span>
                  </span>
                  <select
                    className="field-input !py-1.5 text-xs"
                    value={c.volatility ?? ''}
                    onChange={(e) => onChange({ volatility: (e.target.value || undefined) as Substance['volatility'] })}
                  >
                    <option value="">{typeof c.boilingPointC === 'number' ? `Auto from BP (${formatAutoVolatility(c.boilingPointC)})` : '— select —'}</option>
                    <option value="low">Low (BP &gt; 150 °C)</option>
                    <option value="medium">Medium (BP 50–150 °C)</option>
                    <option value="high">High (BP &lt; 50 °C)</option>
                  </select>
                  {typeof c.boilingPointC === 'number' && (
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      PubChem BP ≈ {c.boilingPointC} °C
                    </div>
                  )}
                </label>
              )}
              {(c.form === 'solid' || c.form === 'powder') && (
                <label>
                  <span className="field-label">
                    Dustiness
                    <span className="ml-1 text-[10px] font-normal text-zinc-400">COSHH Essentials</span>
                  </span>
                  <select
                    className="field-input !py-1.5 text-xs"
                    value={c.dustiness ?? ''}
                    onChange={(e) => onChange({ dustiness: (e.target.value || undefined) as Substance['dustiness'] })}
                  >
                    <option value="">— select —</option>
                    <option value="low">Low (pellet / waxy / non-friable)</option>
                    <option value="medium">Medium (granular / crystalline)</option>
                    <option value="high">High (fine powder / settles slowly)</option>
                  </select>
                </label>
              )}
              <label>
                <span className="field-label">Quantity<Req /></span>
                <input
                  className="field-input !py-1.5 text-xs"
                  value={c.quantity}
                  onChange={(e) => onChange({ quantity: e.target.value })}
                  placeholder="e.g. 500 mL"
                />
              </label>
            </div>
          </div>

          {/* Workplace Exposure Limits */}
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
              Workplace exposure limits
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="field-label">TWA (8 h)<Req /></span>
                <input
                  className="field-input !py-1.5 text-xs"
                  value={c.wel.twa ?? ''}
                  onChange={(e) => onChange({ wel: { ...c.wel, twa: e.target.value, source: e.target.value && !c.wel.source ? 'Manual' : c.wel.source } })}
                  placeholder="value or n/a"
                />
              </label>
              <label>
                <span className="field-label">STEL (15 min)<Req /></span>
                <input
                  className="field-input !py-1.5 text-xs"
                  value={c.wel.stel ?? ''}
                  onChange={(e) => onChange({ wel: { ...c.wel, stel: e.target.value, source: e.target.value && !c.wel.source ? 'Manual' : c.wel.source } })}
                  placeholder="value or n/a"
                />
              </label>
            </div>
            <div className="text-[11px] text-zinc-500 mt-1">
              If no UK WEL applies, enter “n/a” to acknowledge the field. TWA or STEL must be filled.
            </div>
          </div>

          {/* Exposure — always visible */}
          <div className="rounded-md border border-zinc-200 bg-white p-3 space-y-3">
            <div className="text-xs font-medium text-zinc-700">Exposure routes &amp; duration</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <span className="field-label">Length of exposure<Req /></span>
                <input
                  className="field-input"
                  value={c.exposureDuration}
                  onChange={(e) => onChange({ exposureDuration: e.target.value })}
                  placeholder="e.g. up to 30 min"
                />
              </label>
              <label>
                <span className="field-label">Frequency of exposure<Req /></span>
                <input
                  className="field-input"
                  value={c.exposureFrequency}
                  onChange={(e) => onChange({ exposureFrequency: e.target.value })}
                  placeholder="e.g. weekly"
                />
              </label>
            </div>
            <div>
              <span className="field-label">Exposure routes<Req /></span>
              <div className="flex flex-wrap gap-2">
                {ROUTES.map(({ key, label }) => {
                  const on = c.exposureRoutes[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onChange({ exposureRoutes: { ...c.exposureRoutes, [key]: !on } })}
                      className={
                        'px-3 py-1 rounded-full text-xs border transition ' +
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
              <div className="text-[11px] text-zinc-500 mt-1">Select at least one route.</div>
            </div>
          </div>

          {/* Hazard data — moved to bottom, kept collapsible */}
          {(c.hazardStatements.length > 0 || c.ghsPictograms.length > 0) && (
            <details className="rounded-md border border-zinc-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-medium text-zinc-700">
                Hazard data ({c.ghsPictograms.length} pictograms · {c.hazardStatements.length} H-codes)
              </summary>
              <div className="mt-3 space-y-3">
                <GhsGrid ids={c.ghsPictograms} />
                <HCodeList codes={c.hazardStatements} />
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
