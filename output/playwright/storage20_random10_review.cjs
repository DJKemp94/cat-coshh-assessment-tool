const { chromium } = require('playwright');
const fs = require('node:fs');

const appUrl = process.env.APP_URL || 'http://127.0.0.1:8787/';
const chemicals = JSON.parse(fs.readFileSync('app/src/data/cameo/chemicals.json', 'utf8'));
const chemicalGroups = JSON.parse(fs.readFileSync('app/src/data/cameo/chemicalGroups.json', 'utf8'));
const groupCounts = new Map();
for (const row of chemicalGroups) groupCounts.set(row.chemicalId, (groupCounts.get(row.chemicalId) ?? 0) + 1);

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

const rand = seededRandom(20260531);
const pool = chemicals.filter((chemical) =>
  chemical.cas.length > 0 &&
  (groupCounts.get(chemical.id) ?? 0) > 0 &&
  !/mixture|solution|waste|not otherwise specified|n\.o\.s\./i.test(chemical.name)
);
const sample = [];
const used = new Set();
while (sample.length < 10) {
  const candidate = pool[Math.floor(rand() * pool.length)];
  if (used.has(candidate.id)) continue;
  used.add(candidate.id);
  sample.push(candidate);
}

const now = new Date().toISOString();
const assessment = {
  schemaVersion: 3,
  id: 'storage20-random10',
  overview: {
    businessUnit: 'QA',
    riskAssessmentRef: 'ST20-R10',
    sopRef: 'SOP-ST20-R10',
    assessor: 'Playwright',
    dateOfAssessment: '2026-05-31',
    dateOfNextReview: '2028-05-31',
    locations: 'Random sample lab',
    activityTitle: 'Storage 2.0 random 10 review',
    activityOutline: 'Random CAMEO compatibility stress test',
    personsAtRisk: { staff: true, students: false, thirdParty: false, contractors: false, visitors: false, public: false },
  },
  taskHazards: [],
  taskHazardsConfirmedNone: true,
  processSteps: [{
    id: 'step-random-10',
    step: 'Random storage set',
    description: 'Ten randomly sampled CAMEO chemicals with CAS records and reactive groups.',
    controls: { engineering: ['Ventilated storage'], ppe: ['Safety glasses'], other: '' },
    chemicals: sample.map((chemical) => ({
      id: `chem-${chemical.id}`,
      name: chemical.name,
      cas: chemical.cas[0],
      hazardStatements: [],
      ghsPictograms: [],
      wel: {},
      quantity: '100 ml',
      form: 'liquid',
      exposureDuration: '15 minutes',
      exposureFrequency: 'Weekly',
      exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
    })),
  }],
  controls: {
    elimination: 'Reviewed',
    substitution: '',
    reduction: 'Minimum quantities',
    administrative: 'Use segregated storage',
    airMonitoring: 'Not required for this UI test',
    healthSurveillance: 'Not required for this UI test',
  },
  additional: {
    cheminventoryLogged: false,
    sdsVersion: '',
    sdsDate: '',
    storage: '',
    incompatibles: '',
    assignments: Object.fromEntries(sample.map((chemical) => [`chem-${chemical.id}`, { confirmed: true }])),
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
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
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

  await page.screenshot({ path: 'output/playwright/storage20-random10-top.png', fullPage: false });
  await page.screenshot({ path: 'output/playwright/storage20-random10-full.png', fullPage: true });

  await page.locator('text=Compatibility matrix').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/storage20-random10-matrix.png', fullPage: false });

  await page.locator('text=Image-based cabinet layout').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/storage20-random10-cabinet-layout.png', fullPage: false });

  const result = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      cameoMatchesTile: [...document.querySelectorAll('div')].map((el) => el.textContent || '').find((value) => value.includes('CAMEO MATCHES')) || '',
      incompatiblePairsTile: [...document.querySelectorAll('div')].map((el) => el.textContent || '').find((value) => value.includes('INCOMPATIBLE PAIRS')) || '',
      cautionPairsTile: [...document.querySelectorAll('div')].map((el) => el.textContent || '').find((value) => value.includes('CAUTION PAIRS')) || '',
      incompatibleTextCount: (text.match(/Incompatible/g) || []).length,
      cautionTextCount: (text.match(/Caution/g) || []).length,
      casMatchCount: (text.match(/CAS match/g) || []).length,
      unmatchedCount: (text.match(/Unmatched/g) || []).length,
      sourcePresent: text.includes('CAMEO Chemicals 3.1.0'),
    };
  });

  console.log(JSON.stringify({
    sample: sample.map((chemical) => ({ id: chemical.id, name: chemical.name, cas: chemical.cas[0] })),
    result,
    errors,
  }, null, 2));

  await browser.close();
  if (errors.length > 0 || result.casMatchCount < 10 || !result.sourcePresent) process.exit(1);
})();
