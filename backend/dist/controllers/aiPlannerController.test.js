"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aiPlannerController_1 = require("./aiPlannerController");
const aiPlanner_1 = require("../services/aiPlanner");
jest.mock('../services/aiPlanner', () => ({
    generateStudyPlan: jest.fn(),
}));
const mockedGenerateStudyPlan = aiPlanner_1.generateStudyPlan;
describe('aiPlannerController', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_MODEL;
    });
    describe('getAiPlannerDebugStatus', () => {
        it('should return runtime configuration with defaults when no env is set', () => {
            const json = jest.fn();
            const status = jest.fn().mockReturnValue({ json });
            const res = { status };
            (0, aiPlannerController_1.getAiPlannerDebugStatus)({}, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({
                ok: true,
                data: {
                    hasOpenAiKey: false,
                    configuredModel: 'gpt-4o',
                    defaultProgramCode: '62510',
                    architecture: 'AI → Validation → Frontend',
                    availableEndpoints: expect.any(Object),
                    supportedInputs: expect.any(Object),
                    responseShape: expect.any(Object),
                },
            });
        });
        it('should include OPENAI_MODEL and OPENAI_API_KEY when configured', () => {
            process.env.OPENAI_MODEL = 'test-model';
            process.env.OPENAI_API_KEY = 'test-key';
            const json = jest.fn();
            const status = jest.fn().mockReturnValue({ json });
            const res = { status };
            (0, aiPlannerController_1.getAiPlannerDebugStatus)({}, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({
                ok: true,
                data: {
                    hasOpenAiKey: true,
                    configuredModel: 'test-model',
                    defaultProgramCode: '62510',
                    architecture: 'AI → Validation → Frontend',
                    availableEndpoints: expect.any(Object),
                    supportedInputs: expect.any(Object),
                    responseShape: expect.any(Object),
                },
            });
        });
    });
    describe('generateStudyPlanResponse', () => {
        it('should return 400 when userMessage is missing', async () => {
            const json = jest.fn();
            const status = jest.fn().mockReturnValue({ json });
            const res = { status };
            const next = jest.fn();
            await (0, aiPlannerController_1.generateStudyPlanResponse)({ body: {} }, res, next);
            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith({ error: 'userMessage is required and must be a string.' });
            expect(next).not.toHaveBeenCalled();
        });
        it('should return plan data when input is valid and programCode is provided', async () => {
            const samplePlan = { version: '1.0', generatedAt: '2026-04-26T00:00:00.000Z', language: 'en-GB', plan: {} };
            const sampleValidation = { overallStatus: 'pass', issues: [] };
            const sampleMetadata = { source: 'ai', tokensUsed: 5000, dailyTokensRemaining: 195000, generationTimeMs: 1500 };
            mockedGenerateStudyPlan.mockResolvedValue({
                plan: samplePlan,
                validation: sampleValidation,
                metadata: sampleMetadata,
            });
            const json = jest.fn();
            const status = jest.fn().mockReturnValue({ json });
            const res = { status };
            const next = jest.fn();
            await (0, aiPlannerController_1.generateStudyPlanResponse)({ body: { userMessage: 'Hi', programCode: '62510' } }, res, next);
            expect(mockedGenerateStudyPlan).toHaveBeenCalledWith({ userMessage: 'Hi', programCode: '62510' });
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({
                ok: true,
                data: samplePlan,
                validation: sampleValidation,
                metadata: sampleMetadata,
            });
            expect(next).not.toHaveBeenCalled();
        });
        it('should default programCode to 62510 when programCode is empty', async () => {
            const samplePlan = { version: '1.0', generatedAt: '2026-04-26T00:00:00.000Z', language: 'en-GB', plan: {} };
            const sampleValidation = { overallStatus: 'pass', issues: [] };
            const sampleMetadata = { source: 'ai', tokensUsed: 5000, dailyTokensRemaining: 195000, generationTimeMs: 1500 };
            mockedGenerateStudyPlan.mockResolvedValue({
                plan: samplePlan,
                validation: sampleValidation,
                metadata: sampleMetadata,
            });
            const json = jest.fn();
            const status = jest.fn().mockReturnValue({ json });
            const res = { status };
            const next = jest.fn();
            await (0, aiPlannerController_1.generateStudyPlanResponse)({ body: { userMessage: 'Hi', programCode: '  ' } }, res, next);
            expect(mockedGenerateStudyPlan).toHaveBeenCalledWith({ userMessage: 'Hi', programCode: '62510' });
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({
                ok: true,
                data: samplePlan,
                validation: sampleValidation,
                metadata: sampleMetadata,
            });
            expect(next).not.toHaveBeenCalled();
        });
        it('should call next with an error when generateStudyPlan throws', async () => {
            const error = new Error('generation failed');
            mockedGenerateStudyPlan.mockRejectedValue(error);
            const json = jest.fn();
            const status = jest.fn().mockReturnValue({ json });
            const res = { status };
            const next = jest.fn();
            await (0, aiPlannerController_1.generateStudyPlanResponse)({ body: { userMessage: 'Hi', programCode: '62510' } }, res, next);
            expect(next).toHaveBeenCalledWith(error);
            expect(status).not.toHaveBeenCalled();
            expect(json).not.toHaveBeenCalled();
        });
    });
});
