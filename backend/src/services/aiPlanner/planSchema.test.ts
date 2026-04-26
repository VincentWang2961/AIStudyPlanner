import { validateStudyPlanShape } from './planSchema';

describe('validateStudyPlanShape', () => {
  const basePlan = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    language: 'en-GB',
    plan: {
      programCode: 'COMP101',
      programName: 'Computer Science',
      focusArea: 'Artificial Intelligence',
      semesters: [
        {
          sequence: 1,
          label: 'Semester 1',
          units: [
            {
              code: 'CS101',
              title: 'Introduction to Programming',
              creditPoints: 6,
              type: 'core',
            },
          ],
        },
      ],
      summary: {
        totalCreditPoints: 6,
        totalUnits: 1,
        prerequisitesAssumedStrict: true,
      },
    },
    explanation: {
      overview: 'A simple plan overview.',
      electiveRationales: ['Unit choice supports the major.'],
    },
    constraintsAcknowledged: ['Prerequisite rules are understood.'],
    warnings: ['No warnings.'],
  };

  it('should validate a correctly-shaped study plan', () => {
    expect(validateStudyPlanShape(basePlan)).toBe(true);
  });

  it('should reject an invalid version value', () => {
    const invalidPlan = { ...basePlan, version: '2.0' };
    expect(validateStudyPlanShape(invalidPlan)).toBe(false);
  });

  it('should reject a malformed generatedAt value', () => {
    const invalidPlan = { ...basePlan, generatedAt: 'not-a-date' };
    expect(validateStudyPlanShape(invalidPlan)).toBe(false);
  });

  it('should reject a semester with missing units array', () => {
    const invalidPlan = {
      ...basePlan,
      plan: {
        ...basePlan.plan,
        semesters: [
          {
            sequence: 1,
            label: 'Semester 1',
            units: null,
          },
        ],
      },
    };

    expect(validateStudyPlanShape(invalidPlan)).toBe(false);
  });

  it('should reject a unit with an invalid type', () => {
    const invalidPlan = {
      ...basePlan,
      plan: {
        ...basePlan.plan,
        semesters: [
          {
            sequence: 1,
            label: 'Semester 1',
            units: [
              {
                code: 'CS101',
                title: 'Introduction to Programming',
                creditPoints: 6,
                type: 'mandatory',
              },
            ],
          },
        ],
      },
    };

    expect(validateStudyPlanShape(invalidPlan)).toBe(false);
  });
});
