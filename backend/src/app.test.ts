const request = require('supertest');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test';

const fetchAllCourses = jest.fn();
const fetchCourseByCode = jest.fn();
const fetchUnitsForCourse = jest.fn();
const fetchGroupsForCourse = jest.fn();
const fetchUnitsForGroup = jest.fn();
const fetchAllUnits = jest.fn();
const fetchUnitByCode = jest.fn();

jest.mock('./services/aiPlanner', () => ({
  generateStudyPlan: jest.fn(),
}));

jest.mock('./services/courseService', () => ({
  fetchAllCourses,
  fetchCourseByCode,
  fetchUnitsForCourse,
  fetchGroupsForCourse,
  fetchUnitsForGroup,
  fetchAllUnits,
  fetchUnitByCode,
}));

const app = require('./app').default;
const { generateStudyPlan } = require('./services/aiPlanner');
const mockedGenerateStudyPlan = generateStudyPlan;

describe('app routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('should return backend status at root endpoint', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'AI Study Planner backend is running' });
  });

  it('should return AI planner debug status', async () => {
    process.env.OPENAI_MODEL = 'test-model';

    const response = await request(app).get('/api/ai/debug-status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: expect.objectContaining({
        hasOpenAiKey: true,
        configuredModel: 'test-model',
        defaultProgramCode: '62510',
        availableEndpoints: expect.any(Object),
        supportedInputs: expect.any(Object),
      }),
    });
  });

  it('should return 400 when userMessage is missing on generate-plan', async () => {
    const response = await request(app)
      .post('/api/ai/generate-plan')
      .send({ programCode: '62510' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'userMessage is required and must be a string.' });
  });

  it('should return plan data on successful generate-plan request', async () => {
    const samplePlan = { version: '1.0', generatedAt: new Date().toISOString(), language: 'en-GB', plan: {} } as any;
    mockedGenerateStudyPlan.mockResolvedValue(samplePlan as any);

    const response = await request(app)
      .post('/api/ai/generate-plan')
      .send({ userMessage: 'Create a plan', programCode: '62510' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, data: samplePlan });
    expect(mockedGenerateStudyPlan).toHaveBeenCalledWith({ userMessage: 'Create a plan', programCode: '62510' });
  });

  it('should return course names from /api/courses', async () => {
    fetchAllCourses.mockResolvedValue([{ code: '62510', name: 'Master of Information Technology' }]);

    const response = await request(app).get('/api/courses');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      courses: [{ code: '62510', name: 'Master of Information Technology' }],
    });
  });

  it('should return full course details from /api/courses/:code/full', async () => {
    fetchCourseByCode.mockResolvedValue({ code: '62510', title: 'Master of Information Technology' });
    fetchUnitsForCourse.mockResolvedValue([{ code: 'CITS4009', title: 'Computational Data Analysis' }]);
    fetchGroupsForCourse.mockResolvedValue([{ id: 1, group_code: 'CORE', name: 'Core units', rule_text: 'Take all core units' }]);
    fetchUnitsForGroup.mockResolvedValue([{ code: 'CITS4009', title: 'Computational Data Analysis' }]);

    const response = await request(app).get('/api/courses/62510/full');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      course: {
        code: '62510',
        title: 'Master of Information Technology',
        units: [{ code: 'CITS4009', title: 'Computational Data Analysis' }],
        groups: [
          {
            id: 1,
            group_code: 'CORE',
            name: 'Core units',
            rule_text: 'Take all core units',
            units: [{ code: 'CITS4009', title: 'Computational Data Analysis' }],
          },
        ],
      },
    });
  });

  it('should return 404 for missing course code on /api/courses/:code/full', async () => {
    fetchCourseByCode.mockResolvedValue(null);

    const response = await request(app).get('/api/courses/UNKNOWN/full');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Course not found',
    });
  });

  it('should return units from /api/units', async () => {
    fetchAllUnits.mockResolvedValue([{ code: 'CITS4009', title: 'Computational Data Analysis' }]);

    const response = await request(app).get('/api/units');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      units: [{ code: 'CITS4009', title: 'Computational Data Analysis' }],
    });
  });

  it('should return unit details from /api/units/:code', async () => {
    fetchUnitByCode.mockResolvedValue({ code: 'CITS4009', title: 'Computational Data Analysis' });

    const response = await request(app).get('/api/units/CITS4009');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      unit: { code: 'CITS4009', title: 'Computational Data Analysis' },
    });
  });

  it('should return 404 for missing unit code on /api/units/:code', async () => {
    fetchUnitByCode.mockResolvedValue(null);

    const response = await request(app).get('/api/units/UNKNOWN');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Unit not found',
    });
  });
});
