/**
 * Random-sample test for Storage 2.0 classifier.
 * Picks 50 random CAMEO chemicals, runs them through the full classifier,
 * and reports zone/cabinet/confidence/source distributions plus logical
 * consistency checks.
 */
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

/* ── 1. Bundle all the services we need ─────────────────────────────── */
const outdir = join(tmpdir(), 'cat-storage20-random-test');
const outfile = join(outdir, 'bundle.mjs');
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [
    join(import.meta.dirname, '..', 'src', 'services', 'cameoStorage.ts'),
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  tsconfig: join(import.meta.dirname, '..', 'tsconfig.json'),
  logLevel: 'error',
});

/* ── 2. Also build the classifiers separately ───────────────────────── */
const classifierOutfile = join(outdir, 'classifier.mjs');
await build({
  entryPoints: [join(import.meta.dirname, '..', 'src', 'services', 'storage20Classifier.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: classifierOutfile,
  tsconfig: join(import.meta.dirname, '..', 'tsconfig.json'),
  logLevel: 'error',
});

const { cameoChemicals, cameoReactiveGroups, resolveCameoMatch, cameoMeta } = await import(`file://${outfile}?t=${Date.now()}`);
const { classifyStorage20 } = await import(`file://${classifierOutfile}?t=${Date.now()}`);

/* ── 3. Helper: build a Substance from CAMEO data ───────────────────── */
function substanceFromCameo(cameoChem, index) {
  return {
    id: `test-${index}`,
    pubchemCid: undefined,
    name: cameoChem.name,
    cas: cameoChem.cas[0] ?? '',
    hazardStatements: [],  // CAMEO chemicals don't carry GHS H-codes
    ghsPictograms: [],
    wel: {},
    quantity: '',
    form: 'liquid',
    exposureDuration: '',
    exposureFrequency: '',
    exposureRoutes: { inhalation: false, skin: false, ingestion: false, eye: false },
    molecularFormula: cameoChem.formulas?.[0] ?? '',
    canonicalSmiles: undefined,
    connectivitySmiles: undefined,
    isomericSmiles: undefined,
    inchi: undefined,
    iupacName: undefined,
    pubchemTitle: undefined,
  };
}

/* ── 4. Pick 50 random chemicals with some data ─────────────────────── */
const candidates = cameoChemicals.filter((c) => {
  // Must have at least one reactive group
  return c.id > 0;
});

// Weighted random: prefer chemicals with NFPA data and reactive groups for better test signal
const weighted = candidates.filter((c) => c.nfpa.flammability != null || c.nfpa.health != null || c.specialHazards);
const fallback = candidates.filter((c) => !weighted.includes(c));

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const sampleSize = 50;
const fromWeighted = pickRandom(weighted, Math.min(sampleSize, weighted.length));
const remaining = sampleSize - fromWeighted.length;
const fromFallback = remaining > 0 ? pickRandom(fallback, remaining) : [];
const sample = [...fromWeighted, ...fromFallback];

console.log(`\n=== Storage 2.0 Random-Sample Test (${sample.length} chemicals) ===\n`);
console.log(`CAMEO database: ${cameoChemicals.length} chemicals, ${cameoReactiveGroups.length} reactive groups`);

/* ── 5. Run the classifier on each ──────────────────────────────────── */
const results = sample.map((cameoChem, i) => {
  const substance = substanceFromCameo(cameoChem, i);
  const match = resolveCameoMatch(substance);
  const assignment = classifyStorage20(match);
  return { cameoChem, match, assignment };
});

/* ── 6. Aggregate and report ────────────────────────────────────────── */
const zoneCounts = {};
const cabinetCounts = {};
const confidenceCounts = {};
const sourceCounts = {};
const categoryCounts = {};

for (const { assignment } of results) {
  zoneCounts[assignment.zoneId] = (zoneCounts[assignment.zoneId] || 0) + 1;
  cabinetCounts[assignment.cabinetId] = (cabinetCounts[assignment.cabinetId] || 0) + 1;
  confidenceCounts[assignment.confidence] = (confidenceCounts[assignment.confidence] || 0) + 1;
  sourceCounts[assignment.source] = (sourceCounts[assignment.source] || 0) + 1;
  categoryCounts[assignment.category] = (categoryCounts[assignment.category] || 0) + 1;
}

console.log(`\n── Zone distribution ──`);
for (const [zone, count] of Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${zone}: ${count}`);
}

console.log(`\n── Cabinet distribution ──`);
for (const [cabinet, count] of Object.entries(cabinetCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cabinet}: ${count}`);
}

console.log(`\n── Confidence distribution ──`);
for (const [level, count] of Object.entries(confidenceCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${level}: ${count}`);
}

console.log(`\n── Source distribution ──`);
for (const [source, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${source}: ${count}`);
}

/* ── 7. Logical consistency checks ──────────────────────────────────── */
console.log(`\n── Logical consistency checks ──`);

let issues = 0;
let consistencyOk = 0;

for (const { cameoChem, match, assignment } of results) {
  const groupIds = match.groups.map((g) => g.id);
  const isAcidGroup = groupIds.some((id) => [1, 2, 3, 37, 38, 40, 55, 59, 60, 71].includes(id));
  const isBaseGroup = groupIds.some((id) => [7, 10, 39, 61, 68, 73].includes(id));
  const isOxidizerGroup = groupIds.some((id) => [44, 104, 49, 27, 69].includes(id));
  const isWaterReactiveGroup = groupIds.some((id) => [107, 21, 22, 35, 42, 51, 108].includes(id));
  const isPyrophoricGroup = groupIds.some((id) => [109].includes(id));
  const isFlammableOrganicGroup = groupIds.some((id) => [4, 5, 13, 14, 16, 19, 28, 29, 34, 47, 58, 63, 64, 65, 66, 70, 101, 111].includes(id));
  const isToxinGroup = groupIds.some((id) => [6, 8, 9, 11, 12, 17, 18, 20, 25, 26, 31, 32, 33, 48, 72, 75].includes(id));
  const isSpecialGroup = groupIds.some((id) => [107, 109, 108, 102, 103, 76, 21, 22, 35, 42, 51, 400, 30, 110, 106, 45, 50, 105, 99].includes(id));

  let rowIssues = [];

  // Check: water-reactive group → specialReview zone
  if (isWaterReactiveGroup && assignment.zoneId !== 'specialReview') {
    rowIssues.push(`Water-reactive group(s) but assigned to ${assignment.zoneId}`);
  }

  // Check: oxidizer group → oxidizer zone
  if (isOxidizerGroup && !['oxidizersOnly', 'oxidizingAcids'].includes(assignment.zoneId) && assignment.zoneId !== 'specialReview') {
    rowIssues.push(`Oxidizer group(s) but assigned to ${assignment.zoneId}`);
  }

  // Check: acid group → acid zone
  if (isAcidGroup && !['nonOxidizingAcids', 'oxidizingAcids', 'organicSolventsAcids'].includes(assignment.zoneId) && assignment.zoneId !== 'specialReview') {
    rowIssues.push(`Acid group(s) but assigned to ${assignment.zoneId}`);
  }

  // Check: base group → base zone
  if (isBaseGroup && !['solidBases', 'liquidBases'].includes(assignment.zoneId) && assignment.zoneId !== 'specialReview') {
    rowIssues.push(`Base group(s) but assigned to ${assignment.zoneId}`);
  }

  // Check: flammable organic group → organicSolventsAcids or specialReview
  if (isFlammableOrganicGroup && !['organicSolventsAcids', 'specialReview', 'organicAcids', 'nonOxidizingAcids'].includes(assignment.zoneId)) {
    rowIssues.push(`Flammable organic group(s) but assigned to ${assignment.zoneId}`);
  }

  // Check: special group → specialReview
  if (isSpecialGroup && assignment.zoneId !== 'specialReview') {
    rowIssues.push(`Special reactive group(s) assigned to ${assignment.zoneId} (not specialReview)`);
  }

  // Check: review zone should have match confidence review
  if (assignment.zoneId === 'review' && assignment.confidence !== 'review') {
    rowIssues.push(`review zone but confidence=${assignment.confidence}`);
  }

  if (rowIssues.length > 0) {
    issues++;
    console.log(`  ⚠  [${cameoChem.name}] (groups: ${groupIds.join(', ')})`);
    for (const issue of rowIssues) {
      console.log(`       ${issue}`);
    }
    console.log(`       → assigned to: ${assignment.zoneId} (cabinet: ${assignment.cabinetId}, conf: ${assignment.confidence})`);
  } else {
    consistencyOk++;
  }
}

console.log(`\nConsistency: ${consistencyOk}/${sample.length} checks passed, ${issues} with issues`);

/* ── 8. Detailed breakdown ──────────────────────────────────────────── */
console.log(`\n── Detailed results ──`);
const ZONE_LABELS = {
  organicSolventsAcids: 'OrgSolvents+Acids',
  volatilePoisonsChlorinated: 'VolatilePoisons',
  nonOxidizingAcids: 'NonOxidizingAcids',
  oxidizingAcids: 'OxidizingAcids',
  solidBases: 'SolidBases',
  liquidBases: 'LiquidBases',
  oxidizersOnly: 'Oxidizers',
  dryPoisons: 'DryPoisons',
  liquidPoisons: 'LiquidPoisons',
  drySolids: 'DrySolids',
  specialReview: 'SpecialReview',
  review: 'Review',
};

for (const { cameoChem, match, assignment } of results) {
  const groups = match.groups.map((g) => g.id).join(',') || 'none';
  const cameoName = match.cameo?.name ?? '—';
  console.log(`  ${cameoChem.name.padEnd(50)} → ${(ZONE_LABELS[assignment.zoneId] ?? assignment.zoneId).padEnd(20)} [${assignment.confidence.padEnd(6)}] src=${assignment.source.padEnd(10)} groups=${groups}`);
}

/* ── 9. Cleanup ─────────────────────────────────────────────────────── */
await rm(outdir, { recursive: true, force: true });
