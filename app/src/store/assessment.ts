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
  AdditionalRequirements,
  ProcessStep,
} from '@/types/assessment';
import { migrateAssessment } from '@/services/migrate';

const STORAGE_KEY = 'cat.activeAssessment';
const PRIVACY_ACK_KEY = 'cat.privacyAck';

export type SectionId =
  | 'overview'
  | 'taskHazards'
  | 'substances'
  | 'controls'
  | 'additional'
  | 'briefing'
  | 'settings'
  | 'help';

interface AssessmentState {
  assessment: Assessment;
  activeSection: SectionId;
  privacyAcknowledged: boolean;
  hydrated: boolean;

  setSection: (id: SectionId) => void;
  acknowledgePrivacy: () => void;

  updateOverview: (patch: Partial<Overview>) => void;
  updateControls: (patch: Partial<ControlMeasures>) => void;
  updateAdditional: (patch: Partial<AdditionalRequirements>) => void;

  addHazard: () => void;
  updateHazard: (id: string, patch: Partial<TaskHazard>) => void;
  removeHazard: (id: string) => void;

  addProcessStep: () => void;
  updateProcessStep: (id: string, patch: Partial<ProcessStep>) => void;
  removeProcessStep: (id: string) => void;

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

const loadFromStorage = (): { assessment: Assessment; privacy: boolean } => {
  let assessment = newAssessment();
  let privacy = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        assessment = migrateAssessment(JSON.parse(raw));
      } catch {
        // corrupt or incompatible — fall back to a fresh assessment
      }
    }
    privacy = localStorage.getItem(PRIVACY_ACK_KEY) === '1';
  } catch {
    /* ignore */
  }
  return { assessment, privacy };
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

const { assessment: initialAssessment, privacy: initialPrivacy } =
  typeof window !== 'undefined'
    ? loadFromStorage()
    : { assessment: newAssessment(), privacy: false };

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
    hydrated: true,

    setSection: (id) => set({ activeSection: id }),
    acknowledgePrivacy: () => {
      try { localStorage.setItem(PRIVACY_ACK_KEY, '1'); } catch { /* ignore */ }
      set({ privacyAcknowledged: true });
    },

    updateOverview: (patch) =>
      apply((a) => ({ ...a, overview: { ...a.overview, ...patch } })),
    updateControls: (patch) =>
      apply((a) => ({ ...a, controls: { ...a.controls, ...patch } })),
    updateAdditional: (patch) =>
      apply((a) => ({ ...a, additional: { ...a.additional, ...patch } })),

    addHazard: () =>
      apply((a) => ({ ...a, taskHazards: [...a.taskHazards, emptyTaskHazard()] })),
    updateHazard: (id, patch) =>
      apply((a) => ({
        ...a,
        taskHazards: a.taskHazards.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      })),
    removeHazard: (id) =>
      apply((a) => ({ ...a, taskHazards: a.taskHazards.filter((h) => h.id !== id) })),

    addProcessStep: () =>
      apply((a) => ({ ...a, processSteps: [...a.processSteps, emptyProcessStep()] })),
    updateProcessStep: (id, patch) =>
      mutStep(id, (s) => ({ ...s, ...patch })),
    removeProcessStep: (id) =>
      apply((a) => ({ ...a, processSteps: a.processSteps.filter((s) => s.id !== id) })),

    addChemical: (stepId, seed) =>
      mutStep(stepId, (s) => ({
        ...s,
        chemicals: [...s.chemicals, { ...emptySubstance(), ...seed }],
      })),
    updateChemical: (stepId, chemId, patch) =>
      mutStep(stepId, (s) => ({
        ...s,
        chemicals: s.chemicals.map((c) => (c.id === chemId ? { ...c, ...patch } : c)),
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
      const next = touch(migrateAssessment(a));
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
