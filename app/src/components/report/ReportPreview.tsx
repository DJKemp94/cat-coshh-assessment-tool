import { Printer } from 'lucide-react';
import { Assessment, GhsPictogram, RiskScore, riskRating, Substance } from '@/types/assessment';
import { GhsIcon, GHS_LABELS } from '@/components/common/GhsPictograms';
import { suggestControls, APPROACH_LABEL } from '@/services/coshhEssentials';
import { ReportOptions } from '@/services/exporters/reportOptions';
import {
  HAZARD_GROUP_HELP,
  EP_HELP,
  EP_EXPOSURE_TABLE,
  EP_EXPOSURE_TABLE_EXPLANATION,
} from '@/services/exporters/coshhSummary';
import { resolveCameoMatch } from '@/services/cameoStorage';
import {
  classifyStorage20,
  applyStorage20Edit,
  storage20EvidenceText,
  storage20RequirementsText,
  Storage20Assignment,
  ZONES,
  CABINET_ORDER,
  Storage20CabinetId,
  Storage20ZoneId,
} from '@/services/storage20Classifier';

const DASH = '—';

function personsLine(a: Assessment) {
  const labels: Array<[keyof Assessment['overview']['personsAtRisk'], string]> = [
    ['staff', 'Staff'],
    ['students', 'Students'],
    ['thirdParty', 'Third Party'],
    ['contractors', 'Contractors'],
    ['visitors', 'Visitors'],
    ['public', 'Public'],
  ];
  const selected = labels.filter(([key]) => a.overview.personsAtRisk[key]).map(([, label]) => label);
  return selected.length ? selected.join(', ') : DASH;
}

function allChemicals(a: Assessment) {
  const seen = new Set<string>();
  return a.processSteps.flatMap((step) => step.chemicals).filter((chemical) => {
    const key = (chemical.cas?.trim() || chemical.name).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function allChemicalEntries(a: Assessment) {
  return a.processSteps.flatMap((step) => step.chemicals);
}

function uniqueText(values: Array<string | undefined>) {
  const unique = [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
  return unique.length ? unique.join(', ') : DASH;
}

function chemicalDetailRows(a: Assessment) {
  const groups = new Map<string, Substance[]>();
  allChemicalEntries(a).forEach((chemical) => {
    const key = (chemical.cas?.trim() || chemical.name).toLowerCase().trim() || chemical.id;
    groups.set(key, [...(groups.get(key) ?? []), chemical]);
  });
  return [...groups.values()].map((items) => {
    const primary = items[0];
    const hazardStatements = [...new Map(items.flatMap((item) => item.hazardStatements).map((h) => [h.code, h])).values()];
    const pictograms = [...new Set(items.flatMap((item) => item.ghsPictograms))];
    return {
      ...primary,
      hazardStatements,
      ghsPictograms: pictograms,
      formSummary: uniqueText(items.map((item) => item.form)),
      quantitySummary: uniqueText(items.map((item) => item.quantity)),
      welSummary: welSummary(items),
      exposureDuration: uniqueText(items.map((item) => item.exposureDuration)),
      exposureFrequency: uniqueText(items.map((item) => item.exposureFrequency)),
    };
  });
}

function hCodes(c: Substance) {
  return c.hazardStatements.map((h) => h.text ? `${h.code} ${h.text}` : h.code).join('; ') || DASH;
}

function routes(c: Substance) {
  const selected = Object.entries(c.exposureRoutes).filter(([, on]) => on).map(([route]) => route);
  return selected.length ? selected.join(', ') : DASH;
}

function welSummary(chemicals: Substance[]) {
  const twa = uniqueText(chemicals.map((chemical) => chemical.wel.twa));
  const stel = uniqueText(chemicals.map((chemical) => chemical.wel.stel));
  const source = uniqueText(chemicals.map((chemical) => chemical.wel.source));
  return { twa, stel, source };
}

function approachClass(approach: number) {
  return `report-severity-approach-${approach}`;
}

function groupClass(group: string) {
  return `report-severity-group-${group.toLowerCase()}`;
}

function epClass(ep?: string) {
  return ep ? `report-severity-ep-${ep.toLowerCase()}` : '';
}

function chemicalNames(step: Assessment['processSteps'][number]) {
  return step.chemicals.map((chemical) => chemical.name.trim()).filter(Boolean).join(', ') || DASH;
}

function TextBlock({ value }: { value: string }) {
  const lines = value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return <p>{DASH}</p>;
  return (
    <>
      {lines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
    </>
  );
}

function storage20For(a: Assessment, chemical: Substance): Storage20Assignment {
  const match = resolveCameoMatch(chemical, a.storage2.matches[chemical.id]);
  const automatic = classifyStorage20(match);
  return applyStorage20Edit(automatic, a.storage2.assignmentOverrides?.[chemical.id]);
}

const ZONE_COLORS: Record<Storage20ZoneId, string> = {
  organicSolventsAcids: 'border-yellow-300 bg-yellow-100 text-yellow-950',
  volatilePoisonsChlorinated: 'border-sky-300 bg-sky-100 text-sky-950',
  nonOxidizingAcids: 'border-violet-300 bg-violet-100 text-violet-950',
  oxidizingAcids: 'border-red-300 bg-red-100 text-red-950',
  liquidBases: 'border-orange-300 bg-orange-100 text-orange-950',
  solidBases: 'border-orange-300 bg-orange-50 text-orange-950',
  oxidizersOnly: 'border-amber-300 bg-amber-100 text-amber-950',
  dryPoisons: 'border-pink-300 bg-pink-100 text-pink-950',
  liquidPoisons: 'border-pink-300 bg-pink-100 text-pink-950',
  compressedGases: 'border-cyan-300 bg-cyan-100 text-cyan-950',
  drySolids: 'border-emerald-300 bg-emerald-100 text-emerald-950',
  generalStorage: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  specialReview: 'border-red-400 bg-red-100 text-red-950',
  review: 'border-zinc-300 bg-zinc-100 text-zinc-800',
};

function riskText(score: RiskScore) {
  const rating = riskRating(score);
  return `L${score.likelihood} x S${score.severity} = ${rating || DASH}`;
}

function stepGhs(step: Assessment['processSteps'][number]) {
  return [...new Set(step.chemicals.flatMap((chemical) => chemical.ghsPictograms))];
}



function StorageCabinetPreview({ a, chemicals }: { a: Assessment; chemicals: Substance[] }) {
  const assignments = chemicals.map((c) => storage20For(a, c));
  const byCabinet = new Map<Storage20CabinetId, Storage20Assignment[]>();
  for (const asgn of assignments) {
    byCabinet.set(asgn.cabinetId, [...(byCabinet.get(asgn.cabinetId) ?? []), asgn]);
  }
  const populatedCabinets = CABINET_ORDER.filter((id) => (byCabinet.get(id)?.length ?? 0) > 0);
  if (populatedCabinets.length === 0) {
    return <p className="report-muted">No cabinet assignments generated. Add chemicals in Process Steps.</p>;
  }
  return (
    <div className="report-cabinet-grid">
      {populatedCabinets.map((cabinetId) => {
        const cabinetAssignments = byCabinet.get(cabinetId)!;
        const zones = new Map<Storage20ZoneId, Storage20Assignment[]>();
        for (const asgn of cabinetAssignments) {
          zones.set(asgn.zoneId, [...(zones.get(asgn.zoneId) ?? []), asgn]);
        }
        const cabinetTitle = ZONES[cabinetAssignments[0]?.zoneId]?.cabinetTitle ?? (cabinetId === 'review' ? 'Review SDS' : '');
        return (
          <div key={cabinetId} className="report-cabinet-card">
            <div className="report-cabinet-head">{cabinetTitle}</div>
            <div className="report-cabinet-body">
              {[...zones.entries()].map(([zoneId, zoneAssignments]) => {
                const zone = ZONES[zoneId];
                if (!zone) return null;
                return (
                  <div key={zoneId} className={`report-cabinet-zone ${ZONE_COLORS[zoneId]}`}>
                    <div className="report-cabinet-zone-title">{zone.zoneTitle}</div>
                    <div className="report-cabinet-zone-note">{zone.note}</div>
                    <div className="report-cabinet-chemicals">
                      {zoneAssignments.map((asgn) => (
                        <div key={asgn.match.chemical.id} className="report-cabinet-chemical">
                          {asgn.match.chemical.name || asgn.match.chemical.cas || 'Unnamed'}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTab({ n, title }: { n: string | number; title: string }) {
  return (
    <div className="report-tab">
      {String(n).padStart(2, '0')} {title}
    </div>
  );
}

function InfoGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="report-info-grid">
      {rows.map(([label, value]) => (
        <div key={label} className="report-kv">
          <div className="report-kv-label">{label}</div>
          <div className="report-kv-value">{value || DASH}</div>
        </div>
      ))}
    </div>
  );
}

function GhsIcons({ ids }: { ids: GhsPictogram[] }) {
  if (ids.length === 0) return <span>{DASH}</span>;
  return (
    <div className="report-ghs-row">
      {ids.map((id) => <GhsIcon key={id} id={id} size={22} />)}
    </div>
  );
}

function GhsLegend({ chemicals }: { chemicals: Substance[] }) {
  const ids = [...new Set(chemicals.flatMap((chemical) => chemical.ghsPictograms))];
  if (ids.length === 0) return null;
  return (
    <div className="report-ghs-legend">
      <div className="report-ghs-legend-title">GHS symbol key</div>
      <div className="report-ghs-legend-grid">
        {ids.map((id) => (
          <div key={id} className="report-ghs-legend-item">
            <GhsIcon id={id} size={20} />
            <span>{GHS_LABELS[id]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportPreview({ assessment, options }: { assessment: Assessment; options: ReportOptions }) {
  const chemicals = allChemicals(assessment);
  const chemicalDetails = chemicalDetailRows(assessment);
  const coshh = suggestControls(chemicals);
  const generated = new Date().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  let sectionNo = 1;
  const printReport = () => {
    const source = document.querySelector('.report-preview-print');
    if (!source) {
      window.print();
      return;
    }
    document.getElementById('report-print-root')?.remove();
    const printRoot = document.createElement('div');
    printRoot.id = 'report-print-root';
    printRoot.appendChild(source.cloneNode(true));
    document.body.appendChild(printRoot);
    document.body.classList.add('report-printing');
    const cleanup = () => {
      document.body.classList.remove('report-printing');
      printRoot.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    window.setTimeout(cleanup, 1000);
  };

  return (
    <div>
      <div className="report-preview-actions no-print">
        <button type="button" className="btn-primary" onClick={printReport}>
          <Printer size={16} />
          Print / Save PDF
        </button>
      </div>

      <article className="report-preview-print report-doc">
        <section className="report-page">
          <header className="report-cover">
            <div>
              <div className="report-eyebrow">COSHH RISK ASSESSMENT</div>
              <h1>{assessment.overview.activityOutline || 'Untitled assessment'}</h1>
              <div className="report-business">{assessment.overview.businessUnit || 'Business unit not set'}</div>
            </div>
            <div className="report-meta-strip">
              <InfoGrid rows={[
                ['Ref', assessment.overview.riskAssessmentRef],
                ['Assessor', assessment.overview.assessor],
                ['Assessed', assessment.overview.dateOfAssessment],
                ['Next review', assessment.overview.dateOfNextReview],
              ]} />
              <div className="report-generated">Generated {generated} with CAT — COSHH Assessment Tool</div>
            </div>
          </header>

          {options.overview.include && (
            <section className="report-block">
              <SectionTab n={sectionNo++} title="Overview" />
              <div className="report-panel">
                {options.overview.details && (
                  <InfoGrid rows={[
                    ['Business Unit', assessment.overview.businessUnit],
                    ['Location', assessment.overview.locations],
                    ['Risk Assessor', assessment.overview.assessor],
                    ['SOP Ref number(s)', assessment.overview.sopRef],
                    ['Date of Assessment', assessment.overview.dateOfAssessment],
                    ['Date of Review', assessment.overview.dateOfNextReview],
                    ['Persons at Risk', personsLine(assessment)],
                  ]} />
                )}
                {options.overview.activityOutline && (
                  <div className="report-kv report-kv-wide">
                    <div className="report-kv-label">RA Title</div>
                    <div className="report-kv-value">{assessment.overview.activityOutline || DASH}</div>
                  </div>
                )}
              </div>
            </section>
          )}

          {options.process.include && (
            <section className="report-block">
              <SectionTab n={sectionNo++} title="Process Steps & Chemicals" />
              <div className="report-panel">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>Activity</th>
                      <th>Chemicals</th>
                      <th>GHS summary</th>
                      {options.process.stepControls && <th>Engineering</th>}
                      {options.process.stepControls && <th>PPE</th>}
                      {options.process.stepControls && <th>Other controls</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.processSteps.map((step, index) => (
                      <tr key={step.id}>
                        <td>Step {index + 1}</td>
                        <td><strong>{step.step || DASH}</strong><div>{step.description || DASH}</div></td>
                        <td>{chemicalNames(step)}</td>
                        <td><GhsIcons ids={stepGhs(step)} /></td>
                        {options.process.stepControls && <td>{step.controls.engineering.join(', ') || DASH}</td>}
                        {options.process.stepControls && <td>{step.controls.ppe.join(', ') || DASH}</td>}
                        {options.process.stepControls && <td>{step.controls.other || DASH}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <GhsLegend chemicals={chemicals} />
                {options.process.chemicalDetails && chemicalDetails.length > 0 && (
                  <div className="report-note">
                    See <a href="#appendix-a" className="underline hover:text-blue-700">Appendix A — Chemical Detail</a> for full hazard statements, WELs, and exposure information per chemical.
                  </div>
                )}
              </div>
            </section>
          )}

          {options.taskHazards.include && (
            <section className="report-block">
              <SectionTab n={sectionNo++} title="Task Hazards" />
              <div className="report-panel report-panel-amber">
                {assessment.taskHazards.length === 0 ? (
                  <div className="report-empty">No non-chemical hazards recorded.</div>
                ) : (
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Hazard</th>
                        <th>How harm occurs</th>
                        {options.taskHazards.riskDetails && <th>Before controls</th>}
                        <th>Controls in place</th>
                        {options.taskHazards.riskDetails && <th>After controls</th>}
                        {options.taskHazards.actions && <th>Further action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {assessment.taskHazards.map((hazard) => (
                        <tr key={hazard.id}>
                          <td><strong>{hazard.hazard || DASH}</strong></td>
                          <td>{hazard.harmMechanism || DASH}</td>
                          {options.taskHazards.riskDetails && <td><span className="report-risk-chip">{riskText(hazard.riskEvaluation)}</span></td>}
                          <td>{hazard.controlsInPlace || DASH}</td>
                          {options.taskHazards.riskDetails && <td><span className="report-risk-chip report-risk-chip-residual">{riskText(hazard.residualRisk)}</span></td>}
                          {options.taskHazards.actions && <td>{hazard.furtherAction || DASH}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}

          {options.controls.include && (
            <section className="report-block">
              <SectionTab n={sectionNo++} title="Controls" />
              <div className="report-card-stack">
                {options.controls.hierarchy && (
                  <>
                    <div className="report-mini-card report-purple">
                      <h3>Elimination / substitution</h3>
                      <TextBlock value={assessment.controls.elimination || DASH} />
                    </div>
                    <div className="report-mini-card report-blue">
                      <h3>Reduction</h3>
                      <TextBlock value={assessment.controls.reduction || DASH} />
                    </div>
                    <div className="report-mini-card report-teal">
                      <h3>Administrative controls</h3>
                      <TextBlock value={assessment.controls.administrative || DASH} />
                    </div>
                    <div className="report-mini-card report-amber">
                      <h3>Monitoring / health</h3>
                      <p><strong>Air monitoring:</strong></p>
                      <TextBlock value={assessment.controls.airMonitoring || DASH} />
                      <p><strong>Health surveillance:</strong></p>
                      <TextBlock value={assessment.controls.healthSurveillance || DASH} />
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </section>

        <section className="report-page">
          {options.storage.include && (
            <section className="report-block">
              <SectionTab n={sectionNo++} title="Storage" />
              <div className="report-panel">
                {chemicals.length > 0 && <StorageCabinetPreview a={assessment} chemicals={chemicals} />}
              </div>
            </section>
          )}

          {options.emergency.include && (
            <section className="report-block">
              <SectionTab n={sectionNo++} title="Emergency Response and Waste" />
              <div className="report-panel">
                <table className="report-table">
                  <tbody>
                    {options.emergency.spills && <tr><th>Spills</th><td><TextBlock value={assessment.emergency.emergencySpills || DASH} /></td></tr>}
                    {options.emergency.firstAid && <tr><th>First aid</th><td><TextBlock value={assessment.emergency.emergencyFirstAid || DASH} /></td></tr>}
                    {options.emergency.fire && <tr><th>Fire</th><td><TextBlock value={assessment.emergency.emergencyFire || DASH} /></td></tr>}
                    {options.emergency.waste && <tr><th>Waste handling</th><td><TextBlock value={assessment.emergency.wasteHandling || DASH} /></td></tr>}
                    {options.emergency.other && <tr><th>Other</th><td><TextBlock value={assessment.emergency.other || DASH} /></td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {options.briefing.include && (
            <section className="report-block">
              <SectionTab n={sectionNo++} title="Briefing & Sign-off" />
              <div className="report-panel">
                <table className="report-table report-table-compact">
                  <thead><tr><th>Name</th><th>Date</th><th>Signature</th></tr></thead>
                  <tbody>
                    {assessment.briefing.length === 0 ? (
                      <tr><td colSpan={3}>No briefing entries recorded.</td></tr>
                    ) : assessment.briefing.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.name || '(unsigned)'}</td>
                        <td>{entry.date || DASH}</td>
                        <td>{options.briefing.signatures && entry.signaturePng ? <img className="report-signature" src={entry.signaturePng} alt="" /> : DASH}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>

        {options.process.include && options.process.chemicalDetails && chemicalDetails.length > 0 && (
          <section className="report-page" id="appendix-a">
            <SectionTab n="A1" title="Appendix A — Chemical Detail" />
            <table className="report-table report-table-dense">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Chemical</th>
                  <th>Form / qty</th>
                  <th>Hazard statements</th>
                  <th>WEL</th>
                  <th>Storage</th>
                  <th>Exposure</th>
                  {options.process.ghsPictograms && <th>GHS</th>}
                </tr>
              </thead>
              <tbody>
                {chemicalDetails.map((chemical, index) => (
                  <tr key={chemical.id}>
                    <td>{index + 1}</td>
                    <td><strong>{chemical.name || DASH}</strong><div>CAS {chemical.cas || DASH}</div></td>
                    <td><strong>Forms:</strong> {chemical.formSummary}<div><strong>Mass/volume range:</strong> {chemical.quantitySummary}</div></td>
                    <td>{hCodes(chemical)}</td>
                    <td>
                      <div><strong>TWA:</strong> {chemical.welSummary.twa}</div>
                      <div><strong>STEL:</strong> {chemical.welSummary.stel}</div>
                      <div><strong>Source:</strong> {chemical.welSummary.source}</div>
                    </td>
                    <td>
                      {(() => {
                        const assignment = storage20For(assessment, chemical);
                        return (
                          <>
                            <strong>{ZONES[assignment.zoneId]?.zoneTitle ?? assignment.zoneId}</strong>
                            <div>{storage20RequirementsText(assignment)}</div>
                            <div className="report-muted">{storage20EvidenceText(assignment)}</div>
                          </>
                        );
                      })()}
                    </td>
                    <td>{chemical.exposureDuration || DASH}<div>{chemical.exposureFrequency || DASH}</div><div>{routes(chemical)}</div></td>
                    {options.process.ghsPictograms && <td><GhsIcons ids={chemical.ghsPictograms} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {options.controls.include && options.controls.coshhScreening && coshh && (
          <section className="report-page">
            <SectionTab n="B1" title="Appendix B — COSHH Essentials Explanation & Screening" />
            <div className="report-note report-note-top">
              COSHH Essentials is an HSE control-banding screen. CAT presents it as substance-level screening: it estimates a control approach for each substance from health hazard group, quantity scale, and volatility or dustiness. It is not a legal approval by itself: a competent assessor must confirm the output against SDS information, exposure route, quantity, duration, WELs and local conditions.
            </div>
            <div className="report-table-heading">Guidance: COSHH Essentials reference tables</div>
            <table className="report-table report-table-compact report-mb">
              <tbody>
                <tr className={approachClass(1)}><th>Approach 1</th><td>General ventilation and good practice may be sufficient only when confirmed by a competent assessor for the actual task.</td></tr>
                <tr className={approachClass(2)}><th>Approach 2</th><td>Engineering control is indicated, normally LEV or equivalent capture/control.</td></tr>
                <tr className={approachClass(3)}><th>Approach 3</th><td>Containment or enclosure is indicated where small breaches may occur.</td></tr>
                <tr className={approachClass(4)}><th>Approach 4</th><td>Specialist advice is required; do not rely on the banded screening alone.</td></tr>
              </tbody>
            </table>
            <div className="report-two-col report-mb">
              <table className="report-table report-table-compact">
                <thead><tr><th>Hazard group</th><th>Meaning</th></tr></thead>
                <tbody>
                  {HAZARD_GROUP_HELP.map(([group, meaning]) => (
                    <tr key={group} className={groupClass(group)}><th>Group {group}</th><td>{meaning}</td></tr>
                  ))}
                </tbody>
              </table>
              <table className="report-table report-table-compact">
                <thead><tr><th>EP band</th><th>Meaning</th></tr></thead>
                <tbody>
                  {EP_HELP.map(([ep, meaning]) => (
                    <tr key={ep} className={epClass(ep)}><th>{ep}</th><td>{meaning}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="report-table-heading">Predicted exposure ranges by EP band and control approach</div>
            <div className="report-note report-mb">
              {EP_EXPOSURE_TABLE_EXPLANATION}
            </div>
            {EP_EXPOSURE_TABLE.map((section) => (
              <table key={section.title} className="report-table report-table-compact report-mb">
                <thead>
                  <tr><th colSpan={4}>{section.title}</th></tr>
                  <tr><th>EP band</th><th>Control approach 1</th><th>Control approach 2</th><th>Control approach 3</th></tr>
                </thead>
                <tbody>
                  {section.rows.map(([ep, a1, a2, a3]) => (
                    <tr key={ep}><th>{ep}</th><td>{a1}</td><td>{a2}</td><td>{a3}</td></tr>
                  ))}
                </tbody>
              </table>
            ))}
            <div className="report-table-heading">Recommendations: substance-level screening output</div>
            <div className="report-note report-mb">
              The table below is CAT's substance-level COSHH Essentials screening result for this assessment. The highest approach across the substances drives the suggested control approach, but the assessor must still confirm suitable task-specific controls.
            </div>
            <table className="report-table report-table-dense">
              <thead><tr><th>Substance</th><th>Group</th><th>H-codes</th><th>Scale</th><th>Band</th><th>EP</th><th>Approach</th></tr></thead>
              <tbody>
                {coshh.analyses.map((analysis) => (
                  <tr key={analysis.substanceId} className={`report-recommendation-row ${approachClass(analysis.approach)}`}>
                    <td><strong>{analysis.name}</strong></td>
                    <td className={groupClass(analysis.hazardGroup)}>{analysis.hazardGroup}</td>
                    <td>{analysis.drivingHCodes.join(', ') || DASH}</td>
                    <td>{analysis.scale}</td>
                    <td>{analysis.bandKind === 'not-applicable' ? DASH : `${analysis.band} (${analysis.bandKind})`}</td>
                    <td className={epClass(analysis.exposurePredictor)}>{analysis.exposurePredictor || DASH}</td>
                    <td className={approachClass(analysis.approach)}><strong>{APPROACH_LABEL(analysis.approach)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </article>
    </div>
  );
}
