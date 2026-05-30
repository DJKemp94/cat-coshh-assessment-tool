import { Assessment, isChemicalIncomplete, riskRating } from '@/types/assessment';

export type CoreSectionId =
  | 'overview'
  | 'substances'
  | 'taskHazards'
  | 'controls'
  | 'additional'
  | 'emergency'
  | 'briefing';

export function sectionMissingItems(a: Assessment, id: CoreSectionId): string[] {
  switch (id) {
    case 'overview': {
      const o = a.overview;
      const missing: string[] = [];
      if (!o.assessor.trim()) missing.push('risk assessor');
      if (!o.dateOfAssessment) missing.push('date of assessment');
      if (
        !o.personsAtRisk.staff &&
        !o.personsAtRisk.students &&
        !o.personsAtRisk.thirdParty &&
        !o.personsAtRisk.contractors &&
        !o.personsAtRisk.visitors &&
        !o.personsAtRisk.public
      ) {
        missing.push('persons at risk');
      }
      return missing;
    }
    case 'substances': {
      if (a.processSteps.length === 0) return ['at least one process step'];
      const firstIncomplete = a.processSteps.findIndex(
        (s) =>
          !s.step.trim() ||
          !s.description.trim() ||
          (s.controls?.engineering?.length ?? 0) === 0 ||
          (s.controls?.ppe?.length ?? 0) === 0 ||
          s.chemicals.length === 0 ||
          s.chemicals.some((c) => isChemicalIncomplete(c)),
      );
      if (firstIncomplete < 0) return [];
      const step = a.processSteps[firstIncomplete];
      const missing: string[] = [];
      if (!step.step.trim()) missing.push('step name');
      if (!step.description.trim()) missing.push('description');
      if (step.chemicals.length === 0) missing.push('at least one chemical');
      else if (step.chemicals.some((c) => isChemicalIncomplete(c))) missing.push('chemical details');
      if ((step.controls?.engineering?.length ?? 0) === 0) missing.push('engineering controls');
      if ((step.controls?.ppe?.length ?? 0) === 0) missing.push('PPE');
      return [`step ${firstIncomplete + 1}: ${missing.join(', ')}`];
    }
    case 'taskHazards': {
      if (a.taskHazards.length === 0 && !a.taskHazardsConfirmedNone) {
        return ['add a hazard or confirm none apply'];
      }
      const firstIncomplete = a.taskHazards.findIndex(
        (h) =>
          !h.hazard.trim() ||
          !h.harmMechanism.trim() ||
          riskRating(h.riskEvaluation) === 0 ||
          riskRating(h.residualRisk) === 0 ||
          !h.controlsInPlace.trim() ||
          (h.furtherAction.trim().length > 0 &&
            (!h.owner.trim() || !h.dueDate.trim() || !h.completionDate.trim())),
      );
      if (firstIncomplete < 0) return [];
      const hazard = a.taskHazards[firstIncomplete];
      const missing: string[] = [];
      if (!hazard.hazard.trim()) missing.push('hazard');
      if (!hazard.harmMechanism.trim()) missing.push('how harm might occur');
      if (riskRating(hazard.riskEvaluation) === 0) missing.push('initial risk');
      if (riskRating(hazard.residualRisk) === 0) missing.push('residual risk');
      if (!hazard.controlsInPlace.trim()) missing.push('control measures');
      if (hazard.furtherAction.trim().length > 0) {
        if (!hazard.owner.trim()) missing.push('action owner');
        if (!hazard.dueDate.trim()) missing.push('due date');
        if (!hazard.completionDate.trim()) missing.push('completion date');
      }
      return [`hazard ${firstIncomplete + 1}: ${missing.join(', ')}`];
    }
    case 'controls': {
      const c = a.controls;
      const missing: string[] = [];
      if (!c.administrative.trim()) missing.push('administrative controls');
      if (!c.airMonitoring.trim()) missing.push('air monitoring');
      if (!c.healthSurveillance.trim()) missing.push('health surveillance');
      return missing;
    }
    case 'additional':
      return a.additional.storage.trim() ? [] : ['storage requirements'];
    case 'emergency': {
      const x = a.emergency;
      const missing: string[] = [];
      if (!x.emergencyFirstAid.trim()) missing.push('first aid');
      if (!x.emergencySpills.trim()) missing.push('spills');
      if (!x.emergencyFire.trim()) missing.push('fire');
      if (!x.wasteHandling.trim()) missing.push('waste handling');
      return missing;
    }
    case 'briefing': {
      if (a.briefing.length === 0) return ['at least one briefing entry'];
      return a.briefing.every((b) => b.name.trim().length > 0) ? [] : ['worker names'];
    }
  }
}

/**
 * Whether a section has enough meaningful content to consider it "filled".
 * This drives the completion dots in the sidebar — it is not validation, so
 * we err on the lenient side. The user is in control.
 */
export function isSectionComplete(a: Assessment, id: CoreSectionId): boolean {
  return sectionMissingItems(a, id).length === 0;
}
