/**
 * Fixture tests for PubChem GHS hazard-code extraction.
 *
 * Verifies the notifier-block policy: the first "GHS Hazard Statements" entry
 * is authoritative, minority blocks contribute ONLY storage-critical codes
 * (explosive / self-reactive / pyrophoric / water-reactive / oxidising / EUH
 * reaction codes) and never general toxicity codes.
 */
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const outdir = join(tmpdir(), 'cat-pubchem-ghs-test');
const outfile = join(outdir, 'pubchem.mjs');
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [join(import.meta.dirname, '..', 'src', 'services', 'pubchem.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  tsconfig: join(import.meta.dirname, '..', 'tsconfig.json'),
  logLevel: 'error',
});

const { extractGhsHazardCodes } = await import(`file://${outfile}?t=${Date.now()}`);

const statementsBlock = (strings) => ({
  Name: 'GHS Hazard Statements',
  Value: { StringWithMarkup: strings.map((s) => ({ String: s })) },
});

const ghsNode = (...infos) => [{ TOCHeading: 'GHS Classification', Information: infos }];

const failures = [];
function check(name, actualCodes, { expect = [], reject = [] }) {
  const codes = new Set(actualCodes.map((h) => h.code));
  for (const code of expect) {
    if (!codes.has(code)) failures.push(`${name}: expected ${code}, got [${[...codes].join(', ')}]`);
  }
  for (const code of reject) {
    if (codes.has(code)) failures.push(`${name}: must not contain ${code}, got [${[...codes].join(', ')}]`);
  }
}

// 1. Primary block is taken wholesale, including non-critical codes.
check('primary block wholesale', extractGhsHazardCodes(ghsNode(
  statementsBlock(['H225 (98.2%): Highly flammable liquid and vapour [Danger]', 'H319 (97%): Causes serious eye irritation [Warning]']),
)), { expect: ['H225', 'H319'] });

// 2. Minority water-reactive code is unioned in; minority toxicity code is not.
check('minority storage-critical union', extractGhsHazardCodes(ghsNode(
  statementsBlock(['H225 (95%): Highly flammable liquid and vapour [Danger]']),
  { Name: 'Pictogram(s)', Value: { StringWithMarkup: [{ String: '' }] } },
  statementsBlock(['H260 (4.1%): In contact with water releases flammable gases which may ignite spontaneously [Danger]', 'H301 (4.1%): Toxic if swallowed [Danger]']),
)), { expect: ['H225', 'H260'], reject: ['H301'] });

// 3. Minority oxidiser and EUH peroxide-former codes are unioned in.
check('minority oxidiser/EUH union', extractGhsHazardCodes(ghsNode(
  statementsBlock(['H314 (100%): Causes severe skin burns and eye damage [Danger]']),
  statementsBlock(['H272 (2%): May intensify fire; oxidizer [Warning]', 'EUH019 (2%): May form explosive peroxides', 'H350 (2%): May cause cancer [Danger]']),
)), { expect: ['H314', 'H272', 'EUH019'], reject: ['H350'] });

// 4. Duplicate codes across blocks are not repeated.
const dedup = extractGhsHazardCodes(ghsNode(
  statementsBlock(['H272 (90%): May intensify fire; oxidizer [Warning]']),
  statementsBlock(['H272 (10%): May intensify fire; oxidizer [Warning]']),
));
if (dedup.filter((h) => h.code === 'H272').length !== 1) failures.push('dedup: H272 appears more than once');

// 5. No GHS node at all → empty result.
check('no GHS data', extractGhsHazardCodes([]), { expect: [], reject: ['H225'] });
if (extractGhsHazardCodes([]).length !== 0) failures.push('no GHS data: expected empty result');

// 6. Multiple GHS Classification nodes (rare): later nodes are minority blocks.
check('second node treated as minority', extractGhsHazardCodes([
  ...ghsNode(statementsBlock(['H226 (99%): Flammable liquid and vapour [Warning]'])),
  ...ghsNode(statementsBlock(['EUH014 (1%): Reacts violently with water', 'H373 (1%): May cause damage to organs [Warning]'])),
]), { expect: ['H226', 'EUH014'], reject: ['H373'] });

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} GHS extraction issue${failures.length === 1 ? '' : 's'}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  await rm(outdir, { recursive: true, force: true });
  process.exit(1);
}

console.log('PASS: all PubChem GHS extraction fixture checks passed');
await rm(outdir, { recursive: true, force: true });
