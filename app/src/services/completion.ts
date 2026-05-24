import { Assessment, isChemicalIncomplete, riskRating } from '@/types/assessment';

export type CoreSectionId =
  | 'overview'
  | 'substances'
  | 'taskHazards'
  | 'controls'
  | 'additional'
  | 'emergency'
  | 'briefing';

/**
 * Whether a section has enough meaningful content to consider it "filled".
 * This drives the completion dots in the sidebar — it is not validation, so
 * we err on the lenient side. The user is in control.
 */
export function isSectionComplete(a: Assessment, id: CoreSectionId): boolean {
  switch (id) {
    case 'overview': {
      const o = a.overview;
      return Boolean(
        o.activityTitle.trim() &&
          o.assessor.trim() &&
          o.dateOfAssessment &&
          (o.personsAtRisk.staff ||
            o.personsAtRisk.students ||
            o.personsAtRisk.thirdParty ||
            o.personsAtRisk.contractors ||
            o.personsAtRisk.visitors ||
            o.personsAtRisk.public),
      );
    }
    case 'substances': {
      if (a.processSteps.length === 0) return false;
      return a.processSteps.every(
        (s) =>
          s.step.trim().length > 0 &&
          s.chemicals.length > 0 &&
          s.chemicals.every((c) => !isChemicalIncomplete(c)),
      );
    }
    case 'taskHazards': {
      // Non-chemical hazards may not apply — but the assessor must explicitly
      // confirm that, otherwise an empty section could be skipped accidentally.
      if (a.taskHazards.length === 0) return Boolean(a.taskHazardsConfirmedNone);
      return a.taskHazards.every(
        (h) => h.hazard.trim().length > 0 && riskRating(h.riskEvaluation) > 0,
      );
    }
    case 'controls': {
      const c = a.controls;
      return Boolean(
        c.engineering.trim() &&
          c.administrative.trim() &&
          c.ppe.type.trim() &&
          c.airMonitoring.trim() &&
          c.healthSurveillance.trim(),
      );
    }
    case 'additional': {
      const x = a.additional;
      return Boolean(x.storage.trim());
    }
    case 'emergency': {
      const x = a.emergency;
      return Boolean(
        x.emergencyFirstAid.trim() &&
          x.emergencySpills.trim() &&
          x.emergencyFire.trim() &&
          x.wasteHandling.trim(),
      );
    }
    case 'briefing':
      return a.briefing.length > 0 && a.briefing.every((b) => b.name.trim().length > 0);
  }
}
