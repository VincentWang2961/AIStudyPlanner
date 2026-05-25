export interface PlanUnit {
  code: string;
  name: string;
  credits: number;
  type?: string;
  availability?: string[];
}

export interface SemesterPlan {
  id: number;
  name: string;
  units: PlanUnit[];
}

export interface CsvExportRequest {
  courseCode: string;
  program: string;
  config?: unknown;
  planData: SemesterPlan[];
}