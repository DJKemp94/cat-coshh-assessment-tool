const { chromium } = require('playwright');
const crypto = require('node:crypto');

const appUrl = process.env.CAT_APP_URL || 'http://127.0.0.1:5173/';
const uuid = () => crypto.randomUUID();

function assessment({ missingControls = false, missingStorageAssignment = false } = {}) {
  const chemicalId = uuid();
  const now = new Date().toISOString();
  return {
    schemaVersion: 3,
    id: uuid(),
    overview: {
      businessUnit: 'Research Lab',
      riskAssessmentRef: 'CAT-GATE',
      sopRef: 'SOP-CHEM-GATE',
      assessor: 'David Kemp',
      dateOfAssessment: '2026-05-31',
      dateOfNextReview: '2027-05-31',
      locations: 'Chemistry prep room',
      activityTitle: 'Completion gate check',
      activityOutline: 'Completion gate validation.',
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
        molecularFormula: 'C3H6O',
      }],
      controls: { engineering: ['Fume hood'], ppe: ['Gloves', 'Goggles'], other: 'Use secondary containment.' },
    }],
    controls: missingControls ? {
      elimination: '',
      substitution: '',
      reduction: '',
      engineering: '',
      administrative: 'Only trained personnel may complete the task.',
      ppe: { type: '', standard: '' },
      airMonitoring: 'Review WEL and controls.',
      healthSurveillance: 'Review SDS and OH triggers.',
    } : {
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
      storage: '',
      incompatibles: '',
      assignments: missingStorageAssignment ? {} : { [chemicalId]: { confirmed: true } },
    },
    emergency: {
      emergencyFirstAid: 'Use SDS Section 4.',
      emergencySpills: 'Use SDS Section 6.',
      emergencyFire: 'Use SDS Section 5.',
      wasteHandling: 'Use hazardous waste route.',
      other: '',
    },
    briefing: [{ id: uuid(), name: 'Test user', date: '2026-05-31' }],
    meta: { createdAt: now, updatedAt: now, appVersion: '0.2.0' },
  };
}

async function seed(page, data) {
  await page.goto(appUrl);
  await page.evaluate((raw) => {
    localStorage.clear();
    localStorage.setItem('cat.privacyAck', '1');
    localStorage.setItem('cat.activeAssessment', raw);
  }, JSON.stringify(data));
  await page.reload();
  await page.waitForLoadState('networkidle');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await seed(page, assessment({ missingControls: true }));
  const storageAfterMissingControls = await page.locator('aside button').filter({ hasText: 'Storage' }).evaluate((button) => ({
    disabled: button.disabled,
    title: button.getAttribute('title'),
  }));

  await seed(page, assessment());
  await page.locator('aside button').filter({ hasText: 'Storage' }).click();
  const emergencyWithOldHiddenStorageFieldsBlank = await page.locator('aside button').filter({ hasText: 'Emergency Response' }).evaluate((button) => ({
    disabled: button.disabled,
    title: button.getAttribute('title'),
  }));

  await seed(page, assessment({ missingStorageAssignment: true }));
  await page.locator('aside button').filter({ hasText: 'Storage' }).click();
  const emergencyAfterMissingStorageAssignment = await page.locator('aside button').filter({ hasText: 'Emergency Response' }).evaluate((button) => ({
    disabled: button.disabled,
    title: button.getAttribute('title'),
  }));
  const storageText = await page.locator('main').innerText();

  console.log(JSON.stringify({
    storageAfterMissingControls,
    emergencyWithOldHiddenStorageFieldsBlank,
    emergencyAfterMissingStorageAssignment,
    storageTextIncludesStorageAssignmentMessage: storageText.includes('confirm each chemical storage assignment'),
  }, null, 2));

  await browser.close();
})();
