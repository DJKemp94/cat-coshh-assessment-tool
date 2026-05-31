const { chromium } = require('playwright');
const crypto = require('node:crypto');
const fs = require('node:fs');

const out = '/Users/davidkemp/Desktop/CAT/output/playwright';
const appUrl = process.env.CAT_APP_URL || 'http://127.0.0.1:5173/';
const uuid = () => crypto.randomUUID();
const h = (code, text = '') => ({ code, text });
const pic = (...values) => values;

const chem = (name, cas, quantity, form, hcodes, pictograms, extra = {}) => ({
  id: uuid(),
  name,
  cas,
  quantity,
  form,
  hazardStatements: hcodes.map((code) => h(code)),
  ghsPictograms: pictograms,
  wel: { twa: extra.twa || 'Check EH40/SDS', source: 'Manual-EH40' },
  exposureDuration: 'Up to 30 minutes per use',
  exposureFrequency: 'Weekly',
  exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
  volatility: extra.volatility,
  dustiness: extra.dustiness,
  molecularFormula: extra.formula,
  canonicalSmiles: extra.smiles,
  pubchemTitle: name,
});

function makeAssessment(confirmStorage) {
  const chems = [
    chem('Acetone', '67-64-1', '250 mL', 'liquid', ['H225', 'H319', 'H336'], pic('flammable', 'harmful'), { volatility: 'high', formula: 'C3H6O', smiles: 'CC(=O)C' }),
    chem('Ethanol', '64-17-5', '100 mL', 'liquid', ['H225', 'H319'], pic('flammable', 'harmful'), { volatility: 'high', formula: 'C2H6O', smiles: 'CCO' }),
    chem('Dichloromethane', '75-09-2', '50 mL', 'liquid', ['H315', 'H319', 'H335', 'H351'], pic('harmful', 'health-hazard'), { volatility: 'high', formula: 'CH2Cl2', smiles: 'C(Cl)Cl' }),
    chem('Hydrochloric acid', '7647-01-0', '100 mL', 'liquid', ['H290', 'H314', 'H335'], pic('corrosive', 'harmful'), { volatility: 'medium', formula: 'HCl' }),
    chem('Sulfuric acid', '7664-93-9', '100 mL', 'liquid', ['H290', 'H314'], pic('corrosive'), { volatility: 'low', formula: 'H2SO4' }),
    chem('Sodium hydroxide', '1310-73-2', '100 g', 'solid', ['H290', 'H314'], pic('corrosive'), { dustiness: 'medium', formula: 'NaOH' }),
    chem('Nitric acid', '7697-37-2', '25 mL', 'liquid', ['H272', 'H290', 'H314'], pic('oxidising', 'corrosive'), { volatility: 'medium', formula: 'HNO3' }),
    chem('Hydrogen peroxide 30%', '7722-84-1', '50 mL', 'liquid', ['H272', 'H302', 'H318'], pic('oxidising', 'corrosive', 'harmful'), { volatility: 'low', formula: 'H2O2' }),
    chem('Sodium cyanide', '143-33-9', '10 g', 'solid', ['H300', 'H310', 'H330', 'H410'], pic('toxic', 'environmental'), { dustiness: 'high', formula: 'NaCN' }),
    chem('Phenol', '108-95-2', '25 g', 'solid', ['H301', 'H311', 'H314', 'H331', 'H341', 'H373'], pic('toxic', 'corrosive', 'health-hazard'), { dustiness: 'medium', formula: 'C6H6O', smiles: 'C1=CC=C(C=C1)O' }),
    chem('Toluene', '108-88-3', '100 mL', 'liquid', ['H225', 'H304', 'H315', 'H336', 'H361', 'H373'], pic('flammable', 'harmful', 'health-hazard'), { volatility: 'medium', formula: 'C7H8', smiles: 'CC1=CC=CC=C1' }),
    chem('Formaldehyde solution', '50-00-0', '25 mL', 'liquid', ['H301', 'H311', 'H314', 'H317', 'H331', 'H341', 'H350'], pic('toxic', 'corrosive', 'health-hazard'), { volatility: 'high', formula: 'CH2O', smiles: 'C=O' }),
    chem('Potassium permanganate', '7722-64-7', '20 g', 'solid', ['H272', 'H302', 'H410'], pic('oxidising', 'harmful', 'environmental'), { dustiness: 'medium', formula: 'KMnO4' }),
    chem('Sodium borohydride', '16940-66-2', '10 g', 'solid', ['H260', 'H301', 'H314'], pic('flammable', 'toxic', 'corrosive'), { dustiness: 'medium', formula: 'NaBH4' }),
    chem('Acetonitrile', '75-05-8', '100 mL', 'liquid', ['H225', 'H302', 'H312', 'H319', 'H332'], pic('flammable', 'harmful'), { volatility: 'high', formula: 'C2H3N', smiles: 'CC#N' }),
  ];

  const assignments = {};
  if (confirmStorage) {
    chems.forEach((c) => {
      assignments[c.id] = { confirmed: true };
    });
  }

  const now = new Date().toISOString();
  return {
    schemaVersion: 3,
    id: uuid(),
    overview: {
      businessUnit: 'Research Lab',
      riskAssessmentRef: 'CAT-PW-001',
      sopRef: 'SOP-CHEM-015',
      assessor: 'David Kemp',
      dateOfAssessment: '2026-05-30',
      dateOfNextReview: '2027-05-30',
      locations: 'Chemistry prep room',
      activityTitle: 'Mixed chemical bench preparation',
      activityOutline: 'Small-scale preparation, transfer, storage and cleanup of mixed laboratory chemicals for bench work.',
      personsAtRisk: { staff: true, students: true, thirdParty: false, contractors: false, visitors: false, public: false },
    },
    taskHazardsConfirmedNone: false,
    taskHazards: [{
      id: uuid(),
      hazard: 'Glassware breakage and manual handling during chemical transfer',
      harmMechanism: 'Cuts or dropped containers could cause injury and secondary chemical release.',
      riskEvaluation: { likelihood: 3, severity: 3 },
      controlsInPlace: 'Use compatible trays, small containers, clear bench space and trained staff only.',
      residualRisk: { likelihood: 1, severity: 2 },
      furtherAction: '',
      owner: '',
      dueDate: '',
      completionDate: '',
    }],
    processSteps: [{
      id: uuid(),
      step: 'Prepare and transfer mixed chemicals',
      description: 'Retrieve chemicals from storage, confirm current SDS, measure small working quantities in a fume hood, label working containers, return stock to segregated storage and collect wastes.',
      chemicals: chems,
      controls: {
        engineering: ['Fume hood'],
        ppe: ['Gloves', 'Goggles', 'Lab coat', 'Face shield'],
        other: 'Use compatible secondary containment. Do not open incompatible chemicals together. Confirm glove material and any RPE need against SDS before work.',
      },
    }],
    controls: {
      elimination: 'Each chemical was reviewed. Remove any substance not required by the SOP before work starts.',
      substitution: 'Substitution must be confirmed against the method and SDS. Use lower hazard alternatives where validated and approved.',
      reduction: 'Use only the minimum working quantity at the bench; return stock containers immediately after dispensing.',
      engineering: 'Carry out open handling in a tested fume hood/LEV. Use closed containers and secondary containment for transfer.',
      administrative: 'Only trained and authorised personnel may perform the task. Current SDS for all 15 chemicals must be checked before work; reassess before changing chemicals, quantity, concentration or process.',
      ppe: {
        type: 'Chemical resistant gloves, splash goggles, lab coat, face shield for corrosives/reactives; RPE only if specified by SDS/local assessment.',
        standard: 'Confirm glove breakthrough/compatibility, eye/face protection and any RPE standard against SDS and local PPE procedure.',
      },
      airMonitoring: 'Review EH40/WEL information and SDS exposure limits. Air monitoring is required where exposure cannot be demonstrated as adequately controlled by containment/LEV or after process/control changes.',
      healthSurveillance: 'Refer to Occupational Health where SDS, local procedure, sensitiser/CMR classification or potential exposure indicates health surveillance or medical surveillance is required.',
    },
    additional: {
      cheminventoryLogged: true,
      sdsVersion: 'Current supplier SDS to be verified before work',
      sdsDate: '2026-05-30',
      storage: 'Storage groups generated by CAT must be checked against SDS sections 7 and 10 before use. Keep incompatible groups segregated and retain minimum stock.',
      incompatibles: 'Segregate acids/bases, flammables/oxidisers, cyanides/acids, water-reactives/water or aqueous wastes, and toxics from incompatible groups unless SDS confirms compatibility.',
      assignments,
    },
    emergency: {
      emergencyFirstAid: 'Use SDS Section 4 as definitive first-aid instruction. Move casualty away if safe, irrigate skin/eyes immediately for corrosive exposure, do not induce vomiting unless medically directed, seek urgent medical advice for toxic/CMR/reactive exposures and send SDS with casualty.',
      emergencySpills: 'Follow SDS Section 6 and the local spill procedure. Only trained staff may tackle small known spills with suitable PPE, ventilation and compatible spill media. Escalate for vapour, toxic, reactive, oxidising, cyanide, drain, fire or uncertainty concerns.',
      emergencyFire: 'Raise alarm and evacuate. Only trained staff may use extinguishers for very small incipient fires where SDS Section 5 confirms suitable media. Do not use water on water-reactive materials unless SDS/emergency responders confirm. Provide SDS and chemical inventory to responders.',
      wasteHandling: 'Collect waste in compatible, labelled, closed containers under secondary containment. Segregate incompatible waste streams; do not dispose to drain unless SDS/local procedure explicitly permits. Use approved hazardous-waste route.',
      other: 'Emergency shower, eyewash, spill kit and SDS access point must be confirmed before starting.',
    },
    briefing: [{ id: uuid(), name: 'Test user', date: '2026-05-30' }],
    meta: { createdAt: now, updatedAt: now, appVersion: '0.2.0' },
  };
}

async function runScenario(page, assessment, label, sections) {
  await page.goto(appUrl);
  await page.evaluate((raw) => {
    localStorage.clear();
    localStorage.setItem('cat.privacyAck', '1');
    localStorage.setItem('cat.activeAssessment', raw);
  }, JSON.stringify(assessment));
  await page.reload();
  await page.waitForLoadState('networkidle');

  const report = { sections: {} };

  for (const section of sections) {
    await page.locator('aside button').filter({ hasText: section }).click();
    await page.waitForTimeout(500);
    const slug = section.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await page.screenshot({ path: `${out}/${label}-${slug}.png`, fullPage: true });
    const text = await page.locator('main').innerText().catch(() => page.locator('body').innerText());
    report.sections[section] = { chars: text.length, text: text.slice(0, 8000) };
    if (section === 'Controls') {
      const checks = page.locator('main button[aria-pressed="false"]');
      while ((await checks.count()) > 0) {
        await checks.first().click();
      }
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${label}-controls-after-checks.png`, fullPage: true });
    }
  }

  report.exportButtons = await page.locator('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => /Export (PDF|DOCX)/.test(button.textContent || ''))
      .map((button) => ({
        text: (button.textContent || '').trim(),
        disabled: button.disabled,
        title: button.getAttribute('title'),
      })),
  );
  report.downloads = [];
  if (label === 'run-confirmed') {
    for (const name of ['Export PDF', 'Export DOCX']) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name }).click();
      const download = await downloadPromise;
      const suggested = download.suggestedFilename();
      const safeName = suggested.replace(/[^a-zA-Z0-9._-]/g, '_');
      const target = `${out}/${label}-${safeName}`;
      await download.saveAs(target);
      report.downloads.push({ button: name, suggestedFilename: suggested, savedAs: target });
    }
  }
  report.sidebar = await page.locator('aside button').evaluateAll((buttons) =>
    buttons.map((button) => ({
      text: (button.textContent || '').trim(),
      disabled: button.disabled,
      title: button.getAttribute('title'),
    })),
  );
  report.body = await page.locator('body').innerText();
  return report;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const firstFive = ['Overview', 'Process Steps', 'Non-Chemical Hazards', 'Controls', 'Storage'];
  const allSections = [
    'Overview',
    'Process Steps',
    'Non-Chemical Hazards',
    'Controls',
    'Storage',
    'Emergency Response',
    'Briefing & Sign-off',
    'Complete & Export',
  ];
  const unconfirmed = await runScenario(page, makeAssessment(false), 'run-unconfirmed', firstFive);
  const confirmed = await runScenario(page, makeAssessment(true), 'run-confirmed', allSections);

  const report = { errors, unconfirmed, confirmed };
  fs.writeFileSync(`${out}/coshh-15-run-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    pageErrors: errors,
    unconfirmedSidebar: unconfirmed.sidebar,
    unconfirmedExportButtons: unconfirmed.exportButtons,
    confirmedExportButtons: confirmed.exportButtons,
  }, null, 2));

  await browser.close();
})();
