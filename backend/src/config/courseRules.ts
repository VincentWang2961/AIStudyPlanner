import { config } from 'dotenv';

config();

const courseRules = {
  maxCredits: Number(process.env.MAX_CREDITS) || 30,
  minCredits: Number(process.env.MIN_CREDITS) || 12,
};

export { courseRules };
