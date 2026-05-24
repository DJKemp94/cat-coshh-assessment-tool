import {
  Assessment, ProcessStep, SCHEMA_VERSION, uuid, emptyStorage, emptyEmergency,
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
      if (!grouped.has(key)) grouped.set(key, { id: uuid(), step, chemicals: [] });
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
      emergency,
    } as Record<string, unknown>;
    current = v3;
    currentV = 3;
  }

  if (currentV === SCHEMA_VERSION) return current as unknown as Assessment;

  throw new Error(`Unsupported schema version: ${currentV}`);
}
