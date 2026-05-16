// Mock fetch globally
const fetchMock = jest.fn();
global.fetch = fetchMock;

describe('generateAiStudyPlan', () => {
  const mockResponse = {
    plan: {
      programCode: '62510',
      programName: 'Master of Information Technology',
      focusArea: 'Data Science',
      semesters: [
        {
          sequence: 1,
          label: 'Semester 1',
          units: [
            {
              code: 'CITS4009',
              title: 'Computational Data Analysis',
              creditPoints: 6,
              type: 'core' as const,
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
    warnings: ['No warnings.'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call the API with correct parameters and return the response', async () => {
    // Set env var BEFORE importing — module uses it at load time
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001';
    const { generateAiStudyPlan } = await import('./aiPlannerApi');

    const mockFetchResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ ok: true, data: mockResponse }),
    };
    fetchMock.mockResolvedValue(mockFetchResponse);

    const input = {
      programCode: '62510',
      userMessage: 'Create a plan for me',
    };

    const result = await generateAiStudyPlan(input);

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/ai/generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    expect(result).toEqual(mockResponse);
  });

  it('should use default API base URL (127.0.0.1:3001) when env var is not set', async () => {
    // Unset env var BEFORE importing
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    jest.resetModules();
    const { generateAiStudyPlan } = await import('./aiPlannerApi');

    const mockFetchResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ ok: true, data: mockResponse }),
    };
    fetchMock.mockResolvedValue(mockFetchResponse);

    const input = {
      programCode: '62510',
      userMessage: 'Create a plan for me',
    };

    await generateAiStudyPlan(input);

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3001/api/ai/generate-plan', expect.any(Object));
  });

  it('should throw an error when the API call fails', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3001';
    jest.resetModules();
    const { generateAiStudyPlan } = await import('./aiPlannerApi');

    const mockFetchResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    };
    fetchMock.mockResolvedValue(mockFetchResponse);

    const input = {
      programCode: '62510',
      userMessage: 'Create a plan for me',
    };

    await expect(generateAiStudyPlan(input)).rejects.toThrow();
  });
});
