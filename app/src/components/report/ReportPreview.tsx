import { Printer } from 'lucide-react';
import { Assessment, GhsPictogram, RiskScore, riskRating, Substance } from '@/types/assessment';
import { GhsIcon, GHS_LABELS } from '@/components/common/GhsPictograms';
import { suggestControls, APPROACH_LABEL } from '@/services/coshhEssentials';
import { classifyStorage, StorageGroupId } from '@/services/storageClassifier';
import { ReportOptions } from '@/services/exporters/reportOptions';
import { HAZARD_GROUP_HELP, EP_HELP } from '@/services/exporters/coshhSummary';

const DASH = '—';

const STORAGE_LABELS: Record<StorageGroupId, string> = {
  '1': 'Flammable Cabinet',
  '2a': 'Corrosives Cabinet (Acids)',
  '2b': 'Organic Acids Cabinet',
  '3': 'Corrosives Cabinet (Bases)',
  '4': 'Oxidizers Cabinet',
  '5a': 'Toxins Cabinet - inorganic',
  '5b': 'Toxins Cabinet - organic',
  '5c': 'Locked Poisons Cabinet',
  '6': 'Reactive Materials Cabinet',
};

const STORAGE_GUIDANCE: Record<StorageGroupId, string> = {
  '1': 'Keep away from heat, sparks, ignition sources and oxidizers.',
  '2a': 'Store acids separately from bases, cyanides, sulphides and oxidizers.',
  '2b': 'Store organic acids separately from bases and oxidizers unless the SDS confirms compatibility.',
  '3': 'Store bases separately from acids and oxidizers.',
  '4': 'Keep away from organic materials, flammables, acids and reducing agents.',
  '5a': 'Store securely with restricted access and compatible secondary containment.',
  '5b': 'Store securely with restricted access. Keep liquids below solids where practicable.',
  '5c': 'Store in locked storage with access restricted to authorised users.',
  '6': 'Keep dry, tightly closed, and away from water, acids and incompatible materials.',
};

const STORAGE_INCOMPATIBLES: Record<StorageGroupId, string> = {
  '1': 'Oxidizers, strong acids/bases, inorganic toxins and reactive materials unless SDS confirms compatibility.',
  '2a': 'Bases, cyanides, sulphides, flammables, organic acids and reactive materials unless SDS confirms compatibility.',
  '2b': 'Bases, oxidizers, mineral acids, toxins and reactive materials unless SDS confirms compatibility.',
  '3': 'Acids, flammables, organic toxins and reactive materials unless SDS confirms compatibility.',
  '4': 'Flammables, organic materials, organic acids, organic toxins and reactive materials unless SDS confirms compatibility.',
  '5a': 'Flammables, acids, organic acids, organic toxins and reactive materials unless SDS confirms compatibility.',
  '5b': 'Acids, bases, oxidizers, inorganic toxins and reactive materials unless SDS confirms compatibility.',
  '5c': 'Store separately and securely unless SDS/local poison controls confirm compatibility.',
  '6': 'Water, acids, oxidizers and incompatible aqueous waste streams unless SDS confirms compatibility.',
};

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

function storageAssignment(a: Assessment, chemical: Substance) {
  const classification = classifyStorage(chemical);
  const edit = a.additional.assignments?.[chemical.id];
  const override = edit?.groupOverride;
  const groupId = override && override !== 'general' && override !== 'review'
    ? override
    : classification.groupId;
  return {
    finalGroup: override === 'general'
      ? 'General shelving / non-hazardous item'
      : override === 'review' || !groupId
        ? 'Review SDS sections 7 and 10'
        : STORAGE_LABELS[groupId],
    suggestedGroup: classification.groupId ? STORAGE_LABELS[classification.groupId] : 'Review required',
    hazards: classification.primaryHazards.join(', ') || classification.hCodes.join(', ') || DASH,
    guidance: edit?.guidance ?? (groupId ? STORAGE_GUIDANCE[groupId] : 'Check SDS sections 7 and 10 before assigning storage.'),
    segregation: edit?.alert ?? (groupId ? STORAGE_INCOMPATIBLES[groupId] : 'Check SDS sections 7 and 10.'),
    reason: override ? 'Assessor override. Verify against SDS sections 7 and 10.' : classification.reason,
    confirmed: edit?.confirmed === true,
  };
}

function riskText(score: RiskScore) {
  const rating = riskRating(score);
  return `L${score.likelihood} x S${score.severity} = ${rating || DASH}`;
}

function stepGhs(step: Assessment['processSteps'][number]) {
  return [...new Set(step.chemicals.flatMap((chemical) => chemical.ghsPictograms))];
}

function storageTone(group: string) {
  if (/flammable/i.test(group)) return 'report-storage-flammable';
  if (/acid|base|corrosive/i.test(group)) return 'report-storage-corrosive';
  if (/oxid/i.test(group)) return 'report-storage-oxidiser';
  if (/toxin|poison/i.test(group)) return 'report-storage-toxic';
  if (/reactive/i.test(group)) return 'report-storage-reactive';
  return 'report-storage-review';
}

function StorageStatus({ confirmed }: { confirmed: boolean }) {
  return (
    <span className={confirmed ? 'report-status-ok' : 'report-status-review'}>
      {confirmed ? 'Reviewed' : 'Not reviewed'}
    </span>
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
              <h1>{assessment.overview.activityTitle || 'Untitled assessment'}</h1>
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
                    <div className="report-kv-label">Activity Outline</div>
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
                <div className="report-note">Per-chemical storage assignments from the Storage page. Confirm each row against SDS sections 7 and 10 and local storage rules.</div>
                <GhsLegend chemicals={chemicals} />
                {chemicals.length > 0 && (
                  <table className="report-table report-table-dense report-storage-table">
                    <thead>
                      <tr>
                        <th>Chemical</th>
                        <th>Final storage group</th>
                        <th>Suggested group</th>
                        <th>GHS</th>
                        <th>Segregation alert</th>
                        <th>Reviewed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chemicals.map((chemical) => {
                        const storage = storageAssignment(assessment, chemical);
                        return (
                          <tr key={chemical.id}>
                            <td><strong>{chemical.name || DASH}</strong><div>CAS {chemical.cas || DASH}</div></td>
                            <td><span className={`report-storage-pill ${storageTone(storage.finalGroup)}`}>{storage.finalGroup}</span></td>
                            <td>{storage.suggestedGroup}</td>
                            <td><GhsIcons ids={chemical.ghsPictograms} /></td>
                            <td>{storage.segregation}</td>
                            <td><StorageStatus confirmed={storage.confirmed} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
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
          <section className="report-page">
            <SectionTab n="A1" title="Appendix A — Chemical Detail" />
            <table className="report-table report-table-dense">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Chemical</th>
                  <th>Form / qty</th>
                  <th>Hazard statements</th>
                  <th>WEL</th>
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
            <div className="report-table-heading">Substance-level COSHH Essentials screening recommendations</div>
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
