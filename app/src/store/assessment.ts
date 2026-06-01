import { create } from 'zustand';
import {
  Assessment,
  newAssessment,
  emptyTaskHazard,
  emptySubstance,
  emptyBriefing,
  emptyProcessStep,
  Substance,
  TaskHazard,
  BriefingEntry,
  Overview,
  ControlMeasures,
  StorageRequirements,
  Storage2Requirements,
  EmergencyRequirements,
  ProcessStep,
  emptyStepControls,
} from '@/types/assessment';
import { migrateAssessment } from '@/services/migrate';
import { normalizeChemicalName } from '@/services/chemicalNames';

const STORAGE_KEY = 'cat.activeAssessment';
const PRIVACY_ACK_KEY = 'cat.privacyAck';
const TESTING_MODE_KEY = 'cat.testingMode';

export type SectionId =
  | 'overview'
  | 'taskHazards'
  | 'substances'
  | 'controls'
  | 'additional'
  | 'storage2'
  | 'emergency'
  | 'briefing'
  | 'completeExport'
  | 'settings'
  | 'help';

interface AssessmentState {
  assessment: Assessment;
  activeSection: SectionId;
  privacyAcknowledged: boolean;
  hydrated: boolean;
  /** When true, the sidebar lets the user jump to any section regardless of
   *  completion order. Intended for testing the UI while data is incomplete. */
  testingMode: boolean;

  setSection: (id: SectionId) => void;
  acknowledgePrivacy: () => void;
  setTestingMode: (v: boolean) => void;

  updateOverview: (patch: Partial<Overview>) => void;
  updateControls: (patch: Partial<ControlMeasures>) => void;
  updateStorage: (patch: Partial<StorageRequirements>) => void;
  updateStorage2: (patch: Partial<Storage2Requirements>) => void;
  updateEmergency: (patch: Partial<EmergencyRequirements>) => void;

  addHazard: () => void;
  updateHazard: (id: string, patch: Partial<TaskHazard>) => void;
  removeHazard: (id: string) => void;
  setTaskHazardsConfirmedNone: (v: boolean) => void;

  addProcessStep: () => void;
  updateProcessStep: (id: string, patch: Partial<ProcessStep>) => void;
  removeProcessStep: (id: string) => void;
  reorderProcessSteps: (fromIndex: number, toIndex: number) => void;

  addChemical: (stepId: string, seed?: Partial<Substance>) => void;
  updateChemical: (stepId: string, chemId: string, patch: Partial<Substance>) => void;
  removeChemical: (stepId: string, chemId: string) => void;

  addBriefing: () => void;
  updateBriefing: (id: string, patch: Partial<BriefingEntry>) => void;
  removeBriefing: (id: string) => void;

  replaceAssessment: (a: Assessment) => void;
  resetAssessment: () => void;
  clearAllLocalData: () => void;
}

const touch = (a: Assessment): Assessment => ({
  ...a,
  meta: { ...a.meta, updatedAt: new Date().toISOString() },
});

const normalizeSubstance = (c: Substance): Substance => ({
  ...c,
  name: normalizeChemicalName(c.name),
});

const normalizeStep = (step: ProcessStep): ProcessStep => ({
  ...step,
  description: step.description ?? '',
  controls: {
    ...emptyStepControls(),
    ...(step.controls ?? {}),
  },
  chemicals: step.chemicals.map(normalizeSubstance),
});

const normalizeAssessment = (a: Assessment): Assessment => ({
  ...a,
  processSteps: a.processSteps.map(normalizeStep),
});

const loadFromStorage = (): {
  assessment: Assessment;
  privacy: boolean;
  testingMode: boolean;
} => {
  let assessment = newAssessment();
  let privacy = false;
  let testingMode = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        assessment = normalizeAssessment(migrateAssessment(JSON.parse(raw)));
      } catch {
        // corrupt or incompatible — fall back to a fresh assessment
      }
    }
    privacy = localStorage.getItem(PRIVACY_ACK_KEY) === '1';
    testingMode = localStorage.getItem(TESTING_MODE_KEY) === '1';
  } catch {
    /* ignore */
  }
  return { assessment, privacy, testingMode };
};

let saveTimer: number | undefined;
const scheduleSave = (a: Assessment) => {
  if (typeof window === 'undefined') return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    } catch {
      /* quota or private mode — silently ignore */
    }
  }, 500);
};

const {
  assessment: initialAssessment,
  privacy: initialPrivacy,
  testingMode: initialTestingMode,
} =
  typeof window !== 'undefined'
    ? loadFromStorage()
    : { assessment: newAssessment(), privacy: false, testingMode: false };

export const useAssessment = create<AssessmentState>((set, get) => {
  const apply = (mutator: (a: Assessment) => Assessment) => {
    const next = touch(mutator(get().assessment));
    set({ assessment: next });
    scheduleSave(next);
  };

  const mutStep = (stepId: string, mut: (s: ProcessStep) => ProcessStep) =>
    apply((a) => ({
      ...a,
      processSteps: a.processSteps.map((s) => (s.id === stepId ? mut(s) : s)),
    }));

  return {
    assessment: initialAssessment,
    activeSection: 'overview',
    privacyAcknowledged: initialPrivacy,
    testingMode: initialTestingMode,
    hydrated: true,

    setSection: (id) => set({ activeSection: id }),
    acknowledgePrivacy: () => {
      try { localStorage.setItem(PRIVACY_ACK_KEY, '1'); } catch { /* ignore */ }
      set({ privacyAcknowledged: true });
    },
    setTestingMode: (v) => {
      try {
        if (v) localStorage.setItem(TESTING_MODE_KEY, '1');
        else localStorage.removeItem(TESTING_MODE_KEY);
      } catch { /* ignore */ }
      set({ testingMode: v });
    },

    updateOverview: (patch) =>
      apply((a) => {
        let next = { ...a.overview, ...patch };
        // If the user moves the assessment date, slide the review date along
        // with it unless they've already nudged the review independently.
        if (
          patch.dateOfAssessment !== undefined &&
          patch.dateOfNextReview === undefined
        ) {
          const prior = a.overview.dateOfAssessment;
          const expectedPriorReview = prior
            ? (() => {
                const d = new Date(prior + 'T00:00:00');
                d.setFullYear(d.getFullYear() + 2);
                return d.toISOString().slice(0, 10);
              })()
            : '';
          const reviewIsDefault =
            !a.overview.dateOfNextReview ||
            a.overview.dateOfNextReview === expectedPriorReview;
          if (reviewIsDefault && patch.dateOfAssessment) {
            const d = new Date(patch.dateOfAssessment + 'T00:00:00');
            d.setFullYear(d.getFullYear() + 2);
            next = { ...next, dateOfNextReview: d.toISOString().slice(0, 10) };
          }
        }
        return { ...a, overview: next };
      }),
    updateControls: (patch) =>
      apply((a) => ({ ...a, controls: { ...a.controls, ...patch } })),
    updateStorage: (patch) =>
      apply((a) => ({ ...a, additional: { ...a.additional, ...patch } })),
    updateStorage2: (patch) =>
      apply((a) => ({ ...a, storage2: { ...a.storage2, ...patch } })),
    updateEmergency: (patch) =>
      apply((a) => ({ ...a, emergency: { ...a.emergency, ...patch } })),

    addHazard: () =>
      apply((a) => ({
        ...a,
        taskHazards: [...a.taskHazards, emptyTaskHazard()],
        taskHazardsConfirmedNone: false,
      })),
    updateHazard: (id, patch) =>
      apply((a) => ({
        ...a,
        taskHazards: a.taskHazards.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      })),
    removeHazard: (id) =>
      apply((a) => ({ ...a, taskHazards: a.taskHazards.filter((h) => h.id !== id) })),
    setTaskHazardsConfirmedNone: (v) =>
      apply((a) => ({ ...a, taskHazardsConfirmedNone: v })),

    addProcessStep: () =>
      apply((a) => ({ ...a, processSteps: [...a.processSteps, emptyProcessStep()] })),
    updateProcessStep: (id, patch) =>
      mutStep(id, (s) => normalizeStep({ ...s, ...patch })),
    removeProcessStep: (id) =>
      apply((a) => ({ ...a, processSteps: a.processSteps.filter((s) => s.id !== id) })),

    reorderProcessSteps: (fromIndex, toIndex) =>
      apply((a) => {
        const steps = [...a.processSteps];
        const [moved] = steps.splice(fromIndex, 1);
        steps.splice(toIndex, 0, moved);
        return { ...a, processSteps: steps };
      }),

    addChemical: (stepId, seed) =>
      mutStep(stepId, (s) => ({
        ...s,
        chemicals: [...s.chemicals, normalizeSubstance({ ...emptySubstance(), ...seed })],
      })),
    updateChemical: (stepId, chemId, patch) =>
      mutStep(stepId, (s) => ({
        ...s,
        chemicals: s.chemicals.map((c) => (c.id === chemId ? normalizeSubstance({ ...c, ...patch }) : c)),
      })),
    removeChemical: (stepId, chemId) =>
      mutStep(stepId, (s) => ({
        ...s,
        chemicals: s.chemicals.filter((c) => c.id !== chemId),
      })),

    addBriefing: () =>
      apply((a) => ({ ...a, briefing: [...a.briefing, emptyBriefing()] })),
    updateBriefing: (id, patch) =>
      apply((a) => ({
        ...a,
        briefing: a.briefing.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      })),
    removeBriefing: (id) =>
      apply((a) => ({ ...a, briefing: a.briefing.filter((b) => b.id !== id) })),

    replaceAssessment: (a) => {
      const next = touch(normalizeAssessment(migrateAssessment(a)));
      set({ assessment: next });
      scheduleSave(next);
    },

    resetAssessment: () => {
      const next = newAssessment();
      set({ assessment: next, activeSection: 'overview' });
      scheduleSave(next);
    },

    clearAllLocalData: () => {
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('cat.')) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
      } catch { /* ignore */ }
      const next = newAssessment();
      set({
        assessment: next,
        activeSection: 'overview',
        privacyAcknowledged: false,
      });
    },
  };
});
