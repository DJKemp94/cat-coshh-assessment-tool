const { chromium } = require('playwright');

const appUrl = process.env.APP_URL || 'http://127.0.0.1:8787/';

const now = new Date().toISOString();
const chem = (id, name, cas, pictograms = [], hazardStatements = []) => ({
  id,
  name,
  cas,
  hazardStatements,
  ghsPictograms: pictograms,
  wel: {},
  quantity: '100 ml',
  form: 'liquid',
  exposureDuration: '15 minutes',
  exposureFrequency: 'Weekly',
  exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
});

const assessment = {
  schemaVersion: 3,
  id: 'storage20-playwright',
  overview: {
    businessUnit: 'QA',
    riskAssessmentRef: 'ST20',
    sopRef: 'SOP-ST20',
    assessor: 'Playwright',
    dateOfAssessment: '2026-05-31',
    dateOfNextReview: '2028-05-31',
    locations: 'Lab',
    activityTitle: 'Storage 2.0 check',
    activityOutline: 'Compatibility check',
    personsAtRisk: { staff: true, students: false, thirdParty: false, contractors: false, visitors: false, public: false },
  },
  taskHazards: [],
  taskHazardsConfirmedNone: true,
  processSteps: [{
    id: 'step-1',
    step: 'Storage',
    description: 'Store representative chemicals',
    controls: { engineering: ['Fume cupboard'], ppe: ['Safety glasses'], other: '' },
    chemicals: [
      chem('chem-acetone', 'Acetone', '67-64-1', ['flammable'], [{ code: 'H225', text: 'Highly flammable liquid and vapour' }]),
      chem('chem-nitric', 'Nitric acid', '7697-37-2', ['oxidising', 'corrosive'], [{ code: 'H272', text: 'May intensify fire; oxidiser' }]),
      chem('chem-sodium-hydroxide', 'Sodium hydroxide', '1310-73-2', ['corrosive'], [{ code: 'H314', text: 'Causes severe skin burns and eye damage' }]),
      chem('chem-made-up', 'Made Up Test Reagent', '', [], []),
    ],
  }],
  controls: {
    elimination: 'Reviewed',
    substitution: '',
    reduction: 'Minimum quantities',
    administrative: 'Label and segregate',
    airMonitoring: 'Not required',
    healthSurveillance: 'Not required',
  },
  additional: {
    cheminventoryLogged: false,
    sdsVersion: '',
    sdsDate: '',
    storage: '',
    incompatibles: '',
    assignments: {
      'chem-acetone': { confirmed: true },
      'chem-nitric': { confirmed: true },
      'chem-sodium-hydroxide': { confirmed: true },
      'chem-made-up': { confirmed: true },
    },
  },
  storage2: { matches: {}, pairOverrides: {}, layoutNotes: '' },
  emergency: {
    emergencySpills: 'Spill response documented',
    emergencyFirstAid: 'First aid documented',
    emergencyFire: 'Fire response documented',
    wasteHandling: 'Waste documented',
    other: '',
  },
  briefing: [{ id: 'brief-1', name: 'Worker', signaturePng: '', date: '2026-05-31' }],
  meta: { createdAt: now, updatedAt: now, appVersion: '0.2.0' },
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(appUrl);
  await page.evaluate((seed) => {
    localStorage.setItem('cat.privacyAck', '1');
    localStorage.setItem('cat.testingMode', '1');
    localStorage.setItem('cat.activeAssessment', JSON.stringify(seed));
  }, assessment);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Storage 2\.0/ }).click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'output/playwright/storage20-page.png', fullPage: true });

  const summary = {
    heading: await page.getByRole('heading', { name: 'Storage 2.0' }).count(),
    cameoMatchRows: await page.locator('text=CAS match').count(),
    unmatchedRows: await page.locator('text=Unmatched').count(),
    incompatibleBadges: await page.locator('text=Incompatible').count(),
    cautionBadges: await page.locator('text=Caution').count(),
    cabinetLayout: await page.locator('text=Image-based cabinet layout').count(),
    errors,
  };

  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  if (errors.length > 0 || summary.heading !== 1 || summary.cameoMatchRows < 3 || summary.unmatchedRows < 1 || summary.incompatibleBadges < 1 || summary.cabinetLayout !== 1) {
    process.exit(1);
  }
})();
