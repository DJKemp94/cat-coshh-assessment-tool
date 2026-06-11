/**
 * Exploratory random audit for the Storage classifier.
 *
 * This complements the deterministic 200+ chemical regression suite. It samples
 * different CAMEO records on each run and applies priority-aware consistency
 * checks so multi-hazard chemicals are not flagged just because a lower-priority
 * group was overridden by oxidizer/special/corrosive handling.
 */
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const outdir = join(tmpdir(), 'cat-storage20-random-test');
const cameoOutfile = join(outdir, 'cameo-storage.mjs');
const classifierOutfile = join(outdir, 'storage20-classifier.mjs');
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [join(import.meta.dirname, '..', 'src', 'services', 'cameoStorage.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: cameoOutfile,
  tsconfig: join(import.meta.dirname, '..', 'tsconfig.json'),
  logLevel: 'error',
});

await build({
  entryPoints: [join(import.meta.dirname, '..', 'src', 'services', 'storage20Classifier.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: classifierOutfile,
  tsconfig: join(import.meta.dirname, '..', 'tsconfig.json'),
  logLevel: 'error',
});

const { cameoChemicals, cameoReactiveGroups, resolveCameoMatch, cameoMeta } = await import(`file://${cameoOutfile}?t=${Date.now()}`);
const { classifyStorage20, ZONES, CABINET_ORDER } = await import(`file://${classifierOutfile}?t=${Date.now()}`);

const SAMPLE_SIZE = 100;

function inferForm(cameoChemical) {
  const text = [cameoChemical.name, ...(cameoChemical.dotLabels ?? [])].join(' ').toLowerCase();
  if (/\b(solutions?|aqueous)\b/.test(text)) return 'liquid';
  if (/\b(grenades?|powder|solid|dry|wetted|granular|crystals?|pellets?|fume)\b/.test(text)) return 'solid';
  if (/\b(non[-\s]?flammable gas|gas mixture|compressed|liquefied gas)\b/.test(text)) return 'gas';
  return 'liquid';
}

function substanceFromCameo(cameoChemical, index) {
  return {
    id: `random-${index}`,
    name: cameoChemical.name,
    cas: cameoChemical.cas[0] ?? '',
    hazardStatements: [],
    ghsPictograms: [],
    wel: {},
    quantity: '',
    form: inferForm(cameoChemical),
    exposureDuration: '',
    exposureFrequency: '',
    exposureRoutes: { inhalation: false, skin: false, ingestion: false, eye: false },
    molecularFormula: cameoChemical.formulas?.[0] ?? '',
  };
}

function pickRandom(items, count) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function expectedZonesFor(match) {
  const groupIds = match.groups.map((group) => group.id);
  const has = (ids) => groupIds.some((id) => ids.includes(id));
  const labelText = [
    ...(match.cameo?.dotLabels ?? []),
    match.cameo?.specialHazards,
  ].filter(Boolean).join(' ').toLowerCase();
  const chemicalText = [
    match.chemical.name,
    match.cameo?.name,
  ].filter(Boolean).join(' ').toLowerCase();
  const hasFlammableLabel = /\bflammable|combustible\b/.test(labelText) && !/\bnon[-\s]?flammable\b/.test(labelText);
  const isSolid = ['solid', 'powder'].includes(match.chemical.form);
  const isGas = ['gas', 'vapour'].includes(match.chemical.form);
  const hasCompressedStorageEvidence = /\b(compressed gas|gas under pressure|gas cylinder|cylinder|liquefied gas|refrigerated liquid|cryogenic)\b/.test(chemicalText);

  if (isGas) return { zones: ['compressedGases', 'oxidizersOnly', 'volatilePoisonsChlorinated', 'specialReview'], reason: 'selected gas/vapour physical state' };
  if (hasCompressedStorageEvidence) return { zones: ['compressedGases', 'oxidizersOnly', 'volatilePoisonsChlorinated', 'specialReview'], reason: 'compressed/pressure package evidence' };
  if (has([107, 109, 108, 102, 103, 76, 21, 22, 35, 42, 51, 400, 30, 110, 106, 45, 105, 99])) return { zones: ['specialReview'], reason: 'hard-isolation reactive group' };
  if (has([2])) return { zones: ['oxidizingAcids'], reason: 'strong oxidizing acid group' };
  if (has([44, 104, 49, 27, 69])) return { zones: ['oxidizersOnly', 'oxidizingAcids'], reason: 'oxidizer group priority' };
  if (/\bacid\b/.test(chemicalText) && !/\b(esters?|salts?)\b/.test(chemicalText) && !/\bacid\s+(red|orange|yellow|blue|green|black|brown|violet)\b/.test(chemicalText)) return { zones: ['nonOxidizingAcids', 'oxidizingAcids', 'organicSolventsAcids'], reason: 'acid name/signal' };
  if (has([1, 2, 3, 37, 38, 40, 55, 59, 60, 71])) return { zones: ['nonOxidizingAcids', 'oxidizingAcids', 'organicSolventsAcids'], reason: 'acid group' };
  if (has([7, 10, 61, 68, 73])) return { zones: ['solidBases', 'liquidBases'], reason: 'base group' };
  if (has([6, 8, 9, 11, 12, 17, 18, 20, 25, 26, 31, 32, 33, 48, 72, 75])) {
    return { zones: isSolid ? ['dryPoisons', 'organicSolventsAcids'] : ['liquidPoisons', 'volatilePoisonsChlorinated', 'organicSolventsAcids'], reason: 'toxic group' };
  }
  if (hasFlammableLabel) return { zones: ['organicSolventsAcids', 'drySolids', 'specialReview'], reason: 'flammable transport/storage label' };
  if (has([4, 5, 13, 14, 16, 19, 28, 29, 34, 47, 58, 63, 64, 65, 66, 70, 101, 111])) {
    return { zones: isSolid ? ['drySolids', 'organicSolventsAcids'] : ['organicSolventsAcids', 'generalStorage', 'volatilePoisonsChlorinated'], reason: 'flammable/organic family' };
  }
  if (isSolid) return { zones: ['drySolids'], reason: 'low-trigger solid' };
  return { zones: ['generalStorage', 'review'], reason: 'low-trigger liquid' };
}

const candidates = cameoChemicals.filter((chemical) => chemical.id > 0);
const weighted = candidates.filter((chemical) => chemical.nfpa.flammability != null || chemical.nfpa.health != null || chemical.specialHazards || chemical.dotLabels.length > 0);
const fallback = candidates.filter((chemical) => !weighted.includes(chemical));
const sample = [
  ...pickRandom(weighted, Math.min(SAMPLE_SIZE, weighted.length)),
  ...pickRandom(fallback, Math.max(0, SAMPLE_SIZE - weighted.length)),
].slice(0, SAMPLE_SIZE);

const results = sample.map((cameoChemical, index) => {
  const match = resolveCameoMatch(substanceFromCameo(cameoChemical, index));
  return { cameoChemical, match, assignment: classifyStorage20(match) };
});

const counts = (values) => values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map());
const zoneCounts = counts(results.map(({ assignment }) => assignment.zoneId));
const cabinetCounts = counts(results.map(({ assignment }) => assignment.cabinetId));
const sourceCounts = counts(results.map(({ assignment }) => assignment.source));
const confidenceCounts = counts(results.map(({ assignment }) => assignment.confidence));

console.log(`\n=== Storage Random Audit (${results.length} chemicals) ===`);
console.log(`CAMEO database: ${cameoChemicals.length} chemicals, ${cameoReactiveGroups.length} reactive groups`);
console.log(`CAMEO metadata: ${cameoMeta.version ?? 'unknown'} (${cameoMeta.importDate ?? 'unknown import date'})`);

for (const [title, map] of [
  ['Zone distribution', zoneCounts],
  ['Cabinet distribution', cabinetCounts],
  ['Source distribution', sourceCounts],
  ['Confidence distribution', confidenceCounts],
]) {
  console.log(`\n── ${title} ──`);
  for (const [key, value] of [...map.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${value}`);
  }
}

const structuralIssues = [];
const heuristicWarnings = [];
for (const { cameoChemical, match, assignment } of results) {
  const expected = expectedZonesFor(match);
  const zone = ZONES[assignment.zoneId];
  const rowStructuralIssues = [];
  if (!zone) rowStructuralIssues.push(`unknown zone ${assignment.zoneId}`);
  if (zone && zone.cabinetId !== assignment.cabinetId) rowStructuralIssues.push(`zone ${assignment.zoneId} maps to ${zone.cabinetId}, cabinet was ${assignment.cabinetId}`);
  if (!CABINET_ORDER.includes(assignment.cabinetId)) rowStructuralIssues.push(`cabinet ${assignment.cabinetId} missing from CABINET_ORDER`);
  if (!assignment.reasons.length) rowStructuralIssues.push('missing assignment reason text');
  if (rowStructuralIssues.length > 0) {
    structuralIssues.push({ cameoChemical, match, assignment, rowIssues: rowStructuralIssues });
  }
  if (!expected.zones.includes(assignment.zoneId)) {
    heuristicWarnings.push({
      cameoChemical,
      match,
      assignment,
      rowIssues: [`expected one of ${expected.zones.join(', ')} for ${expected.reason}, got ${assignment.zoneId}`],
    });
  }
}

console.log('\n── Structural consistency checks ──');
if (structuralIssues.length === 0) {
  console.log(`  All ${results.length} sampled chemicals passed structural checks.`);
} else {
  for (const { cameoChemical, match, assignment, rowIssues } of structuralIssues) {
    const groups = match.groups.map((group) => group.id).join(', ') || 'none';
    console.log(`  FAIL [${cameoChemical.name}] groups=${groups}`);
    for (const issue of rowIssues) console.log(`      ${issue}`);
    console.log(`      assigned: ${assignment.zoneId} / ${assignment.cabinetId}`);
  }
}

console.log('\n── Heuristic priority warnings (non-failing audit) ──');
if (heuristicWarnings.length === 0) {
  console.log(`  No heuristic priority warnings in this sample.`);
} else {
  console.log(`  ${heuristicWarnings.length} sampled chemical${heuristicWarnings.length === 1 ? '' : 's'} differed from the broad audit heuristic.`);
  for (const { cameoChemical, match, assignment, rowIssues } of heuristicWarnings) {
    const groups = match.groups.map((group) => group.id).join(', ') || 'none';
    console.log(`  WARN [${cameoChemical.name}] groups=${groups}`);
    for (const issue of rowIssues) console.log(`      ${issue}`);
    console.log(`      assigned: ${assignment.zoneId} / ${assignment.cabinetId}`);
  }
}

console.log('\n── Detailed results ──');
for (const { cameoChemical, match, assignment } of results) {
  const groups = match.groups.map((group) => group.id).join(',') || 'none';
  console.log(`  ${cameoChemical.name.padEnd(58)} → ${assignment.zoneId.padEnd(28)} ${assignment.cabinetId.padEnd(16)} groups=${groups}`);
}

await rm(outdir, { recursive: true, force: true });
if (structuralIssues.length > 0) process.exit(1);
