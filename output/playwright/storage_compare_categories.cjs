const { chromium } = require('playwright');

const appUrl = process.env.APP_URL || 'http://127.0.0.1:8787/';
const now = new Date().toISOString();

const chemicals = [
  {
    id: 'acetone',
    name: 'Acetone',
    cas: '67-64-1',
    form: 'liquid',
    ghsPictograms: ['flammable'],
    hazardStatements: [{ code: 'H225', text: 'Highly flammable liquid and vapour' }],
    expected: 'Flammables / organic solvents',
  },
  {
    id: 'dichloromethane',
    name: 'Dichloromethane',
    cas: '75-09-2',
    form: 'liquid',
    ghsPictograms: ['health'],
    hazardStatements: [{ code: 'H351', text: 'Suspected of causing cancer' }],
    expected: 'Volatile poison / chlorinated solvent',
  },
  {
    id: 'hydrochloric-acid',
    name: 'Hydrochloric acid',
    cas: '7647-01-0',
    form: 'liquid',
    ghsPictograms: ['corrosive'],
    hazardStatements: [{ code: 'H314', text: 'Causes severe skin burns and eye damage' }],
    expected: 'Non-oxidising mineral acid',
  },
  {
    id: 'nitric-acid',
    name: 'Nitric acid',
    cas: '7697-37-2',
    form: 'liquid',
    ghsPictograms: ['oxidising', 'corrosive'],
    hazardStatements: [
      { code: 'H272', text: 'May intensify fire; oxidiser' },
      { code: 'H314', text: 'Causes severe skin burns and eye damage' },
    ],
    expected: 'Oxidising acid, double containment',
  },
  {
    id: 'sodium-hydroxide',
    name: 'Sodium hydroxide',
    cas: '1310-73-2',
    form: 'liquid',
    ghsPictograms: ['corrosive'],
    hazardStatements: [{ code: 'H314', text: 'Causes severe skin burns and eye damage' }],
    expected: 'Liquid base',
  },
  {
    id: 'potassium-permanganate',
    name: 'Potassium permanganate',
    cas: '7722-64-7',
    form: 'solid',
    ghsPictograms: ['oxidising'],
    hazardStatements: [{ code: 'H272', text: 'May intensify fire; oxidiser' }],
    expected: 'Oxidizer cabinet',
  },
  {
    id: 'phenol',
    name: 'Phenol',
    cas: '108-95-2',
    form: 'liquid',
    ghsPictograms: ['toxic', 'corrosive'],
    hazardStatements: [
      { code: 'H301', text: 'Toxic if swallowed' },
      { code: 'H311', text: 'Toxic in contact with skin' },
      { code: 'H331', text: 'Toxic if inhaled' },
      { code: 'H314', text: 'Causes severe skin burns and eye damage' },
    ],
    expected: 'Volatile poison or liquid poison',
  },
  {
    id: 'sodium-cyanide',
    name: 'Sodium cyanide',
    cas: '143-33-9',
    molecularFormula: 'NaCN',
    form: 'solid',
    ghsPictograms: ['toxic'],
    hazardStatements: [{ code: 'H300', text: 'Fatal if swallowed' }],
    expected: 'Dry poison',
  },
  {
    id: 'sucrose',
    name: 'Sucrose',
    cas: '57-50-1',
    molecularFormula: 'C12H22O11',
    form: 'solid',
    ghsPictograms: [],
    hazardStatements: [],
    expected: 'Dry solids / shelving',
  },
  {
    id: 'sodium-metal',
    name: 'Sodium metal',
    cas: '7440-23-5',
    form: 'solid',
    ghsPictograms: ['flammable'],
    hazardStatements: [
      { code: 'H260', text: 'In contact with water releases flammable gases which may ignite spontaneously' },
      { code: 'H250', text: 'Catches fire spontaneously if exposed to air' },
    ],
    expected: 'Water-reactive outlier',
  },
];

const chemicalRecords = chemicals.map((chemical) => ({
  id: chemical.id,
  name: chemical.name,
  cas: chemical.cas,
  molecularFormula: chemical.molecularFormula,
  hazardStatements: chemical.hazardStatements,
  ghsPictograms: chemical.ghsPictograms,
  wel: {},
  quantity: '100 ml',
  form: chemical.form,
  exposureDuration: '15 minutes',
  exposureFrequency: 'Weekly',
  exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
}));

const assessment = {
  schemaVersion: 3,
  id: 'storage-compare-categories',
  overview: {
    businessUnit: 'QA',
    riskAssessmentRef: 'STORAGE-COMPARE',
    sopRef: 'SOP-STORAGE-COMPARE',
    assessor: 'Playwright',
    dateOfAssessment: '2026-05-31',
    dateOfNextReview: '2028-05-31',
    locations: 'Storage test lab',
    activityTitle: 'Storage comparison categories',
    activityOutline: 'Compare original Storage and Storage 2.0 category assignment',
    personsAtRisk: { staff: true, students: false, thirdParty: false, contractors: false, visitors: false, public: false },
  },
  taskHazards: [],
  taskHazardsConfirmedNone: true,
  processSteps: [{
    id: 'step-storage-compare',
    step: 'Storage comparison',
    description: 'Representative chemicals selected to cover each storage scheme category.',
    controls: { engineering: ['Ventilated storage'], ppe: ['Safety glasses'], other: '' },
    chemicals: chemicalRecords,
  }],
  controls: {
    elimination: 'Reviewed',
    substitution: '',
    reduction: 'Minimum quantities',
    administrative: 'Segregated storage',
    airMonitoring: 'Not required for UI comparison',
    healthSurveillance: 'Not required for UI comparison',
  },
  additional: {
    cheminventoryLogged: false,
    sdsVersion: '',
    sdsDate: '',
    storage: '',
    incompatibles: '',
    assignments: Object.fromEntries(chemicals.map((chemical) => [chemical.id, { confirmed: true }])),
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

async function visibleText(page, selector) {
  return page.locator(selector).evaluateAll((nodes) => nodes.map((node) => node.textContent || ''));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1550, height: 1150 } });
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

  await page.getByRole('button', { name: /^Storage$/ }).click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'output/playwright/storage-compare-original.png', fullPage: true });
  const storageSelects = await page.locator('select[aria-label^="Storage group for"]').evaluateAll((selects) => selects.map((select) => {
    const label = select.getAttribute('aria-label') || '';
    const selected = select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0].textContent : '';
    return { label, selected };
  }));

  await page.getByRole('button', { name: 'Storage 2.0', exact: true }).click();
  await page.waitForLoadState('networkidle');
  await page.locator('text=Image-based cabinet layout').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/storage-compare-storage20-layout.png', fullPage: false });
  await page.screenshot({ path: 'output/playwright/storage-compare-storage20-full.png', fullPage: true });

  const bodyText = await page.locator('body').innerText();
  const zoneTexts = await visibleText(page, 'div.rounded-md.border.p-3');

  console.log(JSON.stringify({
    expected: chemicals.map(({ name, cas, expected }) => ({ name, cas, expected })),
    originalStorageSelects: storageSelects,
    storage20Has: {
      organicSolvents: bodyText.includes('Organic solvents and organic acids'),
      chlorinatedSolvents: bodyText.includes('Volatile poisons and chlorinated solvents'),
      nonOxidizingAcids: bodyText.includes('Non-oxidizing organic and mineral acids'),
      oxidizingAcids: bodyText.includes('Oxidizing acids in double containment'),
      liquidBases: bodyText.includes('Liquid bases'),
      oxidizers: bodyText.includes('Oxidizers, excluding oxidizing acids or organic peroxides'),
      dryPoisons: bodyText.includes('Non-volatile poisons - dry'),
      liquidPoisons: bodyText.includes('Non-volatile poisons - liquid'),
      drySolids: bodyText.includes('Dry solids'),
      review: bodyText.includes('Unassigned / assessor review'),
    },
    zoneTexts,
    errors,
  }, null, 2));

  await browser.close();
  if (errors.length > 0 || storageSelects.length < 10 || !bodyText.includes('Image-based cabinet layout')) process.exit(1);
})();
