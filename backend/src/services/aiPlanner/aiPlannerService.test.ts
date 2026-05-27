import { generateStudyPlan } from './aiPlannerService';
import { getProgrammeCatalogueFromDb } from './databaseCatalogue';

jest.mock('./databaseCatalogue', () => ({
  getProgrammeCatalogueFromDb: jest.fn(),
}));

const validPlanJson = '{"version":"1.0","generatedAt":"2026-04-26T00:00:00.000Z","language":"en-GB","plan":{"programCode":"62510","programName":"Master of Information Technology","focusArea":"Data Science","semesters":[{"sequence":1,"label":"Semester 1","units":[{"code":"CITS4009","title":"Computational Data Analysis","creditPoints":6,"type":"core"}]}],"summary":{"totalCreditPoints":6,"totalUnits":1,"prerequisitesAssumedStrict":true}},"explanation":{"overview":"Overview text.","electiveRationales":["Rationale text."]},"constraintsAcknowledged":["Constraint acknowledged."],"warnings":["No warnings."]}';

const createMock = jest.fn().mockResolvedValue({
  output_text: validPlanJson,
  usage: { total_tokens: 1234 },
});

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      responses: {
        create: createMock,
      },
    })),
  };
});

const mockedGetProgrammeCatalogueFromDb = getProgrammeCatalogueFromDb as jest.MockedFunction<typeof getProgrammeCatalogueFromDb>;

describe('generateStudyPlan integration', () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  beforeEach(() => {
    mockedGetProgrammeCatalogueFromDb.mockReset();
    createMock.mockReset();
    createMock.mockResolvedValue({
      output_text: validPlanJson,
      usage: { total_tokens: 1234 },
    });
  });

  it('should use the mock catalogue when database catalogue is unavailable and return a valid plan', async () => {
    mockedGetProgrammeCatalogueFromDb.mockResolvedValue(null);

    const result = await generateStudyPlan({
      userMessage: 'Create a plan for me.',
      programCode: '62510',
    });

    expect(result).toEqual(expect.objectContaining({
      version: '1.0',
      language: 'en-GB',
      plan: expect.objectContaining({
        programCode: '62510',
        programName: 'Master of Information Technology',
      }),
    }));
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('should throw an error when the model response does not match the expected schema (no fallback)', async () => {
    mockedGetProgrammeCatalogueFromDb.mockResolvedValue(null);
    createMock
      .mockResolvedValueOnce({ output_text: '{"invalid":"response"}' })
      .mockResolvedValueOnce({ output_text: '{"invalid":"response"}' });

    await expect(generateStudyPlan({
      userMessage: 'Create a custom plan for me.',
      programCode: '62510',
    })).rejects.toThrow('Study plan generation failed after 2 attempts');
  });
});
