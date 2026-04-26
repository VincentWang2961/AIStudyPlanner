export type UnitType = 'core' | 'elective';

export interface PlannerUnit {
  code: string;
  title: string;
  creditPoints: number;
  type: UnitType;
  availability: string[];
  prerequisites: string[];
  incompatibilities: string[];
  description: string;
}

export interface ProgramConstraint {
  code: string;
  description: string;
}

export interface ProgramCatalogue {
  programCode: string;
  programName: string;
  totalCreditPoints: number;
  defaultUnitsPerSemester: number;
  constraints: ProgramConstraint[];
  units: PlannerUnit[];
}

export interface PlanUnitSelection {
  code: string;
  title: string;
  creditPoints: number;
  type: UnitType;
  rationale?: string;
}

export interface PlanSemester {
  sequence: number;
  label: string;
  units: PlanUnitSelection[];
}

export interface StudyPlanResponse {
  version: '1.0';
  generatedAt: string;
  language: 'en-GB';
  plan: {
    programCode: string;
    programName: string;
    focusArea: string;
    semesters: PlanSemester[];
    summary: {
      totalCreditPoints: number;
      totalUnits: number;
      prerequisitesAssumedStrict: boolean;
    };
  };
  explanation: {
    overview: string;
    electiveRationales: string[];
  };
  constraintsAcknowledged: string[];
  warnings: string[];
}

export interface GeneratePlanInput {
  userMessage: string;
  programCode: string;
  usageKey?: string;
  requestedSemesters?: number;
  requestedUnitsPerSemester?: number;
}
