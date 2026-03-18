import { config } from 'dotenv';

config();

const llmConfig = {
  apiKey: process.env.LLM_API_KEY || 'your-api-key',
  endpoint: process.env.LLM_ENDPOINT || 'https://api.llm.example.com',
};

export { llmConfig };
