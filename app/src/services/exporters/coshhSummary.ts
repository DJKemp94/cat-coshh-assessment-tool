/**
 * Shared static text used in both PDF and DOCX exports to explain the
 * COSHH Essentials methodology to a non-specialist reader.
 */

export const COSHH_INTRO = [
  'COSHH Essentials is the HSE control-banding screening tool published in HSG193. It identifies a suggested control approach for each substance from the combination of (a) the chemical hazard group derived from CLP H-statements, (b) the scale at which the substance is used, and (c) the volatility band for liquids or the dustiness band for solids. The highest approach across all substances is a screening output for assessor review, not automatic approval of controls.',
  'It is a screening tool only. A competent assessor must verify the screening output against the SDS, task, exposure route, quantity, duration, WELs and local conditions, and may impose stricter controls. The scheme does not cover asbestos, lead, pesticides, radioactive materials or biological agents, and does not address physical hazards such as fire, explosion or reactivity.',
];

export const HAZARD_GROUP_HELP: [string, string][] = [
  ['A', 'Lower health hazard band: H304, H315, H319, H336 and similar lower-toxicity effects.'],
  ['B', 'Harmful / STOT category 2 band: H302, H312, H332, H371.'],
  ['C', 'Toxic, corrosive, serious eye damage, sensitising skin, respiratory irritation or STOT category 1/2: H301, H311, H314, H317, H318, H331, H335, H370, H373.'],
  ['D', 'Fatal acute toxicity, suspected carcinogen / reproductive toxicant, lactation hazard or repeated-exposure organ damage: H300, H310, H330, H351, H360, H361, H362, H372.'],
  ['E', 'Respiratory sensitiser, mutagen or carcinogen category 1 / suspected mutagen: H334, H340, H341, H350. Specialist advice is required (Approach 4).'],
];

export const EP_HELP: [string, string][] = [
  ['EP1', 'Lowest exposure potential: small amounts with low/medium dustiness, or low-volatility millilitre-scale liquids.'],
  ['EP2', 'Low-to-moderate exposure potential: grams of high-dust solids, kg/tonne of low-dust solids, or millilitres of medium/high-volatility liquids.'],
  ['EP3', 'Moderate-to-high exposure potential: litre-scale liquid work or kilogram-scale medium/high-dust solid work.'],
  ['EP4', 'Highest exposure potential: cubic-metre-scale high-volatility liquids or tonne-scale medium/high-dust solids.'],
];

export const APPROACH_HELP: [string, string][] = [
  ['1', 'General ventilation and good working practice.'],
  ['2', 'Engineering control, normally local exhaust ventilation or equivalent capture / control.'],
  ['3', 'Containment or enclosure where small breaches may occur.'],
  ['4', 'Specialist advice required: the banding screen alone is not sufficient.'],
];
