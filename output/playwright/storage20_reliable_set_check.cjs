const { chromium } = require('playwright');

const appUrl = process.env.APP_URL || 'http://127.0.0.1:8787/';
const now = new Date().toISOString();

const h = (code, text = '') => ({ code, text });
const chem = (id, name, cas, form, pictograms = [], hazardStatements = [], extra = {}) => ({
  id,
  name,
  cas,
  hazardStatements,
  ghsPictograms: pictograms,
  wel: {},
  quantity: form === 'solid' || form === 'powder' ? '100 g' : '100 ml',
  form,
  exposureDuration: '15 minutes',
  exposureFrequency: 'Weekly',
  exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
  ...extra,
});

const assessment = {
  schemaVersion: 3,
  id: 'storage20-reliable-set',
  overview: {
    businessUnit: 'QA',
    riskAssessmentRef: 'ST20-RELIABLE',
    sopRef: 'SOP-ST20',
    assessor: 'Playwright',
    dateOfAssessment: '2026-06-01',
    dateOfNextReview: '2028-06-01',
    locations: 'Lab',
    activityTitle: 'Storage 2.0 reliable set',
    activityOutline: 'CAMEO plus GHS fallback classification',
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
      chem('fake-flammable-solvent', 'Unlisted flammable solvent QA', '', 'liquid', ['flammable'], [h('H225', 'Highly flammable liquid and vapour')], { molecularFormula: 'C3H8O' }),
      chem('fake-oxidizer', 'Unlisted oxidizer QA', '', 'solid', ['oxidising'], [h('H272', 'May intensify fire; oxidiser')], { molecularFormula: 'NaNO3' }),
      chem('sodium-hydroxide-solid', 'Sodium hydroxide', '1310-73-2', 'solid', ['corrosive'], [h('H314', 'Causes severe skin burns and eye damage')], { molecularFormula: 'NaOH' }),
      chem('sodium-hydroxide-solution', 'Sodium hydroxide solution 1 M', '', 'liquid', ['corrosive'], [h('H314', 'Causes severe skin burns and eye damage')], { molecularFormula: 'NaOH', formNote: 'aqueous solution' }),
      chem('nitric-acid', 'Nitric acid', '7697-37-2', 'liquid', ['oxidising', 'corrosive'], [h('H272', 'May intensify fire; oxidiser'), h('H314', 'Causes severe skin burns and eye damage')], { molecularFormula: 'HNO3' }),
      chem('sodium-cyanide', 'Sodium cyanide', '143-33-9', 'solid', ['toxic'], [h('H300', 'Fatal if swallowed')], { molecularFormula: 'NaCN' }),
      chem('sodium-metal', 'Sodium metal', '7440-23-5', 'solid', ['flammable'], [h('H260', 'In contact with water releases flammable gases')], { molecularFormula: 'Na' }),
      chem('unknown-dry-solid', 'Unlisted inert dry solid QA', '', 'solid', [], [], { molecularFormula: 'SiO2' }),
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
  briefing: [{ id: 'brief-1', name: 'Worker', signaturePng: '', date: '2026-06-01' }],
  meta: { createdAt: now, updatedAt: now, appVersion: '0.2.0' },
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1300 } });
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
  await page.getByRole('button', { name: /Oxidising Acids and Organic Solvents/ }).first().hover();
  await page.screenshot({ path: 'output/playwright/storage20-reliable-set-matrix-hover.png', fullPage: true });
  await page.getByRole('button', { name: /Water Reactive and Organic Solvents/ }).first().hover();
  const lowerTooltipBox = await page.getByTestId('storage2-matrix-hover-waterReactive-organicSolvents').boundingBox();
  await page.screenshot({ path: 'output/playwright/storage20-reliable-set-matrix-hover-bottom.png', fullPage: true });

  const layout = page.locator('text=Image-based cabinet layout').locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  await layout.screenshot({ path: 'output/playwright/storage20-reliable-set-layout.png' });

  const text = await layout.innerText();
  const cabinetTitles = await page.locator('[data-testid="storage2-cabinet-title"]').allTextContents();
  const expectations = {
    flammableFallback: /Organic solvents and organic acids[\s\S]*Unlisted flammable solvent QA/.test(text),
    oxidizerFallback: /Oxidizers, excluding oxidizing acids or organic peroxides[\s\S]*Unlisted oxidizer QA/.test(text),
    solidBase: /Solid bases[\s\S]*Sodium hydroxide/.test(text),
    liquidBase: /Liquid bases[\s\S]*Sodium hydroxide solution 1 M/.test(text),
    oxidizingAcid: /Oxidizing acids in double containment[\s\S]*Nitric acid/.test(text),
    toxin: /Non-volatile poisons - dry[\s\S]*Sodium cyanide/.test(text),
    waterReactive: /Hard isolation \/ dedicated reactive storage[\s\S]*Sodium metal/.test(text),
    drySolid: /Dry solids[\s\S]*Unlisted inert dry solid QA/.test(text),
    ghsSourceVisible: await page.locator('text=ghs').count() >= 2,
    noAssignedCabinetWarnings: await page.locator('text=/spill-contact warning|Same storage zone|Same cabinet/').count() === 0,
    classificationTable: await page.locator('text=Chemical classification and CAMEO matching').count() === 1,
    storageGroupMatrix: await page.locator('text=Compatibility matrix (by storage group)').count() === 1,
    noSummaryCards: await page.locator('text=/Need confirmation|High concern pairs|Caution pairs/').count() === 0,
    noWhyAssignmentText: await page.locator('text=Why this assignment?').count() === 0,
    lowerMatrixHoverStaysInViewport: Boolean(lowerTooltipBox && lowerTooltipBox.y >= 0),
  };
  await page.getByLabel(/Assignment source:/).first().click();
  const sourceInfoVisible = await page.locator('text=Assignment source').count() > 0;
  await page.getByLabel('Storage Group Assignment for Unlisted flammable solvent QA').selectOption('drySolids');
  const requirements = page.getByLabel('Storage requirements for Unlisted flammable solvent QA');
  await requirements.fill('Custom storage test; keep below eye level');
  const editability = {
    sourceInfoVisible,
    overrideVisible: await page.locator('text=User override').count() > 0,
    assignmentValue: await page.getByLabel('Storage Group Assignment for Unlisted flammable solvent QA').inputValue(),
    requirementsValue: await requirements.inputValue(),
  };
  const summary = { cabinetTitles, expectations, editability, errors };

  console.log(JSON.stringify(summary, null, 2));
  await browser.close();

  if (errors.length > 0 || Object.values(expectations).some((value) => !value) || !editability.sourceInfoVisible || !editability.overrideVisible || editability.assignmentValue !== 'drySolids' || editability.requirementsValue !== 'Custom storage test; keep below eye level') {
    process.exit(1);
  }
})();
