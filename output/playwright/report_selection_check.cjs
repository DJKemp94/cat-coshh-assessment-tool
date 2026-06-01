const { chromium } = require('playwright');
const crypto = require('node:crypto');

const appUrl = process.env.CAT_APP_URL || 'http://127.0.0.1:5173/';
const out = '/Users/davidkemp/Desktop/CAT/output/playwright';
const uuid = () => crypto.randomUUID();

function assessment() {
  const chemicalId = uuid();
  const now = new Date().toISOString();
  return {
    schemaVersion: 3,
    id: uuid(),
    overview: {
      businessUnit: 'Research Lab',
      riskAssessmentRef: 'CAT-REPORT',
      sopRef: 'SOP-REPORT',
      assessor: 'David Kemp',
      dateOfAssessment: '2026-05-31',
      dateOfNextReview: '2027-05-31',
      locations: 'Chemistry prep room',
      activityTitle: 'Report selection check',
      activityOutline: 'Check report section selection.',
      personsAtRisk: { staff: true, students: false, thirdParty: false, contractors: false, visitors: false, public: false },
    },
    taskHazardsConfirmedNone: true,
    taskHazards: [],
    processSteps: [{
      id: uuid(),
      step: 'Handle acetone',
      description: 'Measure a small quantity of acetone in a fume hood.',
      chemicals: [{
        id: chemicalId,
        name: 'Acetone',
        cas: '67-64-1',
        hazardStatements: [{ code: 'H225', text: '' }, { code: 'H319', text: '' }, { code: 'H336', text: '' }],
        ghsPictograms: ['flammable', 'harmful'],
        wel: { twa: 'Check EH40/SDS', source: 'Manual-EH40' },
        quantity: '50 mL',
        form: 'liquid',
        exposureDuration: '10 minutes',
        exposureFrequency: 'Weekly',
        exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
        volatility: 'high',
      }],
      controls: { engineering: ['Fume hood'], ppe: ['Gloves', 'Goggles'], other: 'Use secondary containment.' },
    }],
    controls: {
      elimination: 'Elimination/substitution reviewed; acetone required by method.',
      substitution: '',
      reduction: 'Use minimum working quantity.',
      engineering: 'Use fume hood.',
      administrative: 'Only trained personnel may complete the task.',
      ppe: { type: 'Chemical gloves and goggles.', standard: 'Confirm glove compatibility against SDS.' },
      airMonitoring: 'Review WEL and controls.',
      healthSurveillance: 'Review SDS and OH triggers.',
    },
    additional: {
      cheminventoryLogged: true,
      sdsVersion: '',
      sdsDate: '',
      storage: 'Store in flammable storage.',
      incompatibles: 'Keep away from oxidisers.',
      assignments: { [chemicalId]: { confirmed: true } },
    },
    emergency: {
      emergencyFirstAid: 'Use SDS Section 4.',
      emergencySpills: 'Use SDS Section 6.',
      emergencyFire: 'Use SDS Section 5.',
      wasteHandling: 'Collect flammable solvent waste separately.',
      other: 'Report incidents.',
    },
    briefing: [{ id: uuid(), name: 'Test user', date: '2026-05-31' }],
    meta: { createdAt: now, updatedAt: now, appVersion: '0.2.0' },
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(appUrl);
  await page.evaluate((raw) => {
    localStorage.clear();
    localStorage.setItem('cat.privacyAck', '1');
    localStorage.setItem('cat.activeAssessment', raw);
  }, JSON.stringify(assessment()));
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('aside button').filter({ hasText: 'Complete & Export' }).click();

  for (const label of ['Non-Chemical Hazards', 'COSHH screening', 'Waste handling']) {
    await page.getByLabel(label, { exact: true }).uncheck();
  }
  await page.screenshot({ path: `${out}/report-selection-options.png`, fullPage: true });

  const pdfDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PDF' }).click();
  const pdfDownload = await pdfDownloadPromise;
  const pdfTarget = `${out}/report-selection-check.pdf`;
  await pdfDownload.saveAs(pdfTarget);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export DOCX' }).click();
  const download = await downloadPromise;
  const target = `${out}/report-selection-check.docx`;
  await download.saveAs(target);
  console.log(JSON.stringify({ errors, savedAs: { pdf: pdfTarget, docx: target } }, null, 2));
  await browser.close();
})();
