export type UnitType = 'core' | 'elective' | 'option';

export interface PlannerUnit {
  code: string;
  title: string;
  creditPoints: number;
  type: UnitType;
  availability: string[];
  prerequisites: string[];
  incompatibilities: string[];
  corequisites: string[];
  description: string;
  sequenceOrder?: number;
  isFoundationUnit?: boolean;
}

export interface ProgramConstraint {
  code: string;
  description: string;
  priority: 'mandatory' | 'preferred' | 'informational';
}

export interface SpecialisationInfo {
  code: string;
  name: string;
  coreUnits: string[];
  electiveOptions: string[];
  description: string;
}

export interface ProgramCatalogue {
  programCode: string;
  programName: string;
  totalCreditPoints: number;
  defaultUnitsPerSemester: number;
  constraints: ProgramConstraint[];
  units: PlannerUnit[];
  specialisations: SpecialisationInfo[];
  sequenceData: {
    unitCode: string;
    recommendedSemester: string;
    notes: string;
  }[];
  prerequisiteChains: string[][];
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

export interface SystemMessage {
  type: 'abuse' | 'off_topic' | 'fast_path' | 'irrelevant';
  message: string;
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
  reasoning: {
    prerequisiteAnalysis: string[];
    specialisationFulfillment: string[];
    workloadConsiderations: string[];
  };
  systemMessage?: SystemMessage;
}

export interface GeneratePlanInput {
  userMessage: string;
  programCode: string;
  specialisation?: string;
  completedUnits?: string[];
  preferredSemesterCount?: number;
  unitsPerSemester?: number;
  preferences?: string;
}
