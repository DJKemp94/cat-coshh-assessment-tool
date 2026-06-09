/**
 * Deterministic 150-chemical regression test for the Storage classifier.
 *
 * The sample is stratified across low-hazard, flammable, corrosive, oxidising,
 * toxic, compressed-gas and hard-isolation materials. A fixed seed keeps the
 * "random" CAMEO portion stable so this can be used as a regression gate.
 */
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const outdir = join(tmpdir(), 'cat-storage20-regression-test');
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

const {
  cameoChemicals,
  cameoReactiveGroups,
  resolveCameoMatch,
  cameoMeta,
} = await import(`file://${cameoOutfile}?t=${Date.now()}`);
const {
  classifyStorage20,
  ZONES,
  CABINET_ORDER,
} = await import(`file://${classifierOutfile}?t=${Date.now()}`);

const H_TEXT = {
  H220: 'Extremely flammable gas',
  H222: 'Extremely flammable aerosol',
  H225: 'Highly flammable liquid and vapour',
  H226: 'Flammable liquid and vapour',
  H228: 'Flammable solid',
  H250: 'Catches fire spontaneously if exposed to air',
  H251: 'Self-heating; may catch fire',
  H260: 'In contact with water releases flammable gases which may ignite spontaneously',
  H270: 'May cause or intensify fire; oxidizer',
  H271: 'May cause fire or explosion; strong oxidizer',
  H272: 'May intensify fire; oxidizer',
  H280: 'Contains gas under pressure; may explode if heated',
  H281: 'Contains refrigerated gas; may cause cryogenic burns or injury',
  H290: 'May be corrosive to metals',
  H300: 'Fatal if swallowed',
  H301: 'Toxic if swallowed',
  H302: 'Harmful if swallowed',
  H304: 'May be fatal if swallowed and enters airways',
  H310: 'Fatal in contact with skin',
  H311: 'Toxic in contact with skin',
  H312: 'Harmful in contact with skin',
  H314: 'Causes severe skin burns and eye damage',
  H317: 'May cause an allergic skin reaction',
  H319: 'Causes serious eye irritation',
  H330: 'Fatal if inhaled',
  H331: 'Toxic if inhaled',
  H332: 'Harmful if inhaled',
  H334: 'May cause allergy or asthma symptoms or breathing difficulties if inhaled',
  H335: 'May cause respiratory irritation',
  H336: 'May cause drowsiness or dizziness',
  H341: 'Suspected of causing genetic defects',
  H350: 'May cause cancer',
  H351: 'Suspected of causing cancer',
  H400: 'Very toxic to aquatic life',
};

const FIXED_CASES = [
  { name: 'Sucrose', cas: '57-50-1', form: 'solid', formula: 'C12H22O11', expectedZone: 'drySolids', expectedCabinet: 'shelving' },
  { name: 'Water', cas: '7732-18-5', form: 'liquid', formula: 'H2O', bp: 100, expectedZone: 'generalStorage', expectedCabinet: 'shelving' },
  { name: 'Nitrogen, compressed', cas: '7727-37-9', form: 'gas', pictograms: ['compressed-gas'], formNote: 'compressed gas', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'Phenol', cas: '108-95-2', form: 'solid', codes: ['H301', 'H311', 'H314', 'H331'], pictograms: ['toxic', 'corrosive'], expectedZone: 'dryPoisons', expectedCabinet: 'toxins' },
  { name: 'Ethanol', cas: '64-17-5', form: 'liquid', codes: ['H225'], pictograms: ['flammable'], bp: 78, volatility: 'high', expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'Acetone', cas: '67-64-1', form: 'liquid', codes: ['H225', 'H319'], pictograms: ['flammable', 'harmful'], bp: 56, volatility: 'high', expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'Chloroform', cas: '67-66-3', form: 'liquid', codes: ['H302', 'H331', 'H351'], pictograms: ['toxic', 'health-hazard'], bp: 61, volatility: 'high', expectedZone: 'volatilePoisonsChlorinated', expectedCabinet: 'volatilePoisons' },
  { name: 'Dichloromethane', cas: '75-09-2', form: 'liquid', codes: ['H351'], pictograms: ['health-hazard'], bp: 40, volatility: 'high', expectedZone: 'volatilePoisonsChlorinated', expectedCabinet: 'volatilePoisons' },
  { name: 'Calcium carbide', cas: '75-20-7', form: 'solid', codes: ['H260'], pictograms: ['flammable'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
  { name: 'Formaldehyde solution', cas: '50-00-0', form: 'liquid', codes: ['H301', 'H311', 'H314', 'H317', 'H331', 'H350'], pictograms: ['toxic', 'corrosive', 'health-hazard'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
  { name: 'Glycerol', cas: '56-81-5', form: 'liquid', bp: 290, formula: 'C3H8O3', expectedZone: 'generalStorage', expectedCabinet: 'shelving' },
  { name: 'Hexane', cas: '110-54-3', form: 'liquid', codes: ['H225', 'H304'], pictograms: ['flammable', 'health-hazard'], bp: 69, volatility: 'high', expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'Sulfuric acid', cas: '7664-93-9', form: 'liquid', codes: ['H314'], pictograms: ['corrosive'], expectedZone: 'oxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'Sodium nitrate', cas: '7631-99-4', form: 'solid', codes: ['H272'], pictograms: ['oxidising'], expectedZone: 'oxidizersOnly', expectedCabinet: 'oxidizers' },
  { name: 'Sodium cyanide', cas: '143-33-9', form: 'solid', codes: ['H300', 'H310', 'H330'], pictograms: ['toxic'], expectedZone: 'dryPoisons', expectedCabinet: 'toxins' },
  { name: 'Lithium aluminium hydride', cas: '16853-85-3', form: 'solid', codes: ['H260'], pictograms: ['flammable'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
  { name: 'Acetonitrile', cas: '75-05-8', form: 'liquid', codes: ['H225', 'H302', 'H312', 'H332'], pictograms: ['flammable', 'harmful'], bp: 82, volatility: 'high', expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'Potassium iodide', cas: '7681-11-0', form: 'solid', expectedZone: 'drySolids', expectedCabinet: 'shelving' },
  { name: 'Hydrogen', cas: '1333-74-0', form: 'gas', codes: ['H220'], pictograms: ['flammable', 'compressed-gas'], formNote: 'compressed gas', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'Sodium borohydride', cas: '16940-66-2', form: 'solid', codes: ['H260'], pictograms: ['flammable'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
];

const GHS_ONLY_CASES = [
  { name: 'NC Neutral buffer concentrate', form: 'liquid', expectedZone: 'generalStorage', expectedCabinet: 'shelving' },
  { name: 'NC Calibration saline', form: 'liquid', expectedZone: 'generalStorage', expectedCabinet: 'shelving' },
  { name: 'NC Polymer beads', form: 'solid', expectedZone: 'drySolids', expectedCabinet: 'shelving' },
  { name: 'NC Ceramic granules', form: 'powder', expectedZone: 'drySolids', expectedCabinet: 'shelving' },
  { name: 'NC Mineral filler powder', form: 'powder', codes: ['H319'], pictograms: ['harmful'], expectedZone: 'drySolids', expectedCabinet: 'shelving' },
  { name: 'NC Lab solvent blend A', form: 'liquid', codes: ['H225'], pictograms: ['flammable'], volatility: 'high', bp: 64, expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Cleaning solvent low flash', form: 'liquid', codes: ['H226'], pictograms: ['flammable'], volatility: 'medium', bp: 118, expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Flammable resin solution', form: 'liquid', codes: ['H225', 'H319'], pictograms: ['flammable', 'harmful'], expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Aerosol degreaser', form: 'aerosol', codes: ['H222', 'H336'], pictograms: ['flammable', 'harmful'], expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Flammable powder additive', form: 'solid', codes: ['H228'], pictograms: ['flammable'], expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Organic peroxide initiator', form: 'liquid', codes: ['H242'], pictograms: ['flammable'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
  { name: 'NC Diesel like process oil', form: 'liquid', codes: ['H226'], pictograms: ['flammable'], volatility: 'medium', bp: 180, expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Hydrochloric process acid', form: 'liquid', codes: ['H314'], pictograms: ['corrosive'], expectedZone: 'nonOxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC Acetic acid cleaning blend', form: 'liquid', codes: ['H226', 'H314'], pictograms: ['flammable', 'corrosive'], formula: 'C2H4O2', expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Nitric acid etch', form: 'liquid', codes: ['H272', 'H314'], pictograms: ['oxidising', 'corrosive'], expectedZone: 'oxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC Citric acid granules', form: 'solid', codes: ['H319'], pictograms: ['harmful'], formula: 'C6H8O7', expectedZone: 'nonOxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC Phosphoric acid cleaner', form: 'liquid', codes: ['H314'], pictograms: ['corrosive'], expectedZone: 'nonOxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC Peracetic acid sanitizer', form: 'liquid', codes: ['H272', 'H314'], pictograms: ['oxidising', 'corrosive'], formula: 'C2H4O3', expectedZone: 'oxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC Sodium hydroxide process liquor', form: 'liquid', codes: ['H314'], pictograms: ['corrosive'], expectedZone: 'liquidBases', expectedCabinet: 'corrosiveBases' },
  { name: 'NC Potassium hydroxide pellets', form: 'solid', codes: ['H314'], pictograms: ['corrosive'], expectedZone: 'solidBases', expectedCabinet: 'corrosiveBases' },
  { name: 'NC Ammonia cleaning solution', form: 'liquid', codes: ['H314'], pictograms: ['corrosive'], expectedZone: 'liquidBases', expectedCabinet: 'corrosiveBases' },
  { name: 'NC Alkali wash concentrate', form: 'liquid', codes: ['H290'], pictograms: ['corrosive'], expectedZone: 'liquidBases', expectedCabinet: 'corrosiveBases' },
  { name: 'NC Amine hardener', form: 'liquid', codes: ['H314'], pictograms: ['corrosive'], expectedZone: 'liquidBases', expectedCabinet: 'corrosiveBases' },
  { name: 'NC Solid base pellets', form: 'solid', codes: ['H314'], pictograms: ['corrosive'], expectedZone: 'solidBases', expectedCabinet: 'corrosiveBases' },
  { name: 'NC Oxidising salt blend', form: 'solid', codes: ['H272'], pictograms: ['oxidising'], expectedZone: 'oxidizersOnly', expectedCabinet: 'oxidizers' },
  { name: 'NC Peroxide disinfectant', form: 'liquid', codes: ['H272'], pictograms: ['oxidising'], expectedZone: 'oxidizersOnly', expectedCabinet: 'oxidizers' },
  { name: 'NC Nitrate fertiliser', form: 'solid', codes: ['H272'], pictograms: ['oxidising'], expectedZone: 'oxidizersOnly', expectedCabinet: 'oxidizers' },
  { name: 'NC Chlorate process solid', form: 'solid', codes: ['H271'], pictograms: ['oxidising'], expectedZone: 'oxidizersOnly', expectedCabinet: 'oxidizers' },
  { name: 'NC Oxygen enriched gas mixture', form: 'gas', codes: ['H270'], pictograms: ['oxidising', 'compressed-gas'], expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Carbon dioxide cylinder', form: 'gas', codes: ['H280'], pictograms: ['compressed-gas'], formNote: 'gas cylinder', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Oxygen cylinder', form: 'gas', codes: ['H270', 'H280'], pictograms: ['oxidising', 'compressed-gas'], formNote: 'compressed gas cylinder', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Propane cylinder', form: 'gas', codes: ['H220', 'H280'], pictograms: ['flammable', 'compressed-gas'], formNote: 'gas cylinder', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Ammonia gas cylinder', form: 'gas', codes: ['H280', 'H314', 'H331'], pictograms: ['compressed-gas', 'corrosive', 'toxic'], formNote: 'compressed gas cylinder', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Sulfur dioxide cylinder', form: 'gas', codes: ['H280', 'H314', 'H331'], pictograms: ['compressed-gas', 'corrosive', 'toxic'], formNote: 'compressed gas cylinder', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Liquid nitrogen dewar', form: 'liquid', codes: ['H281'], pictograms: ['compressed-gas'], formNote: 'refrigerated liquid cryogenic dewar', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Dry ice loose solid', form: 'solid', codes: ['H280'], pictograms: ['compressed-gas'], pubchemPhysicalForm: 'gas', expectedZone: 'drySolids', expectedCabinet: 'shelving' },
  { name: 'NC Hydrochloric acid solution inherited gas pictogram', form: 'liquid', codes: ['H280', 'H314', 'H335'], pictograms: ['compressed-gas', 'corrosive', 'harmful'], pubchemTitle: 'Hydrogen chloride', pubchemPhysicalForm: 'gas', expectedZone: 'nonOxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC Hydrofluoric acid solution inherited gas pictogram', form: 'liquid', codes: ['H280', 'H300', 'H310', 'H314'], pictograms: ['compressed-gas', 'toxic', 'corrosive'], pubchemTitle: 'Hydrogen fluoride', pubchemPhysicalForm: 'gas', expectedZone: 'nonOxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC Aerosol disinfectant with gas pictogram', form: 'aerosol', codes: ['H222'], pictograms: ['flammable', 'compressed-gas'], expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Toxic process intermediate', form: 'liquid', codes: ['H301'], pictograms: ['toxic'], expectedZone: 'liquidPoisons', expectedCabinet: 'toxins' },
  { name: 'NC Fatal dust', form: 'powder', codes: ['H300'], pictograms: ['toxic'], expectedZone: 'dryPoisons', expectedCabinet: 'toxins' },
  { name: 'NC Toxic gas cylinder', form: 'gas', codes: ['H330'], pictograms: ['toxic', 'compressed-gas'], formNote: 'compressed gas', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Carcinogenic liquid', form: 'liquid', codes: ['H350'], pictograms: ['health-hazard'], expectedZone: 'liquidPoisons', expectedCabinet: 'toxins' },
  { name: 'NC Mutagenic powder', form: 'solid', codes: ['H341'], pictograms: ['health-hazard'], expectedZone: 'dryPoisons', expectedCabinet: 'toxins' },
  { name: 'NC Cyanide plating salt', form: 'solid', codes: ['H300'], pictograms: ['toxic'], expectedZone: 'dryPoisons', expectedCabinet: 'toxins' },
  { name: 'NC Sulfide process solid', form: 'solid', codes: ['H301'], pictograms: ['toxic'], expectedZone: 'dryPoisons', expectedCabinet: 'toxins' },
  { name: 'NC Halogenated solvent blend', form: 'liquid', codes: ['H351'], pictograms: ['health-hazard'], bp: 72, volatility: 'high', expectedZone: 'volatilePoisonsChlorinated', expectedCabinet: 'volatilePoisons' },
  { name: 'NC Chlorinated solvent waste', form: 'liquid', codes: ['H302'], pictograms: ['harmful'], bp: 84, volatility: 'high', expectedZone: 'volatilePoisonsChlorinated', expectedCabinet: 'volatilePoisons' },
  { name: 'NC Argon cylinder', form: 'gas', pictograms: ['compressed-gas'], formNote: 'compressed gas', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Refrigerated process gas', form: 'liquid', pictograms: ['compressed-gas'], formNote: 'refrigerated liquid cryogenic', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Nonflammable calibration gas', form: 'gas', pictograms: ['compressed-gas'], formNote: 'compressed gas', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Flammable gas cartridge', form: 'gas', codes: ['H220'], pictograms: ['flammable', 'compressed-gas'], formNote: 'compressed gas', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Water reactive metal powder', form: 'powder', codes: ['H260'], pictograms: ['flammable'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
  { name: 'NC Pyrophoric catalyst', form: 'solid', codes: ['H250'], pictograms: ['flammable'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
  { name: 'NC Explosive research sample', form: 'solid', codes: ['H201'], pictograms: ['explosive'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
  { name: 'NC Self heating solid', form: 'solid', codes: ['H251'], pictograms: ['flammable'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
  { name: 'NC Air reactive reagent', form: 'liquid', codes: ['H250'], pictograms: ['flammable'], expectedZone: 'specialReview', expectedCabinet: 'specialReview' },
  { name: 'NC Irritant dye solution', form: 'liquid', codes: ['H319'], pictograms: ['harmful'], expectedZone: 'generalStorage', expectedCabinet: 'shelving' },
  { name: 'NC Nuisance dust powder', form: 'powder', codes: ['H335'], pictograms: ['harmful'], expectedZone: 'drySolids', expectedCabinet: 'shelving' },
  { name: 'NC Environmental sample preservative', form: 'liquid', codes: ['H400'], pictograms: ['environmental'], expectedZone: 'generalStorage', expectedCabinet: 'shelving' },
  { name: 'NC Hydrogen chloride gas cylinder', form: 'gas', codes: ['H314', 'H331'], pictograms: ['compressed-gas', 'corrosive', 'toxic'], formNote: 'compressed gas', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Hydrogen chloride gas without pressure package', form: 'gas', codes: ['H280', 'H314', 'H331'], pictograms: ['compressed-gas', 'corrosive', 'toxic'], expectedZone: 'nonOxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC Hydrochloric acid PubChem gas artefact', form: 'liquid', codes: ['H280', 'H314', 'H335'], pictograms: ['compressed-gas', 'corrosive', 'harmful'], pubchemTitle: 'Hydrogen chloride', pubchemPhysicalForm: 'gas', pubchemPhysicalDescription: 'Colorless gas with a pungent odor.', expectedZone: 'nonOxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC Hydrogen fluoride gas cylinder', form: 'gas', codes: ['H300', 'H310', 'H330', 'H314'], pictograms: ['compressed-gas', 'toxic', 'corrosive'], formNote: 'compressed gas', expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC Chlorobenzene solvent', form: 'liquid', codes: ['H226', 'H332'], pictograms: ['flammable', 'harmful'], bp: 132, volatility: 'medium', expectedZone: 'volatilePoisonsChlorinated', expectedCabinet: 'volatilePoisons' },
  { name: 'NC 1,2-dichloroethane solvent', form: 'liquid', codes: ['H225', 'H302', 'H315', 'H319', 'H331', 'H350'], pictograms: ['flammable', 'toxic', 'health-hazard'], bp: 84, volatility: 'high', expectedZone: 'volatilePoisonsChlorinated', expectedCabinet: 'volatilePoisons' },
  { name: 'NC Glacial acetic acid', form: 'liquid', codes: ['H226', 'H314'], pictograms: ['flammable', 'corrosive'], formula: 'C2H4O2', expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Formic acid', form: 'liquid', codes: ['H226', 'H314'], pictograms: ['flammable', 'corrosive'], formula: 'CH2O2', expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables' },
  { name: 'NC Triethylamine', form: 'liquid', codes: ['H225', 'H302', 'H311', 'H314', 'H331'], pictograms: ['flammable', 'toxic', 'corrosive'], formula: 'C6H15N', expectedZone: 'liquidBases', expectedCabinet: 'corrosiveBases' },
  { name: 'NC Ethanolamine', form: 'liquid', codes: ['H302', 'H312', 'H314'], pictograms: ['corrosive', 'harmful'], formula: 'C2H7NO', expectedZone: 'liquidBases', expectedCabinet: 'corrosiveBases' },
  { name: 'NC Piperidine', form: 'liquid', codes: ['H225', 'H301', 'H311', 'H314', 'H331'], pictograms: ['flammable', 'toxic', 'corrosive'], formula: 'C5H11N', expectedZone: 'liquidBases', expectedCabinet: 'corrosiveBases' },
  { name: 'NC Ammonium nitrate', form: 'solid', codes: ['H272', 'H319'], pictograms: ['oxidising', 'harmful'], expectedZone: 'oxidizersOnly', expectedCabinet: 'oxidizers' },
  { name: 'NC Nitric acid concentrated', form: 'liquid', codes: ['H272', 'H314'], pictograms: ['oxidising', 'corrosive'], expectedZone: 'oxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC PubChem ethanol flash only', form: 'liquid', formula: 'C2H6O', flash: 13, expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables', expectedEvidence: 'flash point' },
  { name: 'NC PubChem combustible organic liquid', form: 'liquid', formula: 'C8H18O', flash: 72, expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables', expectedEvidence: 'combustible-liquid' },
  { name: 'NC PubChem NFPA flammable liquid', form: 'liquid', formula: 'C3H6O', nfpa: { flammability: 3, health: 1, reactivity: 0 }, expectedZone: 'organicSolventsAcids', expectedCabinet: 'flammables', expectedEvidence: 'NFPA flammability 3' },
  { name: 'NC PubChem sucrose solid with boiling data', form: 'solid', formula: 'C12H22O11', bp: 120, expectedZone: 'drySolids', expectedCabinet: 'shelving' },
  { name: 'NC PubChem high vapour nonflammable liquid', form: 'liquid', formula: 'CF4', vapourPressure: 250, expectedZone: 'generalStorage', expectedCabinet: 'shelving' },
  { name: 'NC PubChem chloroform volatile evidence', form: 'liquid', formula: 'CHCl3', flash: 18, vapourPressure: 21.2, pubchemTitle: 'Chloroform', expectedZone: 'volatilePoisonsChlorinated', expectedCabinet: 'volatilePoisons' },
  { name: 'NC PubChem dichloromethane volatile evidence', form: 'liquid', formula: 'CH2Cl2', flash: 25, vapourPressure: 58, pubchemTitle: 'Dichloromethane', expectedZone: 'volatilePoisonsChlorinated', expectedCabinet: 'volatilePoisons' },
  { name: 'NC PubChem nitric acid flash conflict', form: 'liquid', codes: ['H272', 'H314'], pictograms: ['oxidising', 'corrosive'], flash: 20, expectedZone: 'oxidizingAcids', expectedCabinet: 'corrosiveAcids' },
  { name: 'NC PubChem hydrogen peroxide flash conflict', form: 'liquid', codes: ['H272'], pictograms: ['oxidising'], flash: 20, expectedZone: 'oxidizersOnly', expectedCabinet: 'oxidizers' },
  { name: 'NC PubChem gas cylinder with flammable evidence', form: 'gas', codes: ['H220'], pictograms: ['flammable', 'compressed-gas'], formNote: 'compressed gas', formula: 'C3H8', flash: -104, nfpa: { flammability: 4, health: 1, reactivity: 0 }, expectedZone: 'compressedGases', expectedCabinet: 'compressedGas' },
  { name: 'NC PubChem physical state conflict', form: 'liquid', formula: 'NaCl', pubchemPhysicalForm: 'solid', pubchemPhysicalDescription: 'White crystalline solid.', expectedZone: 'generalStorage', expectedCabinet: 'shelving', expectedConstraint: 'physical state check' },
];

const GROUP_SETS = {
  lowHazard: new Set([23, 46, 62, 98, 100]),
  flammable: new Set([4, 5, 13, 14, 16, 19, 28, 29, 63, 64, 65, 66, 70, 101, 111]),
  acids: new Set([1, 2, 3, 37, 38, 40, 55, 59, 60, 71]),
  bases: new Set([7, 10, 61, 68, 73]),
  oxidizers: new Set([27, 44, 49, 69, 104]),
  toxins: new Set([6, 8, 9, 11, 12, 17, 18, 20, 25, 26, 31, 32, 33, 48, 72, 75]),
  special: new Set([21, 22, 30, 35, 42, 45, 51, 76, 99, 102, 103, 105, 106, 107, 108, 109, 110, 400]),
};

const STRATA = [
  { name: 'lowHazard', count: 12, predicate: (groups) => hasGroup(groups, GROUP_SETS.lowHazard) && !hasAnyGroup(groups, [GROUP_SETS.special, GROUP_SETS.oxidizers, GROUP_SETS.toxins]) },
  { name: 'flammable', count: 12, predicate: (groups) => hasGroup(groups, GROUP_SETS.flammable) && !hasGroup(groups, GROUP_SETS.special) },
  { name: 'acids', count: 10, predicate: (groups) => hasGroup(groups, GROUP_SETS.acids) && !hasGroup(groups, GROUP_SETS.special) },
  { name: 'bases', count: 10, predicate: (groups) => hasGroup(groups, GROUP_SETS.bases) && !hasGroup(groups, GROUP_SETS.special) },
  { name: 'oxidizers', count: 12, predicate: (groups) => hasGroup(groups, GROUP_SETS.oxidizers) && !hasGroup(groups, GROUP_SETS.special) },
  { name: 'toxins', count: 12, predicate: (groups) => hasGroup(groups, GROUP_SETS.toxins) && !hasGroup(groups, GROUP_SETS.special) },
  { name: 'special', count: 12, predicate: (groups) => hasGroup(groups, GROUP_SETS.special) },
];

function hasGroup(groups, set) {
  return groups.some((group) => set.has(group.id));
}

function hasAnyGroup(groups, sets) {
  return sets.some((set) => hasGroup(groups, set));
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function substanceFromInput(input, id) {
  const codes = input.codes ?? [];
  return {
    id,
    name: input.name,
    cas: input.cas ?? '',
    hazardStatements: codes.map((code) => ({ code, text: H_TEXT[code] ?? code })),
    ghsPictograms: input.pictograms ?? [],
    wel: {},
    quantity: 'regression test',
    form: input.form ?? 'liquid',
    formNote: input.formNote,
    exposureDuration: 'test',
    exposureFrequency: 'test',
    exposureRoutes: { inhalation: true, skin: true, ingestion: false, eye: true },
    volatility: input.volatility,
    dustiness: input.dustiness,
    boilingPointC: input.bp,
    flashPointC: input.flash,
    vapourPressureKPa: input.vapourPressure,
    pubchemPhysicalForm: input.pubchemPhysicalForm,
    pubchemPhysicalDescription: input.pubchemPhysicalDescription,
    pubchemNfpa: input.nfpa,
    molecularFormula: input.formula,
    pubchemTitle: input.pubchemTitle,
    iupacName: input.iupacName,
  };
}

function inferForm(cameoChemical) {
  const text = [
    cameoChemical.name,
    ...(cameoChemical.dotLabels ?? []),
  ].join(' ').toLowerCase();
  if (/\b(solutions?|aqueous)\b/.test(text)) return 'liquid';
  if (/\b(grenades?|powder|solid|dry|wetted|granular|crystals?|pellets?|fume)\b/.test(text)) return 'solid';
  if (/\b(non[-\s]?flammable gas|gas mixture|compressed|liquefied gas)\b/.test(text)) return 'gas';
  return 'liquid';
}

function substanceFromCameo(cameoChemical, id) {
  return substanceFromInput({
    name: cameoChemical.name,
    cas: cameoChemical.cas[0] ?? '',
    form: inferForm(cameoChemical),
    formula: cameoChemical.formulas?.[0] ?? '',
  }, id);
}

function expectedForCameo(match) {
  const groups = match.groups;
  const groupIds = groups.map((group) => group.id);
  const form = match.chemical.form;
  const isGas = form === 'gas';
  const isSolid = form === 'solid' || form === 'powder';
  const labelText = [
    ...(match.cameo?.dotLabels ?? []),
    match.cameo?.specialHazards,
  ].filter(Boolean).join(' ').toLowerCase();
  const hasFlammableLabel = /\bflammable|combustible\b/.test(labelText) && !/\bnon[-\s]?flammable\b/.test(labelText);
  if (isGas) return { zones: ['compressedGases', 'oxidizersOnly', 'volatilePoisonsChlorinated', 'specialReview', 'organicSolventsAcids'], reason: 'gas or compressed material' };
  if (hasGroup(groups, GROUP_SETS.special)) return { zones: ['specialReview'], reason: 'hard-isolation reactive group' };
  if (groupIds.includes(2)) return { zones: ['oxidizingAcids'], reason: 'strong oxidizing acid group' };
  if (hasGroup(groups, GROUP_SETS.oxidizers)) return { zones: ['oxidizersOnly', 'oxidizingAcids'], reason: 'oxidizer group priority' };
  if (hasGroup(groups, GROUP_SETS.acids)) return { zones: ['nonOxidizingAcids', 'oxidizingAcids', 'organicSolventsAcids'], reason: 'acid group' };
  if (hasGroup(groups, GROUP_SETS.bases)) return { zones: ['solidBases', 'liquidBases'], reason: 'base group' };
  if (hasGroup(groups, GROUP_SETS.toxins)) {
    return { zones: isSolid ? ['dryPoisons', 'organicSolventsAcids'] : ['liquidPoisons', 'volatilePoisonsChlorinated', 'organicSolventsAcids'], reason: 'toxic group' };
  }
  if (hasFlammableLabel) return { zones: ['organicSolventsAcids', 'drySolids', 'specialReview'], reason: 'flammable transport/storage label' };
  if (hasGroup(groups, GROUP_SETS.flammable)) {
    return { zones: isSolid ? ['drySolids', 'organicSolventsAcids'] : ['organicSolventsAcids', 'generalStorage'], reason: 'flammable/organic family' };
  }
  if (isSolid) return { zones: ['drySolids'], reason: 'low-trigger solid' };
  return { zones: ['generalStorage', 'review'], reason: 'low-trigger liquid' };
}

function evaluateCase(testCase, index) {
  const substance = testCase.cameoChemical
    ? substanceFromCameo(testCase.cameoChemical, `cameo-${index}`)
    : substanceFromInput(testCase, `fixed-${index}`);
  const match = resolveCameoMatch(substance);
  const assignment = classifyStorage20(match);
  return { ...testCase, substance, match, assignment };
}

const random = mulberry32(0xC0572026);
const fixedCas = new Set([...FIXED_CASES, ...GHS_ONLY_CASES].map((item) => item.cas).filter(Boolean));
const allCameoCandidates = cameoChemicals
  .filter((chemical) => !chemical.cas.some((cas) => fixedCas.has(cas)))
  .map((chemical) => {
    const match = resolveCameoMatch(substanceFromCameo(chemical, `candidate-${chemical.id}`));
    return { chemical, match };
  })
  .filter(({ match }) => match.groups.length > 0);

const selectedCameo = [];
const usedChemicalIds = new Set();

for (const stratum of STRATA) {
  const candidates = allCameoCandidates
    .filter(({ chemical, match }) => !usedChemicalIds.has(chemical.id) && stratum.predicate(match.groups));
  const picks = shuffle(candidates, random).slice(0, stratum.count);
  if (picks.length < stratum.count) {
    throw new Error(`Only found ${picks.length}/${stratum.count} candidates for ${stratum.name}`);
  }
  for (const pick of picks) {
    usedChemicalIds.add(pick.chemical.id);
    selectedCameo.push({ name: pick.chemical.name, sourceStratum: stratum.name, cameoChemical: pick.chemical });
  }
}

const totalSampleSize = 184;
const remainingSlots = totalSampleSize - FIXED_CASES.length - GHS_ONLY_CASES.length - selectedCameo.length;
if (remainingSlots < 0) throw new Error(`Regression sample contains more than ${totalSampleSize} chemicals`);
const filler = shuffle(
  allCameoCandidates.filter(({ chemical }) => !usedChemicalIds.has(chemical.id)),
  random,
).slice(0, remainingSlots);
for (const pick of filler) {
  selectedCameo.push({ name: pick.chemical.name, sourceStratum: 'filler', cameoChemical: pick.chemical });
}

const testCases = [
  ...FIXED_CASES,
  ...GHS_ONLY_CASES.map((testCase) => ({ ...testCase, sourceStratum: 'ghsOnly' })),
  ...selectedCameo,
];
if (testCases.length !== totalSampleSize) throw new Error(`Expected ${totalSampleSize} test cases, got ${testCases.length}`);

const results = testCases.map(evaluateCase);
const failures = [];
const zoneCounts = new Map();
const cabinetCounts = new Map();
const stratumCounts = new Map();

for (const result of results) {
  const { assignment, match } = result;
  zoneCounts.set(assignment.zoneId, (zoneCounts.get(assignment.zoneId) ?? 0) + 1);
  cabinetCounts.set(assignment.cabinetId, (cabinetCounts.get(assignment.cabinetId) ?? 0) + 1);
  stratumCounts.set(result.sourceStratum ?? 'fixed', (stratumCounts.get(result.sourceStratum ?? 'fixed') ?? 0) + 1);

  const zone = ZONES[assignment.zoneId];
  if (!zone) failures.push(`${result.name}: unknown zone ${assignment.zoneId}`);
  if (zone && zone.cabinetId !== assignment.cabinetId) {
    failures.push(`${result.name}: zone ${assignment.zoneId} belongs to ${zone.cabinetId}, but assignment cabinet was ${assignment.cabinetId}`);
  }
  if (!CABINET_ORDER.includes(assignment.cabinetId)) {
    failures.push(`${result.name}: cabinet ${assignment.cabinetId} is missing from CABINET_ORDER`);
  }
  if (!assignment.reasons.length) failures.push(`${result.name}: assignment has no reason text`);
  if (assignment.zoneId === 'review') failures.push(`${result.name}: unexpectedly assigned to review`);

  if (result.expectedZone && assignment.zoneId !== result.expectedZone) {
    failures.push(`${result.name}: expected zone ${result.expectedZone}, got ${assignment.zoneId}`);
  }
  if (result.expectedCabinet && assignment.cabinetId !== result.expectedCabinet) {
    failures.push(`${result.name}: expected cabinet ${result.expectedCabinet}, got ${assignment.cabinetId}`);
  }
  if (result.expectedEvidence) {
    const evidence = [...assignment.reasons, ...assignment.requirements, ...assignment.constraints].join(' ');
    if (!evidence.includes(result.expectedEvidence)) {
      failures.push(`${result.name}: expected evidence text containing "${result.expectedEvidence}", got "${evidence}"`);
    }
  }
  if (result.expectedConstraint && !assignment.constraints.some((constraint) => constraint.includes(result.expectedConstraint))) {
    failures.push(`${result.name}: expected constraint containing "${result.expectedConstraint}", got "${assignment.constraints.join('; ')}"`);
  }

  if (result.cameoChemical) {
    const expected = expectedForCameo(match);
    if (!expected.zones.includes(assignment.zoneId)) {
      failures.push(`${result.name}: expected one of ${expected.zones.join(', ')} for ${expected.reason}, got ${assignment.zoneId}`);
    }
  }
}

console.log(`\n=== Storage ${totalSampleSize}-Chemical Regression Test ===`);
console.log(`CAMEO database: ${cameoChemicals.length} chemicals, ${cameoReactiveGroups.length} reactive groups`);
console.log(`CAMEO metadata: ${cameoMeta.version ?? 'unknown'} (${cameoMeta.importDate ?? 'unknown import date'})`);
console.log(`Sample size: ${results.length} chemicals`);

console.log('\n── Sample composition ──');
for (const [stratum, count] of [...stratumCounts.entries()].sort()) {
  console.log(`  ${stratum}: ${count}`);
}

console.log('\n── Zone distribution ──');
for (const [zone, count] of [...zoneCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${zone}: ${count}`);
}

console.log('\n── Cabinet distribution ──');
for (const [cabinet, count] of [...cabinetCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cabinet}: ${count}`);
}

console.log('\n── Sentinel cases ──');
for (const result of results.filter((item) => !item.cameoChemical && item.sourceStratum !== 'ghsOnly')) {
  console.log(`  ${result.name.padEnd(32)} → ${result.assignment.zoneId.padEnd(28)} ${result.assignment.cabinetId}`);
}

console.log('\n── GHS-only cases ──');
for (const result of results.filter((item) => item.sourceStratum === 'ghsOnly')) {
  console.log(`  ${result.name.padEnd(38)} → ${result.assignment.zoneId.padEnd(28)} ${result.assignment.cabinetId}`);
}

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} storage regression issue${failures.length === 1 ? '' : 's'} found`);
  for (const failure of failures) console.error(`  - ${failure}`);
  await rm(outdir, { recursive: true, force: true });
  process.exit(1);
}

console.log(`\nPASS: all ${totalSampleSize} storage regression cases met their expected rules`);
await rm(outdir, { recursive: true, force: true });
