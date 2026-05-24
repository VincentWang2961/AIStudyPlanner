"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aiPlannerService_1 = require("./aiPlannerService");
const databaseCatalogue_1 = require("./databaseCatalogue");
jest.mock('./databaseCatalogue', () => ({
    getProgrammeCatalogueFromDb: jest.fn(),
}));
const createMock = jest.fn().mockResolvedValue({
    choices: [
        {
            message: {
                content: '{"version":"1.0","generatedAt":"2026-04-26T00:00:00.000Z","language":"en-GB","plan":{"programCode":"62510","programName":"Master of Information Technology","focusArea":"Data Science","semesters":[{"sequence":1,"label":"Semester 1","units":[{"code":"CITS4009","title":"Computational Data Analysis","creditPoints":6,"type":"core"}]}],"summary":{"totalCreditPoints":6,"totalUnits":1,"prerequisitesAssumedStrict":true}},"explanation":{"overview":"Overview text.","electiveRationales":["Rationale text."]},"constraintsAcknowledged":["Constraint acknowledged."],"warnings":["No warnings."]}',
            },
        },
    ],
});
jest.mock('openai', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: createMock,
                },
            },
        })),
    };
});
const mockedGetProgrammeCatalogueFromDb = databaseCatalogue_1.getProgrammeCatalogueFromDb;
describe('generateStudyPlan integration', () => {
    beforeAll(() => {
        process.env.OPENAI_API_KEY = 'test-api-key';
    });
    beforeEach(() => {
        mockedGetProgrammeCatalogueFromDb.mockReset();
        createMock.mockReset();
        createMock.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: '{"version":"1.0","generatedAt":"2026-04-26T00:00:00.000Z","language":"en-GB","plan":{"programCode":"62510","programName":"Master of Information Technology","focusArea":"Data Science","semesters":[{"sequence":1,"label":"Semester 1","units":[{"code":"CITS4009","title":"Computational Data Analysis","creditPoints":6,"type":"core"}]}],"summary":{"totalCreditPoints":6,"totalUnits":1,"prerequisitesAssumedStrict":true}},"explanation":{"overview":"Overview text.","electiveRationales":["Rationale text."]},"constraintsAcknowledged":["Constraint acknowledged."],"warnings":["No warnings."]}',
                    },
                },
            ],
        });
    });
    it('should use the mock catalogue when database catalogue is unavailable and return a valid plan', async () => {
        mockedGetProgrammeCatalogueFromDb.mockResolvedValue(null);
        const result = await (0, aiPlannerService_1.generateStudyPlan)({
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
    });
    it('should return a deterministic fallback when the model response does not match the expected schema', async () => {
        mockedGetProgrammeCatalogueFromDb.mockResolvedValue(null);
        createMock
            .mockResolvedValueOnce({
            choices: [
                {
                    message: {
                        content: '{"invalid":"response"}',
                    },
                },
            ],
        })
            .mockResolvedValueOnce({
            choices: [
                {
                    message: {
                        content: '{"invalid":"response"}',
                    },
                },
            ],
        });
        const result = await (0, aiPlannerService_1.generateStudyPlan)({
            userMessage: 'Create a custom plan for me.',
            programCode: '62510',
        });
        expect(result.warnings).toEqual(expect.arrayContaining([
            expect.stringContaining('AI generation failed after 2 attempts'),
            'This is a deterministically-generated FALLBACK plan.',
        ]));
    });
});
