const { chromium } = require('playwright');
const crypto = require('node:crypto');

const appUrl = process.env.CAT_APP_URL || 'http://127.0.0.1:5174/';
const out = '/Users/davidkemp/Desktop/CAT/output/playwright';
const uuid = () => crypto.randomUUID();

const chem = (name, cas, quantity, form, hcodes, pictograms, extra = {}) => ({
  id: uuid(),
  name,
  cas,
  quantity,
  form,
  hazardStatements: hcodes.map((code) => ({ code, text: '' })),
  ghsPictograms: pictograms,
  wel: { twa: 'Check EH40/SDS', source: 'Manual-EH40' },
  exposureDuration: 'Up to 30 minutes',
  exposureFrequency: 'Weekly',
  exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
  ...extra,
});

function assessment() {
  const chemicals = [
    chem('Acetone', '67-64-1', '250 mL', 'liquid', ['H225', 'H319', 'H336'], ['flammable', 'harmful'], { volatility: 'high', molecularFormula: 'C3H6O' }),
    chem('Hydrochloric acid', '7647-01-0', '100 mL', 'liquid', ['H290', 'H314', 'H335'], ['corrosive', 'harmful'], { volatility: 'medium', molecularFormula: 'HCl' }),
    chem('Sodium hydroxide', '1310-73-2', '100 g', 'solid', ['H290', 'H314'], ['corrosive'], { dustiness: 'medium', molecularFormula: 'NaOH' }),
    chem('Hydrogen peroxide 30%', '7722-84-1', '50 mL', 'liquid', ['H272', 'H302', 'H318'], ['oxidising', 'corrosive', 'harmful'], { volatility: 'low', molecularFormula: 'H2O2' }),
    chem('Phenol', '108-95-2', '25 g', 'solid', ['H301', 'H311', 'H314', 'H331', 'H341', 'H373'], ['toxic', 'corrosive', 'health-hazard'], { dustiness: 'medium', molecularFormula: 'C6H6O' }),
  ];
  const assignments = {};
  chemicals.forEach((chemical) => {
    assignments[chemical.id] = { confirmed: true };
  });
  const now = new Date().toISOString();
  return {
    schemaVersion: 3,
    id: uuid(),
    overview: {
      businessUnit: 'Research Lab',
      riskAssessmentRef: 'CAT-PREVIEW',
      sopRef: 'SOP-PREVIEW',
      assessor: 'David Kemp',
      dateOfAssessment: '2026-05-31',
      dateOfNextReview: '2027-05-31',
      locations: 'Chemistry prep room',
      activityTitle: 'Report preview verification',
      activityOutline: 'Small-scale preparation and disposal of mixed laboratory chemicals.',
      personsAtRisk: { staff: true, students: true, thirdParty: false, contractors: false, visitors: false, public: false },
    },
    taskHazardsConfirmedNone: false,
    taskHazards: [{
      id: uuid(),
      hazard: 'Glassware breakage during transfer',
      harmMechanism: 'Cuts and secondary chemical release.',
      riskEvaluation: { likelihood: 3, severity: 3 },
      controlsInPlace: 'Use trays and clear bench space.',
      residualRisk: { likelihood: 1, severity: 2 },
      furtherAction: 'Brief staff before task.',
      owner: 'Lab manager',
      dueDate: '2026-06-15',
      completionDate: '',
    }],
    processSteps: [{
      id: uuid(),
      step: 'Prepare and transfer chemicals',
      description: 'Dispense small quantities in a fume hood.',
      chemicals,
      controls: { engineering: ['Fume hood'], ppe: ['Gloves', 'Goggles', 'Lab coat'], other: 'Use secondary containment.' },
    }],
    controls: {
      elimination: 'Remove any chemical not required by the method.',
      substitution: 'Reviewed; no suitable lower hazard substitute identified.',
      reduction: 'Use minimum working quantities.',
      engineering: 'Use fume hood for dispensing and transfer.',
      administrative: 'Only trained authorised personnel may complete the task. Check SDS before work.',
      ppe: { type: 'Chemical resistant gloves, goggles and lab coat.', standard: 'Confirm glove compatibility against SDS.' },
      airMonitoring: 'Review WEL and task conditions.',
      healthSurveillance: 'Review SDS and Occupational Health triggers.',
    },
    additional: {
      cheminventoryLogged: true,
      sdsVersion: '',
      sdsDate: '',
      storage: 'Use assigned storage groups below; keep minimum stock.',
      incompatibles: 'Segregate acids, bases, oxidisers, flammables and toxics unless SDS confirms compatibility.',
      assignments,
    },
    emergency: {
      emergencyFirstAid: 'Use SDS Section 4 as definitive first-aid instruction.',
      emergencySpills: 'Use SDS Section 6 and local spill procedure.',
      emergencyFire: 'Use SDS Section 5; provide SDS to responders.',
      wasteHandling: 'Collect compatible waste streams in labelled closed containers; confirm segregation via SDS.',
      other: 'Confirm eyewash, shower, spill kit and SDS access before starting.',
    },
    briefing: [{ id: uuid(), name: 'Test user', date: '2026-05-31' }],
    meta: { createdAt: now, updatedAt: now, appVersion: '0.2.0' },
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(appUrl);
  await page.evaluate((raw) => {
    localStorage.clear();
    localStorage.setItem('cat.privacyAck', '1');
    localStorage.setItem('cat.testingMode', '1');
    localStorage.setItem('cat.activeAssessment', raw);
  }, JSON.stringify(assessment()));
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('aside button').filter({ hasText: 'Complete & Export' }).click();
  await page.getByRole('button', { name: 'Preview / Save PDF' }).click();
  await page.waitForSelector('.report-preview-print');
  await page.screenshot({ path: `${out}/report-preview-html.png`, fullPage: true });
  await page.evaluate(() => {
    document.getElementById('report-print-root')?.remove();
    const source = document.querySelector('.report-preview-print');
    if (!source) throw new Error('report preview not found');
    const printRoot = document.createElement('div');
    printRoot.id = 'report-print-root';
    printRoot.appendChild(source.cloneNode(true));
    document.body.appendChild(printRoot);
    document.body.classList.add('report-printing');
  });
  await page.pdf({
    path: `${out}/report-preview-print.pdf`,
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
  });
  const facts = await page.evaluate(() => {
    const text = document.querySelector('.report-preview-print')?.textContent || '';
    return {
      processBeforeTaskHazards: text.indexOf('02 Process Steps & Chemicals') > -1 && text.indexOf('03 Task Hazards') > text.indexOf('02 Process Steps & Chemicals'),
      hasMainStorageDetails: /Final storage group|Flammable Cabinet|Corrosives Cabinet|Oxidizers Cabinet|Toxins Cabinet/s.test(text),
      removedLegacyStorageSummary: !/Store flammables and combustibles|Do not store flammables\\/combustibles/i.test(text),
      hasStorageReviewStatus: /Reviewed|Not reviewed/i.test(text),
      hasCoshhSubstanceWording: /substance-level screening/i.test(text),
      hasCoshhExplanationAppendix: /Appendix B.+COSHH Essentials Explanation/s.test(text),
      hasEpAndGroupExplanation: /Hazard group.+Group A.+EP band.+EP1/s.test(text),
      hasMainControlFields: /Elimination \\/ substitution.+Reduction.+Administrative controls.+PPE \\/ monitoring \\/ health/s.test(text),
      omitsUnusedEngineeringField: !/Engineering \\/ administration|Engineering: Use fume hood/i.test(text),
      hasTaskRiskDetail: /Before controls.+After controls/s.test(text),
      ghsImages: document.querySelectorAll('.report-preview-print img[alt]').length,
      pages: document.querySelectorAll('.report-page').length,
      text,
    };
  });
  console.log(JSON.stringify({
    errors,
    savedAs: `${out}/report-preview-print.pdf`,
    facts: { ...facts, text: undefined },
  }, null, 2));
  if (
    errors.length ||
    !facts.processBeforeTaskHazards ||
    !facts.hasMainStorageDetails ||
    !facts.removedLegacyStorageSummary ||
    !facts.hasStorageReviewStatus ||
    !facts.hasCoshhSubstanceWording ||
    !facts.hasCoshhExplanationAppendix ||
    !facts.hasEpAndGroupExplanation ||
    !facts.hasMainControlFields ||
    !facts.omitsUnusedEngineeringField ||
    !facts.hasTaskRiskDetail ||
    facts.ghsImages < 5
  ) {
    process.exit(1);
  }
  await browser.close();
})();
