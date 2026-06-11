import { GhsPictogram, HCode, HazardSource, Substance } from '@/types/assessment';

export interface HazardEditDiff {
  edited: boolean;
  addedHCodes: HCode[];
  removedHCodes: HCode[];
  addedPictograms: GhsPictogram[];
  removedPictograms: GhsPictogram[];
}

export function hCodeKey(code: string): string {
  return code.trim().toUpperCase();
}

export function uniqueHCodes(codes: HCode[]): HCode[] {
  const byCode = new Map<string, HCode>();
  codes.forEach((h) => {
    const key = hCodeKey(h.code);
    if (key && !byCode.has(key)) byCode.set(key, { code: h.code.trim(), text: h.text.trim() });
  });
  return [...byCode.values()];
}

export function uniquePictograms(ids: GhsPictogram[]): GhsPictogram[] {
  return [...new Set(ids)];
}

export function pubChemHazardSource(
  cid: number,
  fetchedAt: string,
  hazardStatements: HCode[],
  ghsPictograms: GhsPictogram[],
): HazardSource {
  return {
    type: 'pubchem',
    pubchemBaseline: {
      cid,
      fetchedAt,
      hazardStatements: uniqueHCodes(hazardStatements),
      ghsPictograms: uniquePictograms(ghsPictograms),
    },
  };
}

export function diffPubChemHazards(c: Substance): HazardEditDiff {
  const empty: HazardEditDiff = {
    edited: false,
    addedHCodes: [],
    removedHCodes: [],
    addedPictograms: [],
    removedPictograms: [],
  };
  const baseline = c.hazardSource?.type === 'pubchem'
    ? c.hazardSource.pubchemBaseline
    : undefined;
  if (!baseline) return empty;

  const currentH = new Map(uniqueHCodes(c.hazardStatements).map((h) => [hCodeKey(h.code), h]));
  const baseH = new Map(uniqueHCodes(baseline.hazardStatements).map((h) => [hCodeKey(h.code), h]));
  const currentP = new Set(c.ghsPictograms);
  const baseP = new Set(baseline.ghsPictograms);

  const diff = {
    addedHCodes: [...currentH.entries()].filter(([key]) => !baseH.has(key)).map(([, h]) => h),
    removedHCodes: [...baseH.entries()].filter(([key]) => !currentH.has(key)).map(([, h]) => h),
    addedPictograms: [...currentP].filter((p) => !baseP.has(p)),
    removedPictograms: [...baseP].filter((p) => !currentP.has(p)),
  };
  return {
    ...diff,
    edited:
      diff.addedHCodes.length > 0 ||
      diff.removedHCodes.length > 0 ||
      diff.addedPictograms.length > 0 ||
      diff.removedPictograms.length > 0,
  };
}

export function hazardSourceAfterEdit(
  c: Substance,
  hazardStatements: HCode[],
  ghsPictograms: GhsPictogram[],
): HazardSource | undefined {
  if (c.hazardSource?.type !== 'pubchem' || !c.hazardSource.pubchemBaseline) {
    return c.hazardSource?.type === 'pubchem' ? c.hazardSource : { type: 'manual' };
  }
  const probe: Substance = { ...c, hazardStatements, ghsPictograms };
  const diff = diffPubChemHazards(probe);
  return {
    ...c.hazardSource,
    editedAt: diff.edited ? c.hazardSource.editedAt ?? new Date().toISOString() : undefined,
  };
}

export function hazardEditSummary(c: Substance, pictogramLabel: (id: GhsPictogram) => string = (id) => id): string[] {
  const diff = diffPubChemHazards(c);
  if (!diff.edited) return [];
  const added = [
    ...diff.addedHCodes.map((h) => h.code),
    ...diff.addedPictograms.map(pictogramLabel),
  ];
  const removed = [
    ...diff.removedHCodes.map((h) => h.code),
    ...diff.removedPictograms.map(pictogramLabel),
  ];
  return [
    added.length ? `Added: ${added.join(', ')}` : '',
    removed.length ? `Removed: ${removed.join(', ')}` : '',
  ].filter(Boolean);
}
