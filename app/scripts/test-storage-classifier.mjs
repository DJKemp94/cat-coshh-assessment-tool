import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const outdir = join(tmpdir(), 'cat-storage-classifier-test');
const outfile = join(outdir, 'storageClassifier.mjs');
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [new URL('../src/services/storageClassifier.ts', import.meta.url).pathname],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  logLevel: 'silent',
});

const { classifyStorage, inferOrganic } = await import(`file://${outfile}?t=${Date.now()}`);

const substance = (patch) => ({
  id: patch.id ?? patch.name,
  name: patch.name,
  cas: patch.cas,
  pubchemCid: patch.pubchemCid ?? 1,
  hazardStatements: patch.hazardStatements ?? [],
  ghsPictograms: patch.ghsPictograms ?? [],
  wel: {},
  quantity: '',
  form: patch.form ?? 'liquid',
  exposureDuration: '',
  exposureFrequency: '',
  exposureRoutes: { inhalation: false, skin: false, ingestion: false, eye: false },
  molecularFormula: patch.molecularFormula,
  canonicalSmiles: patch.canonicalSmiles,
  connectivitySmiles: patch.connectivitySmiles,
  isomericSmiles: patch.isomericSmiles,
  inchi: patch.inchi,
  iupacName: patch.iupacName,
  pubchemTitle: patch.pubchemTitle,
});

const h = (code, text = code) => ({ code, text });

const cases = [
  {
    name: 'Sodium Hydroxide solid',
    chemical: substance({
      name: 'Sodium hydroxide',
      form: 'solid',
      molecularFormula: 'NaOH',
      hazardStatements: [h('H314')],
      ghsPictograms: ['corrosive'],
    }),
    groupId: '3',
    organic: false,
    hasSuggestion: 'group5SolidBase',
    lacksSuggestion: 'group5LiquidBase',
  },
  {
    name: 'Sodium Hydroxide solution',
    chemical: substance({
      name: 'Sodium hydroxide solution',
      form: 'liquid',
      molecularFormula: 'NaOH',
      hazardStatements: [h('H314')],
      ghsPictograms: ['corrosive'],
    }),
    groupId: '3',
    organic: false,
    hasSuggestion: 'group5LiquidBase',
  },
  {
    name: 'Acetic acid',
    chemical: substance({
      name: 'Acetic acid',
      form: 'liquid',
      molecularFormula: 'C2H4O2',
      hazardStatements: [h('H226'), h('H314')],
      ghsPictograms: ['flammable', 'corrosive'],
    }),
    groupId: '1',
    organic: true,
    hasSuggestion: 'group1Flammable',
  },
  {
    name: 'Hydrochloric acid',
    chemical: substance({
      name: 'Hydrochloric acid',
      form: 'liquid',
      molecularFormula: 'HCl',
      hazardStatements: [h('H314')],
      ghsPictograms: ['corrosive'],
    }),
    groupId: '2a',
    organic: false,
    hasSuggestion: 'group4NonOxidisingAcid',
  },
  {
    name: 'Nitric acid',
    chemical: substance({
      name: 'Nitric acid',
      form: 'liquid',
      molecularFormula: 'HNO3',
      hazardStatements: [h('H272'), h('H314')],
      ghsPictograms: ['oxidising', 'corrosive'],
    }),
    groupId: '4',
    organic: false,
    hasSuggestion: 'group3OxidisingAcid',
  },
  {
    name: 'Sodium carbonate',
    chemical: substance({
      name: 'Sodium carbonate',
      form: 'solid',
      molecularFormula: 'Na2CO3',
      hazardStatements: [h('H319')],
      ghsPictograms: ['harmful'],
    }),
    groupId: '3',
    organic: false,
    hasSuggestion: 'group5SolidBase',
  },
  {
    name: 'Chloroform',
    chemical: substance({
      name: 'Chloroform',
      form: 'liquid',
      molecularFormula: 'CHCl3',
      hazardStatements: [h('H351'), h('H331')],
      ghsPictograms: ['toxic', 'health-hazard'],
    }),
    groupId: '5b',
    organic: true,
    hasSuggestion: 'group2VolatilePoison',
  },
  {
    name: 'Sodium cyanide',
    chemical: substance({
      name: 'Sodium cyanide',
      form: 'solid',
      molecularFormula: 'CNNa',
      hazardStatements: [h('H300')],
      ghsPictograms: ['toxic'],
    }),
    groupId: '5a',
    organic: false,
    hasSuggestion: 'cyanide',
  },
  {
    name: 'Hydrogen peroxide',
    chemical: substance({
      name: 'Hydrogen peroxide',
      form: 'liquid',
      molecularFormula: 'H2O2',
      hazardStatements: [h('H272')],
      ghsPictograms: ['oxidising'],
    }),
    groupId: '4',
    organic: false,
    hasSuggestion: 'group6OxidiserPeroxide',
  },
];

for (const item of cases) {
  const result = classifyStorage(item.chemical);
  assert.equal(result.groupId, item.groupId, `${item.name}: storage group`);
  assert.equal(inferOrganic(item.chemical), item.organic, `${item.name}: organic/inorganic`);
  assert.equal(result.suggestionGroups.has(item.hasSuggestion), true, `${item.name}: expected ${item.hasSuggestion}`);
  if (item.lacksSuggestion) {
    assert.equal(result.suggestionGroups.has(item.lacksSuggestion), false, `${item.name}: unexpected ${item.lacksSuggestion}`);
  }
}

await rm(outdir, { recursive: true, force: true });
console.log(`storage classifier regression passed (${cases.length} cases)`);
