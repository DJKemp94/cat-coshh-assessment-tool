import {
  Assessment, ProcessStep, SCHEMA_VERSION, uuid,
} from '@/types/assessment';

/**
 * Migrate older Assessment shapes to the current schema.
 * Throws if the input is unrecoverable.
 */
export function migrateAssessment(raw: unknown): Assessment {
  if (!raw || typeof raw !== 'object') throw new Error('Not an assessment object');
  const obj = raw as Record<string, unknown>;
  const v = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1;

  if (v === SCHEMA_VERSION) return raw as Assessment;

  if (v === 1) {
    // v1: flat `substances[]` each with its own processStep string.
    // v2: `processSteps[]` each with `chemicals[]`.
    const oldSubs = Array.isArray(obj.substances) ? (obj.substances as Array<Record<string, unknown>>) : [];
    const grouped = new Map<string, ProcessStep>();

    for (const s of oldSubs) {
      const step = typeof s.processStep === 'string' ? s.processStep.trim() : '';
      const key = step || `__solo_${uuid()}`;
      if (!grouped.has(key)) grouped.set(key, { id: uuid(), step, chemicals: [] });
      const { processStep: _drop, ...chem } = s;
      void _drop;
      grouped.get(key)!.chemicals.push(chem as unknown as Assessment['processSteps'][number]['chemicals'][number]);
    }

    const migrated: Assessment = {
      ...(obj as object),
      schemaVersion: SCHEMA_VERSION,
      processSteps: Array.from(grouped.values()),
    } as Assessment;
    // Remove legacy field.
    delete (migrated as unknown as { substances?: unknown }).substances;
    return migrated;
  }

  throw new Error(`Unsupported schema version: ${v}`);
}
