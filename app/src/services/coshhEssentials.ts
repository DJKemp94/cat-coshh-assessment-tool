/**
 * COSHH Essentials control-banding engine.
 *
 * Implements the HSE-published methodology for selecting a control approach
 * from (hazard group) × exposure predictor band. The exposure predictor band
 * is derived from (scale of use) × (volatility or dustiness), separately for
 * liquids and solids.
 *
 * Primary references:
 *   - HSE HSG193 "COSHH essentials: easy steps to control chemicals" (3rd ed.)
 *   - HSE (2017) "The technical basis for COSHH essentials" — CLP H-statement
 *     to hazard group mapping (Appendix 4)
 *   - HSE Generic Guidance Sheets (G100, G200, G300, G400 series)
 *
 * Caveats baked into the engine (per HSE):
 *   - Group E (carcinogens Cat 1, mutagens Cat 1, repro toxicants Cat 1,
 *     respiratory sensitisers, fatal-on-exposure) ALWAYS → Approach 4
 *     "Seek specialist advice". The matrix is not used.
 *   - Not valid for pesticides, asbestos, lead, radioactive materials,
 *     biological agents — these need their own regulations/specialist advice.
 *   - Does not cover physical hazards (fire/explosion/reactivity).
 *   - Screening tool: a competent assessor must verify and may set stricter
 *     controls than the screening recommends.
 */

import { CoshhBand, Substance, SubstanceForm } from '@/types/assessment';

export type HazardGroup = 'A' | 'B' | 'C' | 'D' | 'E';
export type Approach = 1 | 2 | 3 | 4;
export type Scale = 'small' | 'medium' | 'large';
export type ExposurePredictor = 'EP1' | 'EP2' | 'EP3' | 'EP4';
type CoshhPhysicalKind = 'solid' | 'liquid';

// ─────────────────────────────────────────────────────────────────────────────
// H-statement → hazard group
// Source: HSE COSHH Essentials, Table 3 ("Allocation of R-phrase or GHS phrase
// to Hazard Group, concentration range"). Reproduced verbatim from HSG193 /
// the COSHH Essentials technical basis.
// ─────────────────────────────────────────────────────────────────────────────

const GROUP_E_HCODES = new Set([
  'H334',   // Respiratory sensitiser — may cause allergy/asthma if inhaled
  'H340',   // May cause genetic defects (Mut. Cat 1A/1B)
  'H341',   // Suspected of causing genetic defects (Mut. Cat 2)
  'H350',   // May cause cancer (Carc. Cat 1A/1B)
  'H350I',  // May cause cancer by inhalation
]);

const GROUP_D_HCODES = new Set([
  'H300',   // Fatal if swallowed
  'H310',   // Fatal in contact with skin
  'H330',   // Fatal if inhaled
  'H351',   // Suspected of causing cancer (Carc. Cat 2)
  'H360',   // May damage fertility / unborn child (Repr. Cat 1A/1B)
  'H360F', 'H360D', 'H360FD',
  'H361',   // Suspected reproductive toxicant (Repr. Cat 2)
  'H361F', 'H361D', 'H361FD',
  'H362',   // May cause harm to breast-fed children
  'H372',   // Causes damage to organs (STOT RE Cat 1)
]);

const GROUP_C_HCODES = new Set([
  'H301',   // Toxic if swallowed (Acute Tox. 3 oral)
  'H311',   // Toxic in contact with skin (Acute Tox. 3 dermal)
  'H314',   // Causes severe skin burns and eye damage
  'H317',   // May cause an allergic skin reaction (skin sensitiser)
  'H318',   // Causes serious eye damage
  'H331',   // Toxic if inhaled (Acute Tox. 3 inhalation)
  'H335',   // May cause respiratory irritation
  'H370',   // Causes damage to organs (STOT SE Cat 1)
  'H373',   // May cause damage to organs (STOT RE Cat 2)
]);

const GROUP_B_HCODES = new Set([
  'H302',   // Harmful if swallowed
  'H312',   // Harmful in contact with skin
  'H332',   // Harmful if inhaled
  'H371',   // May cause damage to organs (STOT SE Cat 2)
]);

// Group A is the implicit default — comprises H303, H304, H305, H313, H315,
// H316, H319, H320, H333, H336 and any H-statement not listed in B/C/D/E.

/** True if any H-code triggers automatic "seek specialist advice" (Approach 4). */
function hazardGroupFor(hCodes: string[]): { group: HazardGroup; drivers: string[] } {
  const codes = hCodes.map((c) => c.trim().toUpperCase().replace(/\s+/g, ''));
  const hit = (set: Set<string>) =>
    codes.filter((c) => set.has(c));
  const eDrv = hit(GROUP_E_HCODES);
  if (eDrv.length) return { group: 'E', drivers: eDrv };
  const dDrv = hit(GROUP_D_HCODES);
  if (dDrv.length) return { group: 'D', drivers: dDrv };
  const cDrv = hit(GROUP_C_HCODES);
  if (cDrv.length) return { group: 'C', drivers: cDrv };
  const bDrv = hit(GROUP_B_HCODES);
  if (bDrv.length) return { group: 'B', drivers: bDrv };
  return { group: 'A', drivers: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quantity parsing → scale band
// HSE bands:  Small = grams / mL,  Medium = kg / L,  Large = tonnes / m³
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedQuantity {
  /** Mass in grams (best effort) or null if quantity is volumetric only. */
  grams: number | null;
  /** Volume in mL or null if mass only. */
  millilitres: number | null;
  scale: Scale;
  raw: string;
}

const QTY_RE =
  /([0-9]+(?:[.,][0-9]+)?)\s*(t|tonnes?|kg|g|mg|µg|ug|m3|m\^3|l|litres?|ml|cl|cm3|µl|ul)\b/i;

function parseQuantity(s: string): ParsedQuantity | null {
  const m = QTY_RE.exec(s);
  if (!m) return null;
  const num = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(num)) return null;
  const unit = m[2].toLowerCase().replace(/\s/g, '');
  let grams: number | null = null;
  let millilitres: number | null = null;
  let scale: Scale;
  switch (unit) {
    case 't': case 'tonne': case 'tonnes':       grams = num * 1_000_000; scale = 'large'; break;
    case 'kg':                                    grams = num * 1_000; scale = 'medium'; break;
    case 'g':                                     grams = num; scale = 'small'; break;
    case 'mg':                                    grams = num / 1_000; scale = 'small'; break;
    case 'µg': case 'ug':                         grams = num / 1_000_000; scale = 'small'; break;
    case 'm3': case 'm^3':                        millilitres = num * 1_000_000; scale = 'large'; break;
    case 'l': case 'litre': case 'litres':        millilitres = num * 1_000; scale = 'medium'; break;
    case 'ml': case 'cm3':                        millilitres = num; scale = 'small'; break;
    case 'cl':                                    millilitres = num * 10; scale = 'small'; break;
    case 'µl': case 'ul':                         millilitres = num / 1_000; scale = 'small'; break;
    default:                                       return null;
  }
  return { grams, millilitres, scale, raw: m[0] };
}

function scaleFor(q: ParsedQuantity | null): Scale | 'unknown' {
  if (!q) return 'unknown';
  return q.scale;
}

// ─────────────────────────────────────────────────────────────────────────────
// Volatility / dustiness band
// ─────────────────────────────────────────────────────────────────────────────

const AIRBORNE_FORMS: SubstanceForm[] = ['gas', 'vapour', 'aerosol', 'mist'];

/** HSE COSHH Essentials volatility band from boiling point at ambient
 *  working temperature. */
export function volatilityFromBP(bpC: number): CoshhBand {
  if (bpC > 150) return 'low';
  if (bpC >= 50) return 'medium';
  return 'high';
}

function bandFor(c: Substance): {
  band: CoshhBand | 'unknown';
  kind: 'volatility' | 'dustiness' | 'not-applicable';
  physicalKind: CoshhPhysicalKind | 'unsupported' | 'unknown';
  reasoning: string;
} {
  if (AIRBORNE_FORMS.includes(c.form)) {
    return {
      band: 'unknown',
      kind: 'not-applicable',
      physicalKind: 'unsupported',
      reasoning: `Form is ${c.form}; the generic COSHH Essentials scheme applies to liquids and solids only.`,
    };
  }
  if (c.form === 'liquid') {
    if (c.volatility) {
      return { band: c.volatility, kind: 'volatility', physicalKind: 'liquid', reasoning: `User-specified volatility: ${c.volatility}.` };
    }
    if (typeof c.boilingPointC === 'number') {
      const band = volatilityFromBP(c.boilingPointC);
      return { band, kind: 'volatility', physicalKind: 'liquid',
        reasoning: `Auto from PubChem BP ${c.boilingPointC} °C.` };
    }
    return { band: 'unknown', kind: 'volatility', physicalKind: 'liquid',
      reasoning: 'Set substance volatility (low/med/high) to refine.' };
  }
  if (c.form === 'solid' || c.form === 'powder') {
    if (c.dustiness) {
      return { band: c.dustiness, kind: 'dustiness', physicalKind: 'solid', reasoning: `User-specified dustiness: ${c.dustiness}.` };
    }
    // Powder default = medium; solid (pellet/granule) default = low — but we
    // don't assume; ask the user.
    return { band: 'unknown', kind: 'dustiness', physicalKind: 'solid',
      reasoning: 'Set substance dustiness (low/med/high) to refine.' };
  }
  return { band: 'unknown', kind: 'not-applicable', physicalKind: 'unknown',
    reasoning: 'Form does not map to a COSHH Essentials band.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exposure predictor and control approach tables from HSE technical basis,
// Tables 2 and 6. A liquid in Group A at EP3 is normally CA1, but HSE notes
// subsequent validation found medium-scale use of high-volatility liquid
// requires CA2.
// ─────────────────────────────────────────────────────────────────────────────

const SOLID_EP: Record<Scale, Record<CoshhBand, ExposurePredictor>> = {
  small: { low: 'EP1', medium: 'EP1', high: 'EP2' },
  medium: { low: 'EP2', medium: 'EP3', high: 'EP3' },
  large: { low: 'EP2', medium: 'EP4', high: 'EP4' },
};

const LIQUID_EP: Record<Scale, Record<CoshhBand, ExposurePredictor>> = {
  small: { low: 'EP1', medium: 'EP2', high: 'EP2' },
  medium: { low: 'EP2', medium: 'EP3', high: 'EP3' },
  large: { low: 'EP2', medium: 'EP3', high: 'EP4' },
};

const APPROACH_BY_EP: Record<CoshhPhysicalKind, Record<HazardGroup, Record<ExposurePredictor, Approach>>> = {
  solid: {
    A: { EP1: 1, EP2: 1, EP3: 1, EP4: 2 },
    B: { EP1: 1, EP2: 1, EP3: 2, EP4: 3 },
    C: { EP1: 1, EP2: 2, EP3: 3, EP4: 4 },
    D: { EP1: 2, EP2: 3, EP3: 4, EP4: 4 },
    E: { EP1: 4, EP2: 4, EP3: 4, EP4: 4 },
  },
  liquid: {
    A: { EP1: 1, EP2: 1, EP3: 1, EP4: 2 },
    B: { EP1: 1, EP2: 1, EP3: 2, EP4: 2 },
    C: { EP1: 1, EP2: 2, EP3: 3, EP4: 3 },
    D: { EP1: 2, EP2: 3, EP3: 4, EP4: 4 },
    E: { EP1: 4, EP2: 4, EP3: 4, EP4: 4 },
  },
};

function exposurePredictorFor(
  physicalKind: CoshhPhysicalKind,
  scale: Scale,
  band: CoshhBand,
): ExposurePredictor {
  return physicalKind === 'solid'
    ? SOLID_EP[scale][band]
    : LIQUID_EP[scale][band];
}

function approachFor(
  group: HazardGroup,
  scale: Scale | 'unknown',
  band: CoshhBand | 'unknown',
  physicalKind: CoshhPhysicalKind | 'unsupported' | 'unknown',
): { approach: Approach; assumed: { scale?: Scale; band?: CoshhBand }; epBand?: ExposurePredictor } {
  if (physicalKind === 'unsupported' || physicalKind === 'unknown') {
    return { approach: 4, assumed: {} };
  }
  const assumed: { scale?: Scale; band?: CoshhBand } = {};
  const effScale: Scale = scale === 'unknown' ? (assumed.scale = 'medium') : scale;
  const effBand: CoshhBand = band === 'unknown' ? (assumed.band = 'medium') : band;
  const epBand = exposurePredictorFor(physicalKind, effScale, effBand);
  const highVolatilityGroupALiquidException =
    physicalKind === 'liquid' && group === 'A' && effScale === 'medium' && effBand === 'high';
  const approach = highVolatilityGroupALiquidException
    ? 2
    : APPROACH_BY_EP[physicalKind][group][epBand];
  return { approach, assumed, epBand };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface SubstanceAnalysis {
  substanceId: string;
  name: string;
  hazardGroup: HazardGroup;
  drivingHCodes: string[];
  scale: Scale | 'unknown';
  parsedQuantity: ParsedQuantity | null;
  bandKind: 'volatility' | 'dustiness' | 'not-applicable';
  physicalKind: CoshhPhysicalKind | 'unsupported' | 'unknown';
  band: CoshhBand | 'unknown';
  exposurePredictor?: ExposurePredictor;
  bandReason: string;
  approach: Approach;
  assumed: { scale?: Scale; band?: CoshhBand };
  warnings: string[];
}

export interface OverallSuggestion {
  approach: Approach;
  driver: SubstanceAnalysis | null;
  analyses: SubstanceAnalysis[];
  approachLabel: string;
  gSheetRef: string;
  warnings: string[];
}

export function analyseSubstance(c: Substance): SubstanceAnalysis {
  const codes = c.hazardStatements.map((h) => h.code);
  const { group, drivers } = hazardGroupFor(codes);
  const parsedQuantity = parseQuantity(c.quantity);
  const scale = scaleFor(parsedQuantity);
  const { band, kind, physicalKind, reasoning } = bandFor(c);

  const warnings: string[] = [];
  if (group === 'E') {
    warnings.push(
      `Group E hazard (${drivers.join(', ')}) — COSHH Essentials directs to specialist advice (Approach 4). Do not rely on the banded screening.`
    );
  }
  if (codes.some((x) => /^H304/i.test(x))) {
    warnings.push('H304 aspiration hazard: COSHH Essentials does not fully cover aspiration risk — consider design controls against accidental swallowing/inhalation of mists.');
  }
  if (scale === 'unknown') {
    warnings.push(`Could not parse quantity "${c.quantity}". Add a unit (g / mL / kg / L / m³) so the scale band can be set. Assumed medium for the screening.`);
  }
  if (band === 'unknown' && kind !== 'not-applicable') {
    warnings.push(`${kind === 'volatility' ? 'Volatility' : 'Dustiness'} band not set for "${c.name}". Assumed medium for the screening — set the band on the substance to refine.`);
  }
  if (physicalKind === 'unsupported') {
    warnings.push(`"${c.name}" is recorded as ${c.form}. The generic COSHH Essentials scheme is for liquids and solids only; seek competent specialist advice.`);
  }

  const { approach, assumed, epBand } = approachFor(group, scale, band, physicalKind);

  return {
    substanceId: c.id,
    name: c.name || '(unnamed substance)',
    hazardGroup: group,
    drivingHCodes: drivers,
    scale,
    parsedQuantity,
    bandKind: kind,
    physicalKind,
    band,
    exposurePredictor: epBand,
    bandReason: reasoning,
    approach,
    assumed,
    warnings,
  };
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function APPROACH_LABEL(a: Approach): string {
  switch (a) {
    case 1: return 'Approach 1 — General ventilation';
    case 2: return 'Approach 2 — Engineering controls (LEV)';
    case 3: return 'Approach 3 — Containment / enclosure';
    case 4: return 'Approach 4 — Specialist advice required';
  }
}

export function G_SHEET_REF(a: Approach): string {
  switch (a) {
    case 1: return 'HSE Generic Guidance Sheet G100 series — general ventilation';
    case 2: return 'HSE Generic Guidance Sheet G200 series — engineering / LEV';
    case 3: return 'HSE Generic Guidance Sheet G300 series — containment';
    case 4: return 'HSE Generic Guidance Sheet G400 — refer to occupational hygienist / specialist';
  }
}

export function suggestControls(allSubstances: Substance[]): OverallSuggestion | null {
  const seen = new Set<string>();
  const uniqueSubstances = allSubstances.filter((c) => {
    const key = String(c.pubchemCid ?? c.cas ?? c.name).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const analyses = uniqueSubstances
    .map((c) => analyseSubstance(c));
  if (analyses.length === 0) return null;

  // Driving substance = the one with the highest approach. Tie-break: highest
  // hazard group, then largest scale.
  const groupRank: Record<HazardGroup, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };
  const scaleRank: Record<Scale | 'unknown', number> = { small: 1, unknown: 2, medium: 2, large: 3 };
  const driver = analyses.reduce<SubstanceAnalysis | null>((best, x) => {
    if (!best) return x;
    if (x.approach !== best.approach) return x.approach > best.approach ? x : best;
    if (groupRank[x.hazardGroup] !== groupRank[best.hazardGroup])
      return groupRank[x.hazardGroup] > groupRank[best.hazardGroup] ? x : best;
    return scaleRank[x.scale] > scaleRank[best.scale] ? x : best;
  }, null)!;

  const warnings: string[] = [];
  for (const a of analyses) warnings.push(...a.warnings);
  warnings.push(
    'COSHH Essentials is a screening tool. A competent risk assessor must verify the screening output against the SDS, task, exposure route, quantity, duration, WELs and local conditions, and may impose stricter controls. Not valid for asbestos, lead, pesticides, radioactive materials, or biological agents.',
  );

  return {
    approach: driver.approach,
    driver,
    analyses,
    approachLabel: APPROACH_LABEL(driver.approach),
    gSheetRef: G_SHEET_REF(driver.approach),
    warnings,
  };
}
