"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import PlanConfigForm, {
  type PlannerProgramOption,
} from "@/components/PlanConfigForm";
import UnitCard from "@/components/UnitCard";
import RightPanel from "@/components/RightPanel";
import {
  buildDraftPlanFromCourse,
  generateAiStudyPlan,
  toSemesterPlan,
  type AiStudyPlanResponse,
} from "@/lib/aiPlannerApi";
import { saveStudyPlan } from "@/lib/planApi";
import {
  buildPlannerValidationRequest,
  validatePlannerPlan,
} from "@/lib/plannerValidationApi";
import {
  fetchCourseDetails,
  fetchCourses,
  formatCourseOptionLabel,
  type CourseGroup,
  type CourseDetails,
  type CourseSummary,
  type CourseUnit,
} from "@/lib/courseApi";
import {
  DEFAULT_PLANNER_CONFIG,
  STUDY_MODE_LABELS,
  buildSemesterName,
  flattenUnits,
  getTotalCredits,
  type PlanUnit,
  type PlannerConfig,
  type SemesterPlan,
} from "@/lib/plannerData";
import {
  validatePlan,
  type ValidationResult,
} from "@/utils/validationRules";
import { exportPlanCsv } from "@/lib/plannerExportApi";
import styles from "./page.module.css";

interface SelectedUnitRef {
  semesterId: number;
  unitCode: string;
}

interface DraggedUnitPayload {
  unitCode: string;
  fromSemesterId?: number;
}

const DEFAULT_UNIT_CREDITS = 6;
const DEFAULT_MAX_SEMESTERS = 12;
const DEFAULT_MAX_UNITS_PER_SEMESTER = 6;
const AI_DISCLAIMER =
  "AI generated plans may not be fully accurate. Please review the validation feedback before finalising your study plan.";
const PLANNER_DRAFT_STORAGE_KEY = "ai-study-planner.currentPlannerDraft.v1";

interface PlannerGridJson {
  courseCode: string;
  specialisation: string;
  semesters: {
    sequence: number;
    term: string;
    units: string[];
  }[];
}

interface PlannerExportPayload {
  courseCode: string;
  courseName: string;
  specialisation: string;
  generatedDate: string;
  plan: PlannerGridJson;
  semesters: {
    sequence: number;
    term: string;
    units: {
      code: string;
      title: string;
      credits: number;
      type: string;
      availability: string[];
    }[];
  }[];
  validationMessages: {
    severity: string;
    category: string;
    title: string;
    message: string;
  }[];
}

interface PlannerDraftSnapshot {
  version: 1;
  planConfig: PlannerConfig;
  activePlanConfig: PlannerConfig | null;
  generatedPlan: SemesterPlan[];
  planGenerated: boolean;
  selectedSpecialisation: string;
  savedPlanId?: string;
  aiPlanResponse: AiStudyPlanResponse | null;
}

function extractUnitCodesFromText(value: string | null | undefined): string[] {
  if (!value) return [];

  return Array.from(new Set(Array.from(value.matchAll(/\b[A-Z]{2,5}\d{3,5}\b/g), (match) => match[0])));
}

function courseUnitToPlanUnit(unit: CourseUnit): PlanUnit {
  return {
    code: unit.code,
    name: unit.title,
    credits: DEFAULT_UNIT_CREDITS,
    description: [
      unit.curriculumType,
      unit.status,
      unit.availabilities.length > 0 ? `Offered in ${unit.availabilities.join(", ")}` : null,
    ].filter(Boolean).join(" · ") || "Course unit from the selected course catalogue.",
    prerequisites: extractUnitCodesFromText(unit.prerequisitesRaw),
    corequisites: extractUnitCodesFromText(unit.corequisitesRaw),
    availability: unit.availabilities.length > 0 ? unit.availabilities : ["Availability unavailable"],
    type:
      `${unit.curriculumType ?? ""} ${unit.status ?? ""}`.toLowerCase().includes("elective") ||
      `${unit.curriculumType ?? ""} ${unit.status ?? ""}`.toLowerCase().includes("option")
        ? "elective"
        : "core",
  };
}

function mergeCourseUnits(...unitGroups: CourseUnit[][]): CourseUnit[] {
  const unitsByCode = new Map<string, CourseUnit>();

  for (const units of unitGroups) {
    for (const unit of units) {
      if (!unit.code || unitsByCode.has(unit.code)) continue;
      unitsByCode.set(unit.code, unit);
    }
  }

  return Array.from(unitsByCode.values());
}

function toBackendSpecialisationValue(value: string): string {
  return value.startsWith("SP-") ? value.replaceAll("-", "_") : value;
}

function buildEmptyPlan(config: PlannerConfig): SemesterPlan[] {
  return Array.from({ length: config.semesters }, (_, index) => ({
    id: index + 1,
    name: buildSemesterName(index),
    units: [],
  }));
}

function buildPlannerGridJson(
  courseCode: string,
  specialisation: string,
  plan: SemesterPlan[]
): PlannerGridJson {
  return {
    courseCode,
    specialisation,
    semesters: plan.map((semester, index) => ({
      sequence: index + 1,
      term: semester.name,
      units: semester.units.map((unit) => unit.code),
    })),
  };
}

function buildExportPayload(input: {
  courseCode: string;
  courseName: string;
  specialisation: string;
  plan: SemesterPlan[];
  validationResult?: ValidationResult;
}): PlannerExportPayload {
  const planJson = buildPlannerGridJson(input.courseCode, input.specialisation, input.plan);

  return {
    courseCode: input.courseCode,
    courseName: input.courseName,
    specialisation: input.specialisation,
    generatedDate: new Date().toISOString(),
    plan: planJson,
    semesters: input.plan.map((semester, index) => ({
      sequence: index + 1,
      term: semester.name,
      units: semester.units.map((unit) => ({
        code: unit.code,
        title: unit.name,
        credits: unit.credits,
        type: unit.type ?? "unit",
        availability: unit.availability,
      })),
    })),
    validationMessages: (input.validationResult?.issues ?? []).map((issue) => ({
      severity: issue.severity,
      category: issue.category,
      title: issue.title,
      message: issue.message,
    })),
  };
}

function csvEscape(value: string | number): string {
  const raw = String(value);
  return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildCsvExport(payload: PlannerExportPayload): string {
  const rows = [
    [
      "semester_sequence",
      "semester_name",
      "unit_code",
      "unit_title",
      "credits",
      "type",
      "validation_messages",
    ],
    ...payload.semesters.flatMap((semester) =>
      semester.units.map((unit) => [
        semester.sequence,
        semester.term,
        unit.code,
        unit.title,
        unit.credits,
        unit.type,
        payload.validationMessages
          .map((message) => `${message.severity.toUpperCase()}: ${message.title} - ${message.message}`)
          .join(" | "),
      ])
    ),
  ];

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileSafe(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plan";
}

function readDraggedUnit(event: React.DragEvent): DraggedUnitPayload | null {
  const raw = event.dataTransfer.getData("application/json");
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<DraggedUnitPayload>;
    return typeof value.unitCode === "string" ? { unitCode: value.unitCode, fromSemesterId: value.fromSemesterId } : null;
  } catch {
    return null;
  }
}

function buildAiMessages(plan: SemesterPlan[]): string[] {
  const units = flattenUnits(plan);
  const messages: string[] = [];

  if (plan.some((semester) => semester.units.length > 4)) {
    messages.push("At least one semester looks heavy. Consider spreading difficult units across later study periods.");
  }
  if (!units.some((unit) => unit.code.startsWith("MATH"))) {
    messages.push("A mathematics foundation would strengthen many technical pathways in later semesters.");
  }
  if (units.some((unit) => unit.type === "elective")) {
    messages.push("You have some flexibility in the current draft. Use electives to balance workload and interests.");
  }
  if (messages.length === 0) {
    messages.push("The current draft looks balanced. Review unit details before you finalise or export the plan.");
    messages.push("Use the unit detail view to inspect prerequisites, availability, and alternatives.");
  }

  return messages.slice(0, 3);
}

function buildCourseSummaryMessage(courseDetails: CourseDetails): string[] {
  const messages: string[] = [];

  if (courseDetails.minPoints !== null || courseDetails.maxPoints !== null) {
    const lower = courseDetails.minPoints ?? courseDetails.maxPoints;
    const upper = courseDetails.maxPoints ?? courseDetails.minPoints;
    messages.push(`Course requirements span ${lower}-${upper} credit points.`);
  }

  if (courseDetails.maxYears !== null) {
    messages.push(`The handbook time limit for this course is ${courseDetails.maxYears} years.`);
  }

  if (courseDetails.specialisations.length > 0) {
    messages.push(`Available specialisations include ${courseDetails.specialisations.join(", ")}.`);
  }

  return messages;
}

function readPlannerDraftSnapshot(): PlannerDraftSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const rawSnapshot = window.sessionStorage.getItem(PLANNER_DRAFT_STORAGE_KEY);
    if (!rawSnapshot) return null;

    const snapshot = JSON.parse(rawSnapshot) as Partial<PlannerDraftSnapshot>;
    if (
      snapshot.version !== 1 ||
      !snapshot.planConfig ||
      !Array.isArray(snapshot.generatedPlan) ||
      typeof snapshot.planGenerated !== "boolean"
    ) {
      return null;
    }

    return {
      version: 1,
      planConfig: snapshot.planConfig,
      activePlanConfig: snapshot.activePlanConfig ?? null,
      generatedPlan: snapshot.generatedPlan,
      planGenerated: snapshot.planGenerated,
      selectedSpecialisation: snapshot.selectedSpecialisation ?? "",
      savedPlanId: snapshot.savedPlanId,
      aiPlanResponse: snapshot.aiPlanResponse ?? null,
    };
  } catch {
    return null;
  }
}

function writePlannerDraftSnapshot(snapshot: PlannerDraftSnapshot | null): void {
  if (typeof window === "undefined") return;

  try {
    if (!snapshot) {
      window.sessionStorage.removeItem(PLANNER_DRAFT_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(PLANNER_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Browser storage can be unavailable in private or restricted modes.
  }
}

function getUnitValidationSeverity(
  validationResult: ValidationResult | null | undefined,
  unitCode: string
): "pass" | "warning" | "fail" {
  if (!validationResult) return "pass";

  const matchingIssues = validationResult.issues.filter((issue) =>
    `${issue.title} ${issue.message}`.includes(unitCode)
  );

  if (matchingIssues.some((issue) => issue.severity === "fail")) return "fail";
  if (matchingIssues.some((issue) => issue.severity === "warning")) return "warning";

  return "pass";
}
function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function PlannerPage() {
  const [planConfig, setPlanConfig] = React.useState<PlannerConfig>(DEFAULT_PLANNER_CONFIG);
  const [activePlanConfig, setActivePlanConfig] = React.useState<PlannerConfig | null>(null);
  const [generatedPlan, setGeneratedPlan] = React.useState<SemesterPlan[]>([]);
  const [planGenerated, setPlanGenerated] = React.useState(false);
  const [selectedUnit, setSelectedUnit] = React.useState<SelectedUnitRef | null>(null);
  const [isSetupPopoverOpen, setIsSetupPopoverOpen] = React.useState(false);
  const [aiPreferences, setAiPreferences] = React.useState("I want a balanced plan with clear prerequisite sequencing.");
  const [aiPlanResponse, setAiPlanResponse] = React.useState<AiStudyPlanResponse | null>(null);
  const [availableCourses, setAvailableCourses] = React.useState<CourseSummary[]>([]);
  const [selectedCourseDetails, setSelectedCourseDetails] = React.useState<CourseDetails | null>(null);
  const [selectedSpecialisation, setSelectedSpecialisation] = React.useState("");
  const [courseLoadError, setCourseLoadError] = React.useState<string | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = React.useState(true);
  const [isLoadingCourseDetails, setIsLoadingCourseDetails] = React.useState(false);
  const [generationError, setGenerationError] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [savedPlanId, setSavedPlanId] = React.useState<string | undefined>(undefined);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [backendValidation, setBackendValidation] = React.useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [isValidatingPlan, setIsValidatingPlan] = React.useState(false);
  const [dragOperationError, setDragOperationError] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [exportMessage, setExportMessage] = React.useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = React.useState<"pdf" | "csv" | null>(null);
  const [isDraftHydrated, setIsDraftHydrated] = React.useState(false);
  const setupPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const setupTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const semesterGridRef = React.useRef<HTMLDivElement | null>(null);
  const handledDropRef = React.useRef(false);
  const validationRequestIdRef = React.useRef(0);

  const programOptions = React.useMemo<PlannerProgramOption[]>(
    () =>
      availableCourses.map((course) => ({
        value: course.code,
        label: formatCourseOptionLabel(course),
      })),
    [availableCourses]
  );
  const selectedCourseSummary = React.useMemo(
    () => availableCourses.find((course) => course.code === planConfig.program) ?? null,
    [availableCourses, planConfig.program]
  );
  const specialisationOptions = React.useMemo(
    () =>
      (selectedCourseDetails?.specialisations ?? selectedCourseSummary?.specialisations ?? []).map((specialisation) => ({
        value: specialisation,
        label: specialisation,
      })),
    [selectedCourseDetails, selectedCourseSummary]
  );
  const activeCourseSummary = React.useMemo(
    () =>
      activePlanConfig
        ? availableCourses.find((course) => course.code === activePlanConfig.program) ?? null
        : null,
    [activePlanConfig, availableCourses]
  );
  const maxSemesters = React.useMemo(() => {
    const courseLimit = selectedCourseDetails?.maxYears
      ? selectedCourseDetails.maxYears * 2
      : DEFAULT_MAX_SEMESTERS;

    return Math.max(1, Math.min(DEFAULT_MAX_SEMESTERS, courseLimit));
  }, [selectedCourseDetails?.maxYears]);
  const allUnits = React.useMemo(() => flattenUnits(generatedPlan), [generatedPlan]);
  const totalCredits = React.useMemo(() => getTotalCredits(generatedPlan), [generatedPlan]);
  const localValidationResult = React.useMemo(
    () => (planGenerated ? validatePlan(generatedPlan, allUnits.map((unit) => unit.code)) : undefined),
    [generatedPlan, planGenerated, allUnits]
  );
  const validationResult = backendValidation ?? localValidationResult;
  const validationSource = backendValidation ? "backend" : "local";
  const visiblePlan = planGenerated ? generatedPlan : buildEmptyPlan(planConfig);
  const plannedUnitCodes = React.useMemo(
    () => new Set(flattenUnits(generatedPlan).map((unit) => unit.code)),
    [generatedPlan]
  );
  const catalogueUnits = React.useMemo(
    () =>
      mergeCourseUnits(
        selectedCourseDetails?.units ?? [],
        ...(selectedCourseDetails?.groups ?? []).map((group) => group.units)
      ),
    [selectedCourseDetails]
  );
  const unplannedCourseUnits = React.useMemo(
    () => catalogueUnits.filter((unit) => !plannedUnitCodes.has(unit.code)),
    [catalogueUnits, plannedUnitCodes]
  );
  const courseCodeForPlan = activePlanConfig?.program ?? planConfig.program;
  const courseNameForPlan =
    activeCourseSummary?.title ??
    (selectedCourseDetails?.code === courseCodeForPlan ? selectedCourseDetails.title : null) ??
    courseCodeForPlan;
  const exportPayload = React.useMemo(
    () =>
      buildExportPayload({
        courseCode: courseCodeForPlan,
        courseName: courseNameForPlan,
        specialisation: selectedSpecialisation,
        plan: generatedPlan,
        validationResult,
      }),
    [courseCodeForPlan, courseNameForPlan, generatedPlan, selectedSpecialisation, validationResult]
  );
  const configWarnings = React.useMemo(() => {
    const warnings: string[] = [];

    if (selectedCourseDetails?.maxYears) {
      warnings.push(
        `This course should normally be completed within ${selectedCourseDetails.maxYears} years.`
      );
    }

    if (planConfig.semesters >= maxSemesters && selectedCourseDetails?.maxYears) {
      warnings.push("Please check whether your selected study duration is realistic.");
    }

    if (planConfig.unitsPerSemester >= 5) {
      warnings.push("This is a heavy study load. Check whether overload or summer study is appropriate.");
    } else if (planConfig.unitsPerSemester <= 1) {
      warnings.push("This is a light study load and may extend your course duration.");
    }

    return warnings;
  }, [
    maxSemesters,
    planConfig.semesters,
    planConfig.unitsPerSemester,
    selectedCourseDetails?.maxYears,
  ]);
  const aiMessages = React.useMemo(
    () => {
      if (!planGenerated) return [];

      if (aiPlanResponse) {
        return [
          aiPlanResponse.explanation.overview,
          ...aiPlanResponse.explanation.electiveRationales,
          ...aiPlanResponse.warnings,
        ].filter(Boolean).slice(0, 3);
      }

      const courseMessages = selectedCourseDetails
        ? buildCourseSummaryMessage(selectedCourseDetails)
        : [];

      return [...courseMessages, ...buildAiMessages(generatedPlan)].slice(0, 3);
    },
    [aiPlanResponse, generatedPlan, planGenerated, selectedCourseDetails]
  );

  const selectedUnitDetails: PlanUnit | undefined = React.useMemo(() => {
    if (!selectedUnit) return undefined;
    return generatedPlan
      .find((semester) => semester.id === selectedUnit.semesterId)
      ?.units.find((unit) => unit.code === selectedUnit.unitCode);
  }, [generatedPlan, selectedUnit]);

  React.useEffect(() => {
    const draftSnapshot = readPlannerDraftSnapshot();

    if (draftSnapshot) {
      setPlanConfig(draftSnapshot.planConfig);
      setActivePlanConfig(draftSnapshot.activePlanConfig);
      setGeneratedPlan(draftSnapshot.generatedPlan);
      setPlanGenerated(draftSnapshot.planGenerated);
      setSelectedSpecialisation(draftSnapshot.selectedSpecialisation);
      setSavedPlanId(draftSnapshot.savedPlanId);
      setAiPlanResponse(draftSnapshot.aiPlanResponse);
      setSelectedUnit(null);
      setIsSetupPopoverOpen(false);
    }

    setIsDraftHydrated(true);
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadCourses() {
      setIsLoadingCourses(true);
      setCourseLoadError(null);

      try {
        const courses = await fetchCourses(controller.signal);
        setAvailableCourses(courses);

        if (courses.length > 0) {
          setPlanConfig((currentConfig) => {
            const currentCourseExists = courses.some((course) => course.code === currentConfig.program);
            const preferredCourse = currentCourseExists
              ? courses.find((course) => course.code === currentConfig.program)
              : courses.find((course) => course.code === "62510") ?? courses[0];

            return {
              ...currentConfig,
              program: preferredCourse?.code ?? currentConfig.program,
            };
          });
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        setCourseLoadError(
          error instanceof Error ? error.message : "Unable to load the course catalogue."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCourses(false);
        }
      }
    }

    loadCourses();

    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    if (!planConfig.program) {
      setSelectedCourseDetails(null);
      setSelectedSpecialisation("");
      return undefined;
    }

    if (selectedCourseDetails?.code === planConfig.program) {
      return undefined;
    }

    const controller = new AbortController();

    setIsLoadingCourseDetails(true);
    setCourseLoadError(null);
    setSelectedCourseDetails(null);
    setSelectedSpecialisation("");

    fetchCourseDetails(planConfig.program, controller.signal)
      .then((details) => {
        if (controller.signal.aborted) return;

        setSelectedCourseDetails(details);
        setCourseLoadError(null);
        setSelectedSpecialisation((currentValue) =>
          currentValue && details.specialisations.includes(currentValue) ? currentValue : ""
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        setCourseLoadError(
          error instanceof Error ? error.message : "Unable to load the selected course details."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingCourseDetails(false);
        }
      });

    return () => controller.abort();
  }, [planConfig.program, selectedCourseDetails?.code]);

  React.useEffect(() => {
    setPlanConfig((currentConfig) => {
      if (
        currentConfig.semesters <= maxSemesters &&
        currentConfig.unitsPerSemester <= DEFAULT_MAX_UNITS_PER_SEMESTER
      ) {
        return currentConfig;
      }

      return {
        ...currentConfig,
        semesters: Math.min(currentConfig.semesters, maxSemesters),
        unitsPerSemester: Math.min(currentConfig.unitsPerSemester, DEFAULT_MAX_UNITS_PER_SEMESTER),
      };
    });
  }, [maxSemesters]);

  React.useEffect(() => {
    if (!planGenerated || !isSetupPopoverOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (setupPopoverRef.current?.contains(target) || setupTriggerRef.current?.contains(target)) {
        return;
      }
      setIsSetupPopoverOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSetupPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [planGenerated, isSetupPopoverOpen]);

  React.useEffect(() => {
    if (!isDraftHydrated) return;

    if (!planGenerated || generatedPlan.length === 0) {
      writePlannerDraftSnapshot(null);
      return;
    }

    writePlannerDraftSnapshot({
      version: 1,
      planConfig,
      activePlanConfig,
      generatedPlan,
      planGenerated,
      selectedSpecialisation,
      savedPlanId,
      aiPlanResponse,
    });
  }, [
    activePlanConfig,
    aiPlanResponse,
    generatedPlan,
    isDraftHydrated,
    planConfig,
    planGenerated,
    savedPlanId,
    selectedSpecialisation,
  ]);

  React.useEffect(() => {
    if (!planGenerated || generatedPlan.length === 0 || !activePlanConfig?.program) {
      setBackendValidation(null);
      setValidationError(null);
      setIsValidatingPlan(false);
      return;
    }

    const controller = new AbortController();
    const requestId = validationRequestIdRef.current + 1;
    validationRequestIdRef.current = requestId;

    setBackendValidation(null);
    setValidationError(null);
    setIsValidatingPlan(true);

    validatePlannerPlan(
      buildPlannerValidationRequest({
        courseCode: activePlanConfig.program,
        completedUnits: [],
        selectedSpecialisations: selectedSpecialisation
          ? [toBackendSpecialisationValue(selectedSpecialisation)]
          : [],
        plan: generatedPlan,
      }),
      controller.signal
    )
      .then((result) => {
        if (controller.signal.aborted || requestId !== validationRequestIdRef.current) {
          return;
        }

        setBackendValidation(result);
      })
      .catch((error) => {
        if (controller.signal.aborted || requestId !== validationRequestIdRef.current) {
          return;
        }

        setBackendValidation(null);
        setValidationError(
          error instanceof Error ? error.message : "Backend validation is unavailable right now."
        );
      })
      .finally(() => {
        if (controller.signal.aborted || requestId !== validationRequestIdRef.current) {
          return;
        }

        setIsValidatingPlan(false);
      });

    return () => controller.abort();
  }, [activePlanConfig, generatedPlan, planGenerated, selectedSpecialisation]);

  const buildUserMessage = (nextConfig: PlannerConfig, courseDetails?: CourseDetails | null) => {
    const programLabel =
      courseDetails?.title ?? selectedCourseSummary?.title ?? nextConfig.program;
    const modeLabel = STUDY_MODE_LABELS[nextConfig.studyMode] ?? nextConfig.studyMode;

    return [
      `Create a ${nextConfig.semesters}-semester study plan for ${programLabel} (${nextConfig.program}).`,
      `Study mode: ${modeLabel}.`,
      `Preferred units per semester: ${nextConfig.unitsPerSemester}.`,
      selectedSpecialisation
        ? `Selected specialisation: ${selectedSpecialisation}.`
        : courseDetails?.specialisations.length
        ? `Available specialisations: ${courseDetails.specialisations.join(", ")}.`
        : "No specialisation preference was provided by the course catalogue.",
      `Student preferences: ${aiPreferences.trim() || "No additional preferences provided."}`,
    ].join(" ");
  };

  const applyLocalDraftPlan = (
    nextConfig: PlannerConfig,
    courseDetails?: CourseDetails | null
  ) => {
    setPlanConfig(nextConfig);
    setActivePlanConfig(nextConfig);
    setGeneratedPlan(
      courseDetails ? buildDraftPlanFromCourse(nextConfig, courseDetails) : buildEmptyPlan(nextConfig)
    );
    setPlanGenerated(true);
    setAiPlanResponse(null);
    setSavedPlanId(undefined);
    setSaveMessage(null);
    setSaveError(null);
    setSelectedUnit(null);
    setIsSetupPopoverOpen(false);
    setDragOperationError(null);
    setExportError(null);
    setExportMessage(null);
    if (courseDetails) {
      setSelectedCourseDetails(courseDetails);
    }
  };

  const handleGeneratePlan = async (nextConfig: PlannerConfig) => {
    if (!nextConfig.program) {
      setGenerationError("Select a course before generating a plan.");
      return;
    }

    setPlanConfig(nextConfig);
    setGenerationError(null);
    setIsGenerating(true);
    let courseDetails: CourseDetails | null = null;

    try {
      courseDetails = await fetchCourseDetails(nextConfig.program);
      setSelectedCourseDetails(courseDetails);
      const response = await generateAiStudyPlan({
        programCode: nextConfig.program,
        userMessage: buildUserMessage(nextConfig, courseDetails),
        specialisation: selectedSpecialisation
          ? toBackendSpecialisationValue(selectedSpecialisation)
          : undefined,
        preferredSemesterCount: nextConfig.semesters,
        unitsPerSemester: nextConfig.unitsPerSemester,
        preferences: aiPreferences.trim() || undefined,
      });

      setActivePlanConfig(nextConfig);
      setGeneratedPlan(toSemesterPlan(response, courseDetails));
      setPlanGenerated(true);
      setAiPlanResponse(response);
      setSavedPlanId(undefined);
      setSaveMessage(null);
      setSaveError(null);
      setSelectedUnit(null);
      setIsSetupPopoverOpen(false);
      setDragOperationError(null);
      setExportError(null);
      setExportMessage(null);
    } catch (error) {
      if (courseDetails) {
        applyLocalDraftPlan(nextConfig, courseDetails);
      } else {
        setGenerationError(error instanceof Error ? error.message : "Unable to generate an AI study plan.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearPlan = () => {
    const preferredCourse = availableCourses.find((course) => course.code === "62510") ?? availableCourses[0];

    setPlanConfig({
      ...DEFAULT_PLANNER_CONFIG,
      program: preferredCourse?.code ?? DEFAULT_PLANNER_CONFIG.program,
    });
    setActivePlanConfig(null);
    setGeneratedPlan([]);
    setPlanGenerated(false);
    setSelectedUnit(null);
    setIsSetupPopoverOpen(false);
    setAiPlanResponse(null);
    setSelectedCourseDetails(null);
    setSelectedSpecialisation("");
    setGenerationError(null);
    setSavedPlanId(undefined);
    setSaveMessage(null);
    setSaveError(null);
    setBackendValidation(null);
    setValidationError(null);
    setIsValidatingPlan(false);
    setDragOperationError(null);
    setExportError(null);
    setExportMessage(null);
    setExportingFormat(null);
  };

  const handleSavePlan = async () => {
    if (!planGenerated || generatedPlan.length === 0) return;

    const planConfigToSave = activePlanConfig ?? planConfig;
    const courseCode = planConfigToSave.program;
    const programName =
      activeCourseSummary?.title ??
      selectedCourseDetails?.title ??
      courseCode;

    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const savedPlan = await saveStudyPlan({
        id: savedPlanId,
        name: `${programName} Plan`,
        courseCode,
        program: programName,
        config: planConfigToSave,
        planData: generatedPlan,
      });

      setSavedPlanId(savedPlan.id);
      setSaveMessage("Plan saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save study plan.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeUnitFromPlan = () => {
    if (!selectedUnit) return;

    removeUnitFromSemester(selectedUnit.semesterId, selectedUnit.unitCode);
    setSelectedUnit(null);
  };

  const removeUnitFromSemester = (semesterId: number, unitCode: string) => {
    setGeneratedPlan((currentPlan) =>
      currentPlan.map((semester) =>
        semester.id === semesterId
          ? {
              ...semester,
              units: semester.units.filter((item) => item.code !== unitCode),
            }
          : semester
      )
    );

    setAiPlanResponse(null);
    setSaveMessage(null);
    setSaveError(null);
    setDragOperationError(null);
    setExportMessage(null);
  };

  const findPlanUnit = (unitCode: string): PlanUnit | null => {
    const existingUnit = flattenUnits(generatedPlan).find((unit) => unit.code === unitCode);
    if (existingUnit) return existingUnit;

    const courseUnit = catalogueUnits.find((unit) => unit.code === unitCode);
    return courseUnit ? courseUnitToPlanUnit(courseUnit) : null;
  };

  const updatePlanWithUnit = (
    targetSemesterId: number,
    unitCode: string,
    fromSemesterId?: number
  ) => {
    const unit = findPlanUnit(unitCode);
    if (!unit) {
      setDragOperationError("Unable to add this unit because its catalogue data is missing.");
      return;
    }

    const basePlan = generatedPlan.length > 0 ? generatedPlan : buildEmptyPlan(planConfig);
    const targetSemester = basePlan.find((semester) => semester.id === targetSemesterId);
    if (!targetSemester) {
      setDragOperationError("Unable to move this unit to the selected semester.");
      return;
    }

    setGeneratedPlan((currentPlan) => {
      const basePlan = currentPlan.length > 0 ? currentPlan : buildEmptyPlan(planConfig);

      return basePlan.map((semester) => {
        const withoutDraggedUnit = {
          ...semester,
          units: semester.units.filter((candidate) => candidate.code !== unitCode),
        };

        if (semester.id !== targetSemesterId) {
          return withoutDraggedUnit;
        }

        return {
          ...withoutDraggedUnit,
          units: [...withoutDraggedUnit.units, unit],
        };
      });
    });

    setActivePlanConfig(planConfig);
    setPlanGenerated(true);
    setSelectedUnit(null);
    setAiPlanResponse(null);
    setSaveMessage(
      fromSemesterId && fromSemesterId !== targetSemesterId
        ? `Moved ${unit.code} to ${targetSemester.name}.`
        : `Added ${unit.code} to ${targetSemester.name}.`
    );
    setSaveError(null);
    setDragOperationError(null);
    setExportMessage(null);

    if (fromSemesterId && fromSemesterId !== targetSemesterId) {
      setValidationError(null);
    }
  };

  const handleUnitDragStart = (
    event: React.DragEvent,
    unitCode: string,
    fromSemesterId?: number
  ) => {
    handledDropRef.current = false;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({ unitCode, fromSemesterId } satisfies DraggedUnitPayload)
    );
  };

  const handleSemesterDrop = (event: React.DragEvent, semesterId: number) => {
    event.preventDefault();
    event.stopPropagation();
    handledDropRef.current = true;
    const payload = readDraggedUnit(event);
    if (!payload) {
      setDragOperationError("Unable to read the dragged unit. Please try again.");
      return;
    }

    updatePlanWithUnit(semesterId, payload.unitCode, payload.fromSemesterId);
  };

  const handlePlannedUnitDragEnd = (
    event: React.DragEvent,
    unitCode: string,
    fromSemesterId: number
  ) => {
    if (handledDropRef.current) {
      handledDropRef.current = false;
      return;
    }

    const gridBounds = semesterGridRef.current?.getBoundingClientRect();
    if (!gridBounds) return;

    const { clientX, clientY } = event;
    const droppedOutsideGrid =
      clientX < gridBounds.left ||
      clientX > gridBounds.right ||
      clientY < gridBounds.top ||
      clientY > gridBounds.bottom;

    if (!droppedOutsideGrid) return;

    removeUnitFromSemester(fromSemesterId, unitCode);
    setSelectedUnit(null);
    setSaveMessage(`Removed ${unitCode} from the plan.`);
  };

  const handleExport = async (format: "pdf" | "csv") => {
  if (!planGenerated || generatedPlan.length === 0) {
    setExportError("Generate a plan before exporting.");
    return;
  }

  setExportingFormat(format);
  setExportError(null);
  setExportMessage(null);

  try {
    const filenameBase = fileSafe(
      `${exportPayload.courseCode}-${exportPayload.specialisation || "study-plan"}`
    );

    if (format === "csv") {
      const planConfigToExport = activePlanConfig ?? planConfig;

      const csvBlob = await exportPlanCsv({
        courseCode: planConfigToExport.program,
        program: courseNameForPlan,
        config: planConfigToExport,
        planData: generatedPlan,
      });

      downloadBlobFile(`${filenameBase}.csv`, csvBlob);
      setExportMessage("CSV export prepared.");
    } else {
      downloadTextFile(
        `${filenameBase}-pdf-data.json`,
        JSON.stringify(exportPayload, null, 2),
        "application/json;charset=utf-8"
      );
      setExportMessage("PDF data export prepared.");
    }
  } catch (error) {
    setExportError(
      error instanceof Error
        ? error.message
        : format === "csv"
        ? "Unable to export CSV."
        : "Unable to prepare PDF export data."
    );
  } finally {
    setExportingFormat(null);
  }
};

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main id="main-content" className={styles.main}>
        <div className={styles.content}>
          <div className={styles.plannerWorkspace} aria-busy={isGenerating}>
            {planGenerated ? (
              <section className={styles.setupDock}>
                <div className={styles.compactSetupBar}>
                  <div className={styles.compactSetupCopy}>
                    <span className={styles.compactSetupEyebrow}>Draft Generated</span>
                    <h2 className={styles.compactSetupHeading}>
                      <span>{courseCodeForPlan}</span>
                      <span>{selectedSpecialisation || "No specialisation"}</span>
                      <span>
                        {generatedPlan.length} semester{generatedPlan.length !== 1 ? "s" : ""}
                      </span>
                      <span>{(activePlanConfig ?? planConfig).unitsPerSemester} units/semester</span>
                    </h2>
                    <p className={styles.compactSetupText}>
                      {courseNameForPlan} · {allUnits.length} unit{allUnits.length !== 1 ? "s" : ""} ·{" "}
                      {isValidatingPlan
                        ? "Validating now"
                        : validationResult
                        ? "Last validated just now"
                        : "Validation pending"}
                    </p>
                  </div>

                  <div className={styles.compactSetupActions}>
                    <button
                      ref={setupTriggerRef}
                      type="button"
                      className={styles.setupTrigger}
                      onClick={() => setIsSetupPopoverOpen((open) => !open)}
                      aria-expanded={isSetupPopoverOpen}
                      aria-controls="plan-setup-popover"
                      aria-label={isSetupPopoverOpen ? "Close plan setup" : "Edit plan setup"}
                    >
                      {isSetupPopoverOpen ? "Close Setup" : "Edit Setup"}
                    </button>
                  </div>
                </div>

                {isSetupPopoverOpen ? (
                  <div
                    ref={setupPopoverRef}
                    id="plan-setup-popover"
                    className={styles.setupPopover}
                  >
                    <div className={styles.setupPopoverHeader}>
                      <div>
                        <h3>Adjust Plan Inputs</h3>
                        <p>Change the values below, then regenerate the draft when you are ready.</p>
                      </div>
                    </div>

                    <PlanConfigForm
                      compact
                      showTitle={false}
                      value={planConfig}
                      onChange={setPlanConfig}
                      onGenerate={handleGeneratePlan}
                      onClear={handleClearPlan}
                      programOptions={programOptions}
                      programLoading={isLoadingCourses}
                      programDisabled={isLoadingCourses || Boolean(courseLoadError)}
                      programHelpText={
                        isLoadingCourseDetails
                          ? "Loading course units and specialisations..."
                          : selectedCourseDetails?.units.length
                          ? `${selectedCourseDetails.units.length} units loaded for this course.`
                          : "Course details will appear after loading."
                      }
                      programError={courseLoadError}
                      specialisationOptions={specialisationOptions}
                      specialisationValue={selectedSpecialisation}
                      onSpecialisationChange={setSelectedSpecialisation}
                      maxSemesters={maxSemesters}
                      maxUnitsPerSemester={DEFAULT_MAX_UNITS_PER_SEMESTER}
                      warnings={configWarnings}
                      submitLabel={isGenerating ? "Generating..." : "Regenerate Plan"}
                    />

                    <div className={styles.aiInputBlock}>
                      <label htmlFor="ai-preferences-compact">Planning preferences</label>
                      <textarea
                        id="ai-preferences-compact"
                        value={aiPreferences}
                        onChange={(event) => setAiPreferences(event.target.value)}
                        rows={4}
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            ) : (
              <section className={styles.setupSection}>
                <h2 className={styles.setupTitle}>Plan Setup</h2>
                <PlanConfigForm
                  value={planConfig}
                  onChange={setPlanConfig}
                  onGenerate={handleGeneratePlan}
                  onClear={handleClearPlan}
                  programOptions={programOptions}
                  programLoading={isLoadingCourses}
                  programDisabled={isLoadingCourses || Boolean(courseLoadError)}
                  programHelpText={
                    isLoadingCourseDetails
                      ? "Loading course units and specialisations..."
                      : selectedCourseDetails?.units.length
                      ? `${selectedCourseDetails.units.length} units loaded for this course.`
                      : "Course details will appear after loading."
                  }
                  programError={courseLoadError}
                  specialisationOptions={specialisationOptions}
                  specialisationValue={selectedSpecialisation}
                  onSpecialisationChange={setSelectedSpecialisation}
                  maxSemesters={maxSemesters}
                  maxUnitsPerSemester={DEFAULT_MAX_UNITS_PER_SEMESTER}
                  warnings={configWarnings}
                  submitLabel={isGenerating ? "Generating..." : "Generate Plan"}
                />

                <div className={styles.aiInputBlock}>
                  <label htmlFor="ai-preferences">Planning preferences</label>
                  <textarea
                    id="ai-preferences"
                    value={aiPreferences}
                    onChange={(event) => setAiPreferences(event.target.value)}
                    rows={4}
                  />
                </div>
                <p className={styles.setupHint}>
                  Select your course settings and generate a plan to start planning your semesters.
                </p>
              </section>
            )}

            {generationError ? (
              <section className={styles.errorPanel} role="alert" aria-live="assertive">
                <div>
                  <h3>AI generation failed</h3>
                  <p>{generationError}</p>
                </div>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => applyLocalDraftPlan(planConfig, selectedCourseDetails)}
                >
                  Use local draft
                </button>
              </section>
            ) : null}

            {planGenerated ? (
              <>
                <section className={styles.statusBar} aria-label="Study plan summary" aria-live="polite">
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Course</span>
                    <span className={styles.statusValue}>{courseNameForPlan}</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Mode</span>
                    <span className={styles.statusValue}>
                      {STUDY_MODE_LABELS[activePlanConfig?.studyMode ?? planConfig.studyMode]}
                    </span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Specialisation</span>
                    <span className={styles.statusValue}>{selectedSpecialisation || "None"}</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Semesters</span>
                    <span className={styles.statusValue}>{visiblePlan.length}</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Total Units</span>
                    <span className={styles.statusValue}>{allUnits.length}</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.statusLabel}>Total Credits</span>
                    <span className={styles.statusValue}>{totalCredits}cr</span>
                  </div>
                  {selectedCourseDetails && selectedCourseDetails.minPoints !== null ? (
                    <div className={styles.statusItem}>
                      <span className={styles.statusLabel}>Min Points</span>
                      <span className={styles.statusValue}>{selectedCourseDetails.minPoints}</span>
                    </div>
                  ) : null}
                  {selectedCourseDetails && selectedCourseDetails.maxYears !== null ? (
                    <div className={styles.statusItem}>
                      <span className={styles.statusLabel}>Max Years</span>
                      <span className={styles.statusValue}>{selectedCourseDetails.maxYears}</span>
                    </div>
                  ) : null}
                </section>

                <section className={styles.interactivePlanner} aria-label="Interactive course planner">
                  <div className={styles.plannerLeftRail}>
                    <aside className={styles.unitLibrary} aria-label="Course units and groups">
                      <div className={styles.libraryHeader}>
                        <div>
                          <h2>Course Units</h2>
                          <p>{unplannedCourseUnits.length} available to add</p>
                        </div>
                      </div>

                      {dragOperationError ? (
                        <p className={styles.inlineError} role="alert">{dragOperationError}</p>
                      ) : null}

                      <details className={styles.groupCard}>
                        <summary>
                          <span>AVAILABLE</span>
                          <strong>Available Units</strong>
                        </summary>
                        <div className={styles.libraryUnitList}>
                          {unplannedCourseUnits.length > 0 ? (
                            unplannedCourseUnits.map((unit) => (
                              <button
                                key={unit.code}
                                type="button"
                                className={styles.libraryUnit}
                                draggable
                                onDragStart={(event) => handleUnitDragStart(event, unit.code)}
                                onClick={() => updatePlanWithUnit(visiblePlan[0]?.id ?? 1, unit.code)}
                              >
                                <span>{unit.code}</span>
                                <strong>{unit.title}</strong>
                                <small>
                                  {DEFAULT_UNIT_CREDITS} points · Available:{" "}
                                  {unit.availabilities.length > 0
                                    ? unit.availabilities.join(", ")
                                    : "Not listed"}
                                </small>
                                <em>{unit.curriculumType ?? unit.status ?? "Course unit"}</em>
                              </button>
                            ))
                          ) : (
                            <p className={styles.libraryEmpty}>All loaded units are currently on the plan grid.</p>
                          )}
                        </div>
                      </details>

                      <div className={styles.librarySection}>
                        <h3>Groups</h3>
                        <div className={styles.groupList}>
                          {(selectedCourseDetails?.groups ?? []).length > 0 ? (
                            (selectedCourseDetails?.groups ?? []).map((group: CourseGroup) => (
                              <details key={group.id} className={styles.groupCard}>
                                <summary>
                                  <span>{group.groupCode}</span>
                                  <strong>{group.name}</strong>
                                </summary>
                                {group.ruleText ? <p>{group.ruleText}</p> : null}
                                <div className={styles.groupUnits}>
                                  {group.units.length > 0 ? (
                                    group.units.map((unit) => {
                                      const isPlanned = plannedUnitCodes.has(unit.code);

                                      return (
                                        <button
                                          key={`${group.id}-${unit.code}`}
                                          type="button"
                                          disabled={isPlanned}
                                          draggable={!isPlanned}
                                          onDragStart={(event) => handleUnitDragStart(event, unit.code)}
                                          onClick={() => updatePlanWithUnit(visiblePlan[0]?.id ?? 1, unit.code)}
                                        >
                                          <span>{unit.code}</span>
                                          <small>{isPlanned ? "Already planned" : unit.title}</small>
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <p className={styles.libraryEmpty}>No units available in this group.</p>
                                  )}
                                </div>
                              </details>
                            ))
                          ) : (
                            <p className={styles.libraryEmpty}>No groups loaded for this course.</p>
                          )}
                        </div>
                      </div>
                    </aside>

                    <div className={`${styles.planActions} ${styles.libraryPlanActions}`}>
                      {saveMessage ? <span className={styles.saveStatus}>{saveMessage}</span> : null}
                      {saveError ? <span className={styles.saveError} role="alert">{saveError}</span> : null}
                      {exportMessage ? <span className={styles.saveStatus}>{exportMessage}</span> : null}
                      {exportError ? <span className={styles.saveError} role="alert">{exportError}</span> : null}
                      <button
                        className={styles.primaryBtn}
                        type="button"
                        onClick={handleSavePlan}
                        disabled={isSaving}
                        aria-busy={isSaving}
                      >
                        {isSaving ? "Saving..." : "Save Plan"}
                      </button>
                      <button
                        className={styles.secondaryBtn}
                        type="button"
                        onClick={() => handleExport("pdf")}
                        disabled={exportingFormat !== null}
                        aria-busy={exportingFormat === "pdf"}
                      >
                        {exportingFormat === "pdf" ? "Exporting..." : "Export PDF"}
                      </button>
                      <button
                        className={styles.secondaryBtn}
                        type="button"
                        onClick={() => handleExport("csv")}
                        disabled={exportingFormat !== null}
                        aria-busy={exportingFormat === "csv"}
                      >
                        {exportingFormat === "csv" ? "Exporting..." : "Export CSV"}
                      </button>
                    </div>
                  </div>

                  <section className={styles.planContent} aria-label="Plan grid">
                    <p className={styles.aiDisclaimer}>{AI_DISCLAIMER}</p>

                    <div ref={semesterGridRef} className={styles.semesterGrid}>
                    {visiblePlan.map((semester) => (
                      <article key={semester.id} className={styles.semesterCard}>
                        <div className={styles.semesterMeta}>
                          <h3 className={styles.semesterTitle}>{semester.name}</h3>
                          <div className={styles.semesterStats}>
                            {semester.units.length} unit{semester.units.length !== 1 ? "s" : ""} ·{" "}
                            {semester.units.reduce((sum, unit) => sum + unit.credits, 0)}cr
                          </div>
                        </div>

                        <div
                          className={styles.semesterUnits}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleSemesterDrop(event, semester.id)}
                        >
                          {semester.units.length > 0 ? (
                            semester.units.map((unit) => (
                              <button
                                key={unit.code}
                                type="button"
                                className={`${styles.unitItem} ${styles[getUnitValidationSeverity(validationResult, unit.code)]} ${selectedUnit?.unitCode === unit.code ? styles.activeUnit : ""}`}
                                draggable
                                onDragStart={(event) => handleUnitDragStart(event, unit.code, semester.id)}
                                onDragEnd={(event) => handlePlannedUnitDragEnd(event, unit.code, semester.id)}
                                aria-label={`View details for ${unit.code}, ${unit.name}, in ${semester.name}`}
                                onClick={() =>
                                  setSelectedUnit({
                                    semesterId: semester.id,
                                    unitCode: unit.code,
                                  })
                                }
                              >
                                <div className={styles.unitCardWrapper}>
                                  <UnitCard
                                    code={unit.code}
                                    name={unit.name}
                                    semester={semester.name}
                                    compact
                                  />
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className={styles.emptySemester}>No units allocated yet.</div>
                          )}
                        </div>
                      </article>
                    ))}
                    </div>
                  </section>
                </section>
              </>
            ) : null}
          </div>

          {planGenerated ? (
            <RightPanel
              validationResult={validationResult}
              currentPlanUnitsCount={allUnits.length}
              planGenerated={planGenerated}
              aiMessages={aiMessages}
              validationError={validationError}
              validationPending={isValidatingPlan}
              validationSource={validationSource}
            />
          ) : null}
        </div>
      </main>

      {selectedUnit && selectedUnitDetails ? (
        <div className={styles.modalOverlay} onClick={() => setSelectedUnit(null)}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-dialog-title"
            aria-describedby="unit-dialog-description"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h3 id="unit-dialog-title">{selectedUnitDetails.code}</h3>
                <p>{selectedUnitDetails.name}</p>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setSelectedUnit(null)} aria-label="Close unit details">
                ×
              </button>
            </div>

            <div className={styles.modalSection}>
              <h4>Description</h4>
              <p id="unit-dialog-description">{selectedUnitDetails.description}</p>
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.modalSection}>
                <h4>Prerequisites</h4>
                <p>{selectedUnitDetails.prerequisites.length > 0 ? selectedUnitDetails.prerequisites.join(", ") : "None"}</p>
              </div>
              <div className={styles.modalSection}>
                <h4>Corequisites</h4>
                <p>{selectedUnitDetails.corequisites.length > 0 ? selectedUnitDetails.corequisites.join(", ") : "None"}</p>
              </div>
              <div className={styles.modalSection}>
                <h4>Availability</h4>
                <p>{selectedUnitDetails.availability.join(", ")}</p>
              </div>
              <div className={styles.modalSection}>
                <h4>Credits</h4>
                <p>{selectedUnitDetails.credits}cr</p>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={removeUnitFromPlan}>
                Remove from plan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
