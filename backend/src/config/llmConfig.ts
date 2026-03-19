import { config } from 'dotenv';

config();

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const llmConfig = {
  apiKey: getRequiredEnvVar('LLM_API_KEY'),
  endpoint: getRequiredEnvVar('LLM_ENDPOINT'),
};

export { llmConfig };
