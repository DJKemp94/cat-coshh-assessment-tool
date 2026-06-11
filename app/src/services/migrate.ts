import {
  Assessment, ProcessStep, SCHEMA_VERSION, uuid, emptyStorage2, emptyEmergency, emptyStepControls,
} from '@/types/assessment';

function normalizeChemical(raw: Record<string, unknown>): Record<string, unknown> {
  const hazardStatements = Array.isArray(raw.hazardStatements) ? raw.hazardStatements : [];
  const ghsPictograms = Array.isArray(raw.ghsPictograms) ? raw.ghsPictograms : [];
  const pubchemFetchedAt = typeof raw.pubchemFetchedAt === 'string' ? raw.pubchemFetchedAt : undefined;
  const pubchemCid = typeof raw.pubchemCid === 'number' ? raw.pubchemCid : undefined;
  return {
    ...raw,
    casNotApplicable: typeof raw.casNotApplicable === 'boolean' ? raw.casNotApplicable : false,
    hazardStatements,
    ghsPictograms,
    hazardSource: raw.hazardSource && typeof raw.hazardSource === 'object'
      ? raw.hazardSource
      : pubchemFetchedAt
        ? {
            type: 'pubchem',
            pubchemBaseline: {
              cid: pubchemCid ?? 0,
              fetchedAt: pubchemFetchedAt,
              hazardStatements,
              ghsPictograms,
            },
          }
        : { type: 'manual' },
  };
}

function firstText(values: unknown[]): string {
  return values.map((value) => (typeof value === 'string' ? value.trim() : '')).find(Boolean) ?? '';
}

function normalizeProcessStep(raw: unknown) {
  const step = raw as Record<string, unknown>;
  const chemicals = Array.isArray(step.chemicals)
    ? step.chemicals.map((chemical) => normalizeChemical(chemical as Record<string, unknown>))
    : [];
  return {
    ...step,
    description: typeof step.description === 'string' ? step.description : '',
    exposureDuration: typeof step.exposureDuration === 'string'
      ? step.exposureDuration
      : firstText(chemicals.map((chemical) => chemical.exposureDuration)),
    controls: {
      ...emptyStepControls(),
      ...(step.controls as Record<string, unknown> | undefined),
    },
    chemicals,
  };
}

function normalizeCurrentAssessment(rawAssessment: Record<string, unknown>): Assessment {
  const processSteps = Array.isArray(rawAssessment.processSteps)
    ? rawAssessment.processSteps.map(normalizeProcessStep)
    : [];
  const overview = (rawAssessment.overview || {}) as Record<string, unknown>;
  rawAssessment.overview = {
    ...overview,
    activityFrequency: typeof overview.activityFrequency === 'string'
      ? overview.activityFrequency
      : firstText(processSteps.flatMap((step) => step.chemicals.map((chemical) => chemical.exposureFrequency))),
  };
  rawAssessment.processSteps = processSteps;
  rawAssessment.storage2 = {
    ...emptyStorage2(),
    ...((rawAssessment.storage2 || {}) as Record<string, unknown>),
    matches: typeof ((rawAssessment.storage2 || {}) as Record<string, unknown>).matches === 'object' && ((rawAssessment.storage2 || {}) as Record<string, unknown>).matches !== null
      ? ((rawAssessment.storage2 || {}) as Record<string, unknown>).matches
      : {},
    pairOverrides: typeof ((rawAssessment.storage2 || {}) as Record<string, unknown>).pairOverrides === 'object' && ((rawAssessment.storage2 || {}) as Record<string, unknown>).pairOverrides !== null
      ? ((rawAssessment.storage2 || {}) as Record<string, unknown>).pairOverrides
      : {},
    assignmentOverrides: typeof ((rawAssessment.storage2 || {}) as Record<string, unknown>).assignmentOverrides === 'object' && ((rawAssessment.storage2 || {}) as Record<string, unknown>).assignmentOverrides !== null
      ? ((rawAssessment.storage2 || {}) as Record<string, unknown>).assignmentOverrides
      : {},
  };
  delete rawAssessment.additional;
  delete rawAssessment.storage;
  return rawAssessment as unknown as Assessment;
}

/**
 * Migrate older Assessment shapes to the current schema.
 * Throws if the input is unrecoverable.
 */
export function migrateAssessment(raw: unknown): Assessment {
  if (!raw || typeof raw !== 'object') throw new Error('Not an assessment object');
  const obj = raw as Record<string, unknown>;
  const v = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1;

  if (v === SCHEMA_VERSION) {
    const rawAssessment = raw as Record<string, unknown>;
    return normalizeCurrentAssessment(rawAssessment);
  }

  // Step migration: v1 → v2 → v3
  let current = obj;
  let currentV = v;

  if (currentV === 1) {
    const oldSubs = Array.isArray(current.substances) ? (current.substances as Array<Record<string, unknown>>) : [];
    const grouped = new Map<string, ProcessStep>();

    for (const s of oldSubs) {
      const step = typeof s.processStep === 'string' ? s.processStep.trim() : '';
      const key = step || `__solo_${uuid()}`;
      if (!grouped.has(key)) grouped.set(key, { id: uuid(), step, description: '', exposureDuration: '', chemicals: [], controls: emptyStepControls() });
      const { processStep: _drop, ...chem } = s;
      void _drop;
      grouped.get(key)!.chemicals.push(chem as unknown as Assessment['processSteps'][number]['chemicals'][number]);
    }

    current = {
      ...(current as object),
      schemaVersion: 2,
      processSteps: Array.from(grouped.values()),
    } as Record<string, unknown>;
    delete (current as { substances?: unknown }).substances;
    currentV = 2;
  }

  if (currentV === 2) {
    // v2 -> v3: keep old emergency text and drop retired legacy storage data.
    const oldAdditional = (current.additional || {}) as Record<string, unknown>;
    const emergency = {
      ...emptyEmergency(),
      emergencySpills: typeof oldAdditional.emergencySpills === 'string' ? oldAdditional.emergencySpills : '',
      emergencyFirstAid: typeof oldAdditional.emergencyFirstAid === 'string' ? oldAdditional.emergencyFirstAid : '',
      emergencyFire: typeof oldAdditional.emergencyFire === 'string' ? oldAdditional.emergencyFire : '',
      wasteHandling: typeof oldAdditional.wasteHandling === 'string' ? oldAdditional.wasteHandling : '',
      other: typeof oldAdditional.other === 'string' ? oldAdditional.other : '',
    };

    const v3 = {
      ...current,
      schemaVersion: 3,
      storage2: emptyStorage2(),
      emergency,
    } as Record<string, unknown>;
    delete v3.additional;
    current = v3;
    currentV = 3;
  }

  if (currentV === 3) {
    current = {
      ...current,
      schemaVersion: 4,
      processSteps: Array.isArray(current.processSteps)
        ? current.processSteps.map(normalizeProcessStep)
        : [],
    } as Record<string, unknown>;
    currentV = 4;
  }

  if (currentV === 4) {
    current = {
      ...current,
      schemaVersion: SCHEMA_VERSION,
    } as Record<string, unknown>;
    return normalizeCurrentAssessment(current);
  }

  if (currentV === SCHEMA_VERSION) return normalizeCurrentAssessment(current);

  throw new Error(`Unsupported schema version: ${currentV}`);
}
