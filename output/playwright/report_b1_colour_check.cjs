const { chromium } = require('playwright');
const crypto = require('node:crypto');

const appUrl = process.env.CAT_APP_URL || 'http://127.0.0.1:8787/';
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
  wel: { twa: '8-hour TWA 1 ppm', stel: '15-minute STEL 2 ppm', source: 'EH40' },
  exposureDuration: 'Up to 30 minutes',
  exposureFrequency: 'Weekly',
  exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
  ...extra,
});

function assessment() {
  const chemicals = [
    chem('Sulfuric acid', '7664-93-9', '10 mL', 'liquid', ['H314'], ['corrosive'], { volatility: 'low' }),
    chem('Salicylic acid', '69-72-7', '5 g', 'solid', ['H361D'], ['health-hazard'], { dustiness: 'medium' }),
    chem('Acetic anhydride', '108-24-7', '20 mL', 'liquid', ['H314'], ['corrosive'], { volatility: 'medium' }),
  ];
  const assignments = Object.fromEntries(chemicals.map((chemical) => [chemical.id, { confirmed: true }]));
  const now = new Date().toISOString();
  return {
    schemaVersion: 3,
    id: uuid(),
    overview: {
      businessUnit: 'Research Lab',
      riskAssessmentRef: 'CAT-B1',
      sopRef: 'SOP-B1',
      assessor: 'David Kemp',
      dateOfAssessment: '2026-05-31',
      dateOfNextReview: '2027-05-31',
      locations: 'Chemistry prep room',
      activityTitle: 'B1 colour verification',
      activityOutline: 'Small-scale COSHH screening verification.',
      personsAtRisk: { staff: true, students: true, thirdParty: false, contractors: false, visitors: false, public: false },
    },
    taskHazardsConfirmedNone: true,
    taskHazards: [],
    processSteps: [{
      id: uuid(),
      step: 'Prepare aspirin synthesis',
      description: 'Dispense chemicals at bench scale.',
      chemicals,
      controls: { engineering: ['Fume hood'], ppe: ['Gloves', 'Goggles'], other: 'Use secondary containment.' },
    }],
    controls: {
      elimination: 'Reviewed for the task.',
      substitution: '',
      reduction: 'Use minimum working quantities.',
      administrative: 'Only trained staff may complete the task.',
      airMonitoring: 'Not required for this short-duration task.',
      healthSurveillance: 'No trigger identified.',
    },
    additional: {
      cheminventoryLogged: true,
      sdsVersion: '',
      sdsDate: '',
      storage: 'Use assigned groups.',
      incompatibles: 'Segregate incompatible groups.',
      assignments,
    },
    emergency: {
      emergencyFirstAid: 'Follow SDS Section 4.',
      emergencySpills: 'Follow SDS Section 6.',
      emergencyFire: 'Follow SDS Section 5.',
      wasteHandling: 'Collect compatible waste streams.',
      other: '',
    },
    briefing: [{ id: uuid(), name: 'Test user', date: '2026-05-31' }],
    meta: { createdAt: now, updatedAt: now, appVersion: '0.2.0' },
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
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

  const result = await page.evaluate(() => {
    const text = document.querySelector('.report-preview-print')?.textContent || '';
    const bg = (selector) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).backgroundColor : null;
    };
    const controlsCards = [...document.querySelectorAll('.report-preview-print .report-card-stack .report-mini-card')]
      .slice(0, 4)
      .map((el) => getComputedStyle(el).backgroundColor);
    const recommendationRows = [...document.querySelectorAll('.report-preview-print .report-recommendation-row')]
      .map((row) => [...row.querySelectorAll('td')].map((cell) => getComputedStyle(cell).backgroundColor));
    return {
      hasAssessorConfirmationBox: /Assessor confirmation/i.test(text),
      hasRecommendationHeader: /Substance-level COSHH Essentials screening recommendations/i.test(text),
      storageHasGhsColumn: /05 Storage[\s\S]*GHS/.test(text),
      storageHasHazardsColumn: /05 Storage[\s\S]*Hazards/.test(text),
      approach1: bg('.report-preview-print .report-severity-approach-1 > td'),
      approach2: bg('.report-preview-print .report-severity-approach-2 > td'),
      approach3: bg('.report-preview-print .report-severity-approach-3 > td'),
      approach4: bg('.report-preview-print .report-severity-approach-4 > td'),
      groupA: bg('.report-preview-print .report-severity-group-a > td'),
      groupC: bg('.report-preview-print .report-severity-group-c > td'),
      ep1: bg('.report-preview-print .report-severity-ep-ep1 > td'),
      ep2: bg('.report-preview-print .report-severity-ep-ep2 > td'),
      controlsCards,
      recommendationRows,
    };
  });
  await page.screenshot({ path: `${out}/report-b1-colour-check.png`, fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ errors, result }, null, 2));
  const distinctControlColours = new Set(result.controlsCards).size;
  if (
    errors.length ||
    result.hasAssessorConfirmationBox ||
    !result.hasRecommendationHeader ||
    !result.storageHasGhsColumn ||
    result.storageHasHazardsColumn ||
    distinctControlColours < 4 ||
    new Set([result.approach1, result.approach2, result.approach3, result.approach4]).size < 4 ||
    result.groupA !== result.approach1 ||
    result.groupC !== result.approach3 ||
    result.ep1 !== result.approach1 ||
    result.ep2 !== result.approach2 ||
    result.recommendationRows.length === 0 ||
    result.recommendationRows.some((row) => row[0] !== row[6])
  ) {
    process.exit(1);
  }
})();
