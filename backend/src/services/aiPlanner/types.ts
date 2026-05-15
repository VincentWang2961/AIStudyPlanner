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

// ─── Rate Limiting & Token Tracking ────────────────────────────────────────

export interface TokenUsageRecord {
  date: string;        // YYYY-MM-DD
  tokensUsed: number;
  requestCount: number;
}

export interface RateLimitConfig {
  dailyTokenLimit: number;  // default 1,000,000
  maxRequestsPerDay: number;
}

// ─── Abuse Detection ───────────────────────────────────────────────────────

export interface AbuseDetectionResult {
  isAbuse: boolean;
  reason: string;
  category: 'irrelevant' | 'offensive' | 'excessive_length' | 'injection' | 'none';
}

// ─── Fallback Plans ────────────────────────────────────────────────────────

export interface FallbackPlanMeta {
  programCode: string;
  programName: string;
  specialisation: string;
  generatedAt: string;
  isAiGenerated: false;
}

// ─── Unified Generate Response ─────────────────────────────────────────────

export interface ValidationIssue {
  category: string;
  severity: 'pass' | 'warning' | 'fail';
  title: string;
  message: string;
}

export interface ValidationResult {
  overallStatus: 'pass' | 'warning' | 'fail';
  issues: ValidationIssue[];
}

export interface GeneratePlanResult {
  plan: StudyPlanResponse;
  validation: ValidationResult;
  metadata: {
    source: 'ai' | 'fallback';
    tokensUsed: number;
    dailyTokensRemaining: number;
    generationTimeMs: number;
  };
}
