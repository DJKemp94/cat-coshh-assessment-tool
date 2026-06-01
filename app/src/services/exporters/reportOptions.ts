export interface ReportOptions {
  overview: {
    include: boolean;
    details: boolean;
    activityOutline: boolean;
  };
  taskHazards: {
    include: boolean;
    riskDetails: boolean;
    actions: boolean;
  };
  process: {
    include: boolean;
    stepControls: boolean;
    chemicalDetails: boolean;
    ghsPictograms: boolean;
  };
  controls: {
    include: boolean;
    coshhScreening: boolean;
    coshhLegend: boolean;
    hierarchy: boolean;
  };
  storage: {
    include: boolean;
  };
  emergency: {
    include: boolean;
    firstAid: boolean;
    spills: boolean;
    fire: boolean;
    waste: boolean;
    other: boolean;
  };
  briefing: {
    include: boolean;
    signatures: boolean;
  };
}

export const fullReportOptions = (): ReportOptions => ({
  overview: {
    include: true,
    details: true,
    activityOutline: true,
  },
  taskHazards: {
    include: true,
    riskDetails: true,
    actions: true,
  },
  process: {
    include: true,
    stepControls: true,
    chemicalDetails: true,
    ghsPictograms: true,
  },
  controls: {
    include: true,
    coshhScreening: true,
    coshhLegend: true,
    hierarchy: true,
  },
  storage: {
    include: true,
  },
  emergency: {
    include: true,
    firstAid: true,
    spills: true,
    fire: true,
    waste: true,
    other: true,
  },
  briefing: {
    include: true,
    signatures: true,
  },
});
