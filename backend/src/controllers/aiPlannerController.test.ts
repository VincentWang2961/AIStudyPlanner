import { Request, Response, NextFunction } from 'express';
import { generateStudyPlanResponse, getAiPlannerDebugStatus } from './aiPlannerController';
import { generateStudyPlan } from '../services/aiPlanner';

jest.mock('../services/aiPlanner', () => ({
  generateStudyPlan: jest.fn(),
}));

const mockedGenerateStudyPlan = generateStudyPlan as jest.MockedFunction<typeof generateStudyPlan>;

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
      const res = { status } as unknown as Response;

      getAiPlannerDebugStatus({} as Request, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        ok: true,
        data: {
          hasOpenAiKey: false,
          configuredModel: 'gpt-5.4',
          defaultProgramCode: '62510',
        },
      });
    });

    it('should include OPENAI_MODEL and OPENAI_API_KEY when configured', () => {
      process.env.OPENAI_MODEL = 'test-model';
      process.env.OPENAI_API_KEY = 'test-key';

      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const res = { status } as unknown as Response;

      getAiPlannerDebugStatus({} as Request, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({
        ok: true,
        data: {
          hasOpenAiKey: true,
          configuredModel: 'test-model',
          defaultProgramCode: '62510',
        },
      });
    });
  });

  describe('generateStudyPlanResponse', () => {
    it('should return 400 when userMessage is missing', async () => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const res = { status } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await generateStudyPlanResponse({ body: {} } as Request, res, next);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: 'userMessage is required and must be a string.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return plan data when input is valid and programCode is provided', async () => {
      const samplePlan = { version: '1.0', generatedAt: '2026-04-26T00:00:00.000Z', language: 'en-GB', plan: {} } as any;
      mockedGenerateStudyPlan.mockResolvedValue(samplePlan as any);

      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const res = { status } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await generateStudyPlanResponse({ body: { userMessage: 'Hi', programCode: '62510' } } as Request, res, next);

      expect(mockedGenerateStudyPlan).toHaveBeenCalledWith({ userMessage: 'Hi', programCode: '62510' });
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ ok: true, data: samplePlan });
      expect(next).not.toHaveBeenCalled();
    });

    it('should default programCode to 62510 when programCode is empty', async () => {
      const samplePlan = { version: '1.0', generatedAt: '2026-04-26T00:00:00.000Z', language: 'en-GB', plan: {} } as any;
      mockedGenerateStudyPlan.mockResolvedValue(samplePlan as any);

      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const res = { status } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await generateStudyPlanResponse({ body: { userMessage: 'Hi', programCode: '  ' } } as Request, res, next);

      expect(mockedGenerateStudyPlan).toHaveBeenCalledWith({ userMessage: 'Hi', programCode: '62510' });
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith({ ok: true, data: samplePlan });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with an error when generateStudyPlan throws', async () => {
      const error = new Error('generation failed');
      mockedGenerateStudyPlan.mockRejectedValue(error);

      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const res = { status } as unknown as Response;
      const next = jest.fn() as NextFunction;

      await generateStudyPlanResponse({ body: { userMessage: 'Hi', programCode: '62510' } } as Request, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });
  });
});
