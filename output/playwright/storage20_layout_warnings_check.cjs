const { chromium } = require('playwright');

const appUrl = process.env.APP_URL || 'http://127.0.0.1:8787/';
const now = new Date().toISOString();

const chem = (id, name, cas, form = 'liquid', pictograms = [], hazardStatements = []) => ({
  id,
  name,
  cas,
  hazardStatements,
  ghsPictograms: pictograms,
  wel: {},
  quantity: form === 'solid' ? '100 g' : '100 ml',
  form,
  exposureDuration: '15 minutes',
  exposureFrequency: 'Weekly',
  exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
});

const assessment = {
  schemaVersion: 3,
  id: 'storage20-layout-warnings',
  overview: {
    businessUnit: 'QA',
    riskAssessmentRef: 'ST20-WARN',
    sopRef: 'SOP-ST20',
    assessor: 'Playwright',
    dateOfAssessment: '2026-05-31',
    dateOfNextReview: '2028-05-31',
    locations: 'Lab',
    activityTitle: 'Storage 2.0 layout warnings',
    activityOutline: 'Check cabinet warnings and compact layout',
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
      chem('chem-acetone', 'Acetone', '67-64-1', 'liquid', ['flammable'], [{ code: 'H225', text: 'Highly flammable liquid and vapour' }]),
      chem('chem-nitric', 'Nitric acid', '7697-37-2', 'liquid', ['oxidising', 'corrosive'], [{ code: 'H272', text: 'May intensify fire; oxidiser' }]),
      chem('chem-sodium-hydroxide', 'Sodium hydroxide', '1310-73-2', 'liquid', ['corrosive'], [{ code: 'H314', text: 'Causes severe skin burns and eye damage' }]),
      chem('chem-acetic-anhydride', 'Acetic anhydride', '108-24-7', 'liquid', ['flammable', 'corrosive'], [{ code: 'H226', text: 'Flammable liquid and vapour' }]),
      chem('chem-salicylic-acid', 'Salicylic acid', '69-72-7', 'solid', [], []),
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
    assignments: {},
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
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

  const layout = page.locator('text=Image-based cabinet layout').locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  await layout.screenshot({ path: 'output/playwright/storage20-layout-warnings.png' });
  const layoutText = await layout.innerText();

  const cabinetTitles = await page.locator('[data-testid="storage2-cabinet-title"]').allTextContents();
  const summary = {
    cabinetTitles,
    spillWarnings: await page.locator('text=/spill-contact warning|Same storage zone|Same cabinet/').count(),
    matrix: await page.locator('text=Compatibility matrix (by storage group)').count(),
    toxinsCabinet: cabinetTitles.filter((title) => title === 'Toxins Cabinet').length,
    shelvingCabinet: cabinetTitles.filter((title) => title === 'Shelving').length,
    specialReviewCabinet: cabinetTitles.filter((title) => title === 'Special / Review SDS').length,
    solidBasesZone: /Solid bases/.test(layoutText),
    liquidBasesZone: /Liquid bases/.test(layoutText),
    salicylicInCorrosives: /Salicylic acid/.test(layoutText),
    errors,
  };

  console.log(JSON.stringify(summary, null, 2));
  await browser.close();

  if (errors.length > 0 || summary.spillWarnings !== 0 || summary.matrix !== 1 || summary.toxinsCabinet !== 0 || summary.shelvingCabinet !== 0 || summary.specialReviewCabinet !== 0 || !summary.solidBasesZone || summary.liquidBasesZone || !summary.salicylicInCorrosives) {
    process.exit(1);
  }
})();
