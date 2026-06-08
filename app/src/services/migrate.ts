import {
  Assessment, ProcessStep, SCHEMA_VERSION, uuid, emptyStorage, emptyStorage2, emptyEmergency, emptyStepControls,
} from '@/types/assessment';

/**
 * Migrate older Assessment shapes to the current schema.
 * Throws if the input is unrecoverable.
 */
export function migrateAssessment(raw: unknown): Assessment {
  if (!raw || typeof raw !== 'object') throw new Error('Not an assessment object');
  const obj = raw as Record<string, unknown>;
  const v = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1;

  if (v === SCHEMA_VERSION) {
    // Defensive: earlier v3 migration used "storage" instead of "additional".
    // Normalise to the canonical shape so old localStorage data doesn't break.
    const rawAssessment = raw as Record<string, unknown>;
    if ('storage' in rawAssessment && !('additional' in rawAssessment)) {
      rawAssessment.additional = rawAssessment.storage;
      delete rawAssessment.storage;
    }
    rawAssessment.additional = {
      ...emptyStorage(),
      ...((rawAssessment.additional || {}) as Record<string, unknown>),
      assignments: typeof ((rawAssessment.additional || {}) as Record<string, unknown>).assignments === 'object' && ((rawAssessment.additional || {}) as Record<string, unknown>).assignments !== null
        ? ((rawAssessment.additional || {}) as Record<string, unknown>).assignments
        : {},
    };
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
    if (Array.isArray(rawAssessment.processSteps)) {
      rawAssessment.processSteps = rawAssessment.processSteps.map((step) => ({
        ...(step as Record<string, unknown>),
        description: typeof (step as Record<string, unknown>).description === 'string'
          ? (step as Record<string, unknown>).description
          : '',
        controls: {
          ...emptyStepControls(),
          ...((step as Record<string, unknown>).controls as Record<string, unknown> | undefined),
        },
      }));
    }
    return rawAssessment as unknown as Assessment;
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
      if (!grouped.has(key)) grouped.set(key, { id: uuid(), step, description: '', chemicals: [], controls: emptyStepControls() });
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
    // v2 → v3: split `additional` into `storage` and `emergency`
    const oldAdditional = (current.additional || {}) as Record<string, unknown>;
    const storage = {
      ...emptyStorage(),
      cheminventoryLogged: Boolean(oldAdditional.cheminventoryLogged),
      sdsVersion: typeof oldAdditional.sdsVersion === 'string' ? oldAdditional.sdsVersion : '',
      sdsDate: typeof oldAdditional.sdsDate === 'string' ? oldAdditional.sdsDate : '',
      storage: typeof oldAdditional.storage === 'string' ? oldAdditional.storage : '',
      incompatibles: typeof oldAdditional.incompatibles === 'string' ? oldAdditional.incompatibles : '',
      assignments: {},
    };
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
      schemaVersion: SCHEMA_VERSION,
      additional: storage,
      storage2: emptyStorage2(),
      emergency,
    } as Record<string, unknown>;
    current = v3;
    currentV = 3;
  }

  if (currentV === SCHEMA_VERSION) return current as unknown as Assessment;

  throw new Error(`Unsupported schema version: ${currentV}`);
}
