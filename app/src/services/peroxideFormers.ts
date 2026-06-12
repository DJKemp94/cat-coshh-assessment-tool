/**
 * Peroxide-forming chemicals, classified A-C following the Kansas State
 * University EHS list (k-state.edu/safety - "Peroxide Forming Chemicals"),
 * which mirrors the standard Kelly (1996) / Prudent Practices scheme.
 *
 * Peroxide formation is a storage-lifecycle hazard that GHS data from
 * PubChem cannot signal (EUH019 is EU-only and rarely present), so these
 * chemicals are matched by CAS number first and name pattern as fallback.
 *
 * Class D ("may form peroxides but cannot be clearly categorized") is
 * deliberately excluded - flagging ~100 loosely-evidenced chemicals would
 * erode trust in the warning.
 */

export type PeroxideFormerClass = 'A' | 'B' | 'C';

export interface PeroxideFormerInfo {
  class: PeroxideFormerClass;
  /** Canonical chemical label from the source list. */
  label: string;
  /** Concise requirement-style guidance for the constraints column. */
  requirement: string;
  /** The guidance alone, sentence-cased, for report lines that state the class separately. */
  guidance: string;
}

interface PeroxideFormerEntry {
  class: PeroxideFormerClass;
  label: string;
  cas?: string;
  /** Lowercase word-boundary pattern applied when CAS does not match. */
  namePattern?: RegExp;
}

export const PEROXIDE_CLASS_SUMMARIES: Record<PeroxideFormerClass, { title: string; body: string }> = {
  A: {
    title: 'Class A - severe peroxide hazard',
    body: 'Forms explosive peroxides on exposure to air without concentration. Date on receipt. Test or safely dispose within 3 months of opening. Never open a container with visible crystals, cloudiness or discoloration - treat as potentially explosive and contact specialist disposal.',
  },
  B: {
    title: 'Class B - concentration hazard',
    body: 'Forms explosive peroxides when distilled, evaporated or otherwise concentrated. Date on opening. Test for peroxides or dispose within 12 months. Never distill or evaporate to dryness without confirming peroxide levels first.',
  },
  C: {
    title: 'Class C - polymerizable monomer',
    body: 'Internal peroxide accumulation can initiate hazardous auto-polymerization. Confirm the polymerization inhibitor is present and in date. Date on opening and test or dispose within 12 months. Note inhibitor levels deplete faster at elevated temperature.',
  },
};

const CLASS_GUIDANCE: Record<PeroxideFormerClass, string> = {
  A: 'Date on receipt, test/dispose within 3 months, never open if crystals or cloudiness visible',
  B: 'Date on opening, test/dispose within 12 months, never distill or evaporate to dryness',
  C: 'Auto-polymerization risk, confirm inhibitor present and in date',
};

const ENTRIES: PeroxideFormerEntry[] = [
  // ── Class A - severe peroxide hazard ────────────────────────────
  { class: 'A', label: 'Isopropyl ether (diisopropyl ether)', cas: '108-20-3', namePattern: /\b(diisopropyl ether|isopropyl ether)\b/ },
  { class: 'A', label: 'Divinyl ether', cas: '109-93-3', namePattern: /\bdivinyl ether\b/ },
  { class: 'A', label: 'Vinylidene chloride (1,1-dichloroethylene)', cas: '75-35-4', namePattern: /\b(vinylidene chloride|1,1-dichloroethylene|1,1-dichloroethene)\b/ },
  { class: 'A', label: 'Potassium metal', cas: '7440-09-7', namePattern: /\bpotassium metal\b/ },
  { class: 'A', label: 'Sodium amide (sodamide)', cas: '7782-92-5', namePattern: /\b(sodium amide|sodamide)\b/ },
  { class: 'A', label: 'Potassium amide', cas: '17242-52-3', namePattern: /\bpotassium amide\b/ },
  { class: 'A', label: 'Butadiene (severe as liquid monomer)', cas: '106-99-0', namePattern: /\bbutadiene\b/ },
  { class: 'A', label: 'Chloroprene (severe as liquid monomer)', cas: '126-99-8', namePattern: /\b(chloroprene|chlorobutadiene)\b/ },
  { class: 'A', label: 'Tetrafluoroethylene (severe as liquid monomer)', cas: '116-14-3', namePattern: /\btetrafluoroethylene\b/ },

  // ── Class B - hazardous on concentration ────────────────────────
  { class: 'B', label: 'Diethyl ether', cas: '60-29-7', namePattern: /\b(diethyl ether|ethyl ether)\b/ },
  { class: 'B', label: 'Tetrahydrofuran (THF)', cas: '109-99-9', namePattern: /\btetrahydrofuran\b/ },
  { class: 'B', label: 'Dioxane', cas: '123-91-1', namePattern: /\bdioxanes?\b/ },
  { class: 'B', label: 'Acetal (1,1-diethoxyethane)', cas: '105-57-7', namePattern: /\b(acetal|1,1-diethoxyethane)\b/ },
  { class: 'B', label: 'Acetaldehyde', cas: '75-07-0', namePattern: /\bacetaldehyde\b/ },
  { class: 'B', label: 'Benzyl alcohol', cas: '100-51-6', namePattern: /\bbenzyl alcohol\b/ },
  { class: 'B', label: '2-Butanol', cas: '78-92-2', namePattern: /\b(2-butanol|sec-butanol|sec-butyl alcohol)\b/ },
  { class: 'B', label: 'Cumene', cas: '98-82-8', namePattern: /\b(cumene|isopropylbenzene)\b/ },
  { class: 'B', label: 'Cyclohexanol', cas: '108-93-0', namePattern: /\bcyclohexanol\b/ },
  { class: 'B', label: '2-Cyclohexen-1-ol', namePattern: /\b2-cyclohexen-1-ol\b/ },
  { class: 'B', label: 'Decahydronaphthalene (decalin)', cas: '91-17-8', namePattern: /\b(decahydronaphthalene|decalin)\b/ },
  { class: 'B', label: 'Diacetylene (1,3-butadiyne)', cas: '460-12-8', namePattern: /\b(diacetylene|butadiyne)\b/ },
  { class: 'B', label: 'Dicyclopentadiene', cas: '77-73-6', namePattern: /\bdicyclopentadiene\b/ },
  { class: 'B', label: 'Diethylene glycol dimethyl ether (diglyme)', cas: '111-96-6', namePattern: /\b(diglyme|diethylene glycol dimethyl ether)\b/ },
  { class: 'B', label: 'Ethylene glycol dimethyl ether (glyme)', cas: '110-71-4', namePattern: /\b(glyme|1,2-dimethoxyethane|monoglyme)\b/ },
  { class: 'B', label: 'Furan', cas: '110-00-9', namePattern: /\bfuran\b/ },
  { class: 'B', label: '4-Heptanol', cas: '589-55-9', namePattern: /\b4-heptanol\b/ },
  { class: 'B', label: '2-Hexanol', cas: '626-93-7', namePattern: /\b2-hexanol\b/ },
  { class: 'B', label: 'Methylacetylene (propyne)', cas: '74-99-7', namePattern: /\b(methylacetylene|propyne)\b/ },
  { class: 'B', label: 'Methylcyclopentane', cas: '96-37-7', namePattern: /\bmethyl ?cyclopentane\b/ },
  { class: 'B', label: 'Methyl isobutyl ketone', cas: '108-10-1', namePattern: /\b(methyl isobutyl ketone|4-methyl-2-pentanone)\b/ },
  { class: 'B', label: '3-Methyl-1-butanol (isoamyl alcohol)', cas: '123-51-3', namePattern: /\b(3-methyl-1-butanol|isoamyl alcohol|isopentyl alcohol)\b/ },
  { class: 'B', label: '4-Methyl-2-pentanol', cas: '108-11-2', namePattern: /\b4-methyl-2-pentanol\b/ },
  { class: 'B', label: '2-Pentanol', cas: '6032-29-7', namePattern: /\b2-pentanol\b/ },
  { class: 'B', label: '4-Penten-1-ol', cas: '821-09-0', namePattern: /\b4-penten-1-ol\b/ },
  { class: 'B', label: '1-Phenylethanol', cas: '98-85-1', namePattern: /\b1-phenylethanol\b/ },
  { class: 'B', label: '2-Phenylethanol', cas: '60-12-8', namePattern: /\b(2-phenylethanol|phenethyl alcohol)\b/ },
  { class: 'B', label: 'Tetrahydronaphthalene (tetralin)', cas: '119-64-2', namePattern: /\b(tetrahydronaphthalene|tetralin)\b/ },
  { class: 'B', label: 'Vinyl ethers', namePattern: /\bvinyl ether\b/ },

  // ── Class C - polymerizable monomers ────────────────────────────
  { class: 'C', label: 'Acrylic acid', cas: '79-10-7', namePattern: /\bacrylic acid\b/ },
  { class: 'C', label: 'Acrylonitrile', cas: '107-13-1', namePattern: /\bacrylonitrile\b/ },
  { class: 'C', label: 'Chlorotrifluoroethylene', cas: '79-38-9', namePattern: /\bchlorotrifluoroethylene\b/ },
  { class: 'C', label: 'Methyl methacrylate', cas: '80-62-6', namePattern: /\bmethyl methacrylate\b/ },
  { class: 'C', label: 'Styrene', cas: '100-42-5', namePattern: /\bstyrene\b/ },
  { class: 'C', label: 'Vinyl acetate', cas: '108-05-4', namePattern: /\bvinyl acetate\b/ },
  { class: 'C', label: 'Vinyl chloride', cas: '75-01-4', namePattern: /\bvinyl chloride\b/ },
  { class: 'C', label: 'Vinylacetylene', cas: '689-97-4', namePattern: /\bvinylacetylene\b/ },
  { class: 'C', label: 'Vinylpyridine', cas: '100-69-6', namePattern: /\bvinyl ?pyridine\b/ },
];

function normalizeCas(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, '').trim();
}

/**
 * Look up a chemical against the peroxide-former list. CAS match wins;
 * name patterns are a fallback for entries recorded without a CAS number.
 * Order matters where patterns overlap (divinyl ether before vinyl ethers,
 * diisopropyl/diethyl ether before any generic pattern) - first hit wins.
 */
export function findPeroxideFormer(chemical: { cas?: string; name?: string; iupacName?: string; pubchemTitle?: string }): PeroxideFormerInfo | null {
  const cas = normalizeCas(chemical.cas);
  if (cas) {
    const byCas = ENTRIES.find((entry) => entry.cas === cas);
    if (byCas) return toInfo(byCas);
  }
  const text = [chemical.name, chemical.iupacName, chemical.pubchemTitle].filter(Boolean).join(' ').toLowerCase();
  if (!text) return null;
  const byName = ENTRIES.find((entry) => entry.namePattern?.test(text));
  return byName ? toInfo(byName) : null;
}

function toInfo(entry: PeroxideFormerEntry): PeroxideFormerInfo {
  const guidance = CLASS_GUIDANCE[entry.class];
  return {
    class: entry.class,
    label: entry.label,
    guidance,
    requirement: `Class ${entry.class} peroxide former - ${guidance.charAt(0).toLowerCase()}${guidance.slice(1)}`,
  };
}
