const APP_VERSION = '0.2.0';
export const SCHEMA_VERSION = 3 as const;

export type UUID = string;

export type RiskLevel = 1 | 2 | 3 | 4 | 5;
export interface RiskScore {
  likelihood: RiskLevel | 0;
  severity: RiskLevel | 0;
}
export const riskRating = (s: RiskScore): number =>
  (s.likelihood ?? 0) * (s.severity ?? 0);

export interface PersonsAtRisk {
  staff: boolean;
  students: boolean;
  thirdParty: boolean;
  contractors: boolean;
  visitors: boolean;
  public: boolean;
}

export interface Overview {
  businessUnit: string;
  riskAssessmentRef: string;
  sopRef: string;
  assessor: string;
  dateOfAssessment: string;
  dateOfNextReview: string;
  locations: string;
  activityTitle: string;
  activityOutline: string;
  personsAtRisk: PersonsAtRisk;
}

export type CoshhBand = 'low' | 'medium' | 'high';

export interface TaskHazard {
  id: UUID;
  hazard: string;
  harmMechanism: string;
  riskEvaluation: RiskScore;
  controlsInPlace: string;
  residualRisk: RiskScore;
  furtherAction: string;
  owner: string;
  dueDate: string;
  completionDate: string;
}

export interface HCode {
  code: string;
  text: string;
}

export type GhsPictogram =
  | 'explosive'
  | 'flammable'
  | 'oxidising'
  | 'compressed-gas'
  | 'corrosive'
  | 'toxic'
  | 'harmful'
  | 'health-hazard'
  | 'environmental';

export type SubstanceForm =
  | 'solid'
  | 'liquid'
  | 'gas'
  | 'vapour'
  | 'aerosol'
  | 'mist'
  | 'powder'
  | 'other';

export interface ExposureRoutes {
  inhalation: boolean;
  skin: boolean;
  ingestion: boolean;
  eye: boolean;
}

export type WelSource =
  | 'PubChem-OSHA'
  | 'PubChem-NIOSH'
  | 'EH40'
  | 'Manual-EH40'
  | 'Manual';

export interface Substance {
  id: UUID;
  pubchemCid?: number;
  cas?: string;
  name: string;
  hazardStatements: HCode[];
  ghsPictograms: GhsPictogram[];
  wel: {
    twa?: string;
    stel?: string;
    source?: WelSource;
  };
  quantity: string;
  form: SubstanceForm;
  formNote?: string;
  exposureDuration: string;
  exposureFrequency: string;
  exposureRoutes: ExposureRoutes;
  pubchemFetchedAt?: string;
  sdsUrl?: string;
  sdsSource?: string;
  /** Liquid/gas/vapour/aerosol/mist volatility band — used by COSHH Essentials. */
  volatility?: CoshhBand;
  /** Solid/powder dustiness band — used by COSHH Essentials. */
  dustiness?: CoshhBand;
  /** Boiling point in °C from PubChem (median of reported values). Informational + drives auto volatility band. */
  boilingPointC?: number;
  /** Structural fields from PubChem used for storage classification. */
  molecularFormula?: string;
  canonicalSmiles?: string;
  connectivitySmiles?: string;
  isomericSmiles?: string;
  inchi?: string;
  iupacName?: string;
  pubchemTitle?: string;
  xlogp?: number;
}

export interface StepControls {
  engineering: string[];
  ppe: string[];
  other: string;
}

export interface ControlMeasures {
  elimination: string;
  substitution: string;
  reduction: string;
  engineering: string;
  administrative: string;
  ppe: { type: string; standard: string };
  airMonitoring: string;
  healthSurveillance: string;
}

export interface StorageRequirements {
  cheminventoryLogged: boolean;
  sdsVersion: string;
  sdsDate: string;
  storage: string;
  incompatibles: string;
  assignments: Record<UUID, StorageAssignmentEdit>;
}

export type StorageAssignmentGroup =
  | '1'
  | '2a'
  | '2b'
  | '3'
  | '4'
  | '5a'
  | '5b'
  | '5c'
  | '6'
  | 'general'
  | 'review';

export interface StorageAssignmentEdit {
  groupOverride?: StorageAssignmentGroup;
  guidance?: string;
  alert?: string;
  confirmed?: boolean;
  updatedAt?: string;
}

export interface EmergencyRequirements {
  emergencySpills: string;
  emergencyFirstAid: string;
  emergencyFire: string;
  wasteHandling: string;
  other: string;
}

export interface BriefingEntry {
  id: UUID;
  name: string;
  signaturePng?: string;
  date: string;
}

interface AssessmentMeta {
  createdAt: string;
  updatedAt: string;
  appVersion: string;
}

export interface ProcessStep {
  id: UUID;
  step: string;
  description: string;
  chemicals: Substance[];
  controls: StepControls;
}

export interface Assessment {
  schemaVersion: typeof SCHEMA_VERSION;
  id: UUID;
  overview: Overview;
  taskHazards: TaskHazard[];
  /**
   * Explicit assessor confirmation that no non-chemical hazards apply.
   * Required to mark the Non-Chemical Hazards section complete when the list
   * is empty — prevents accidentally skipping the section.
   */
  taskHazardsConfirmedNone?: boolean;
  processSteps: ProcessStep[];
  controls: ControlMeasures;
  additional: StorageRequirements;
  emergency: EmergencyRequirements;
  briefing: BriefingEntry[];
  meta: AssessmentMeta;
}

export const emptyProcessStep = (): ProcessStep => ({
  id: uuid(),
  step: '',
  description: '',
  chemicals: [],
  controls: emptyStepControls(),
});

export const emptyStepControls = (): StepControls => ({
  engineering: [],
  ppe: [],
  other: '',
});

export const isChemicalIncomplete = (c: Substance): boolean => {
  if (!c.name.trim()) return true;
  if (!c.cas?.trim()) return true;
  if (!c.quantity.trim()) return true;
  if (!c.form) return true;
  if (!c.wel.twa?.trim() && !c.wel.stel?.trim()) return true;
  if (!c.exposureDuration.trim()) return true;
  if (!c.exposureFrequency.trim()) return true;
  if (!Object.values(c.exposureRoutes).some(Boolean)) return true;
  return false;
};

export const uuid = (): UUID =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export const todayISO = (): string => isoDate(new Date());

const plusYearsISO = (years: number): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return isoDate(d);
};

export const emptyOverview = (): Overview => ({
  businessUnit: '',
  riskAssessmentRef: '',
  sopRef: '',
  assessor: '',
  dateOfAssessment: todayISO(),
  dateOfNextReview: plusYearsISO(2),
  locations: '',
  activityTitle: '',
  activityOutline: '',
  personsAtRisk: {
    staff: false,
    students: false,
    thirdParty: false,
    contractors: false,
    visitors: false,
    public: false,
  },
});

export const emptyControls = (): ControlMeasures => ({
  elimination: '',
  substitution: '',
  reduction: '',
  engineering: '',
  administrative: '',
  ppe: { type: '', standard: '' },
  airMonitoring: '',
  healthSurveillance: '',
});

export const emptyStorage = (): StorageRequirements => ({
  cheminventoryLogged: false,
  sdsVersion: '',
  sdsDate: '',
  storage: '',
  incompatibles: '',
  assignments: {},
});

export const emptyEmergency = (): EmergencyRequirements => ({
  emergencySpills: '',
  emergencyFirstAid: '',
  emergencyFire: '',
  wasteHandling: '',
  other: '',
});

export const emptyTaskHazard = (): TaskHazard => ({
  id: uuid(),
  hazard: '',
  harmMechanism: '',
  riskEvaluation: { likelihood: 0, severity: 0 },
  controlsInPlace: '',
  residualRisk: { likelihood: 0, severity: 0 },
  furtherAction: '',
  owner: '',
  dueDate: '',
  completionDate: '',
});

export const emptySubstance = (): Substance => ({
  id: uuid(),
  name: '',
  hazardStatements: [],
  ghsPictograms: [],
  wel: {},
  quantity: '',
  form: 'liquid',
  exposureDuration: '',
  exposureFrequency: '',
  exposureRoutes: { inhalation: false, skin: false, ingestion: false, eye: false },
});

export const emptyBriefing = (): BriefingEntry => ({
  id: uuid(),
  name: '',
  date: todayISO(),
});

export const newAssessment = (): Assessment => {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uuid(),
    overview: emptyOverview(),
    taskHazards: [],
    processSteps: [],
    controls: emptyControls(),
    additional: emptyStorage(),
    emergency: emptyEmergency(),
    briefing: [],
    meta: { createdAt: now, updatedAt: now, appVersion: APP_VERSION },
  };
};
