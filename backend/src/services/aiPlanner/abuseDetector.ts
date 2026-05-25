/**
 * Abuse Detection for AI Study Planner
 *
 * Detects prompts that are irrelevant, offensive, excessively long,
 * or appear to be prompt injection attempts.
 */

const STUDY_PLANNING_TERMS = [
  'study plan', 'plan my', 'schedule', 'semester', 'course', 'unit',
  'specialisation', 'specialization', 'degree', 'programme', 'program',
  'enrol', 'enroll', 'prerequisite', 'elective', 'core unit',
  'credit', 'credit point', 'uwa', 'university', 'master of',
  'bachelor of', 'postgraduate', 'undergraduate', 'major',
  'completion', 'graduate', 'graduation', 'handbook',
  'research', 'machine learning', 'software', 'computing',
  'cyber', 'ai ', 'data science', 'networks', 'systems',
  'i want to study', 'i want to learn', 'help me plan',
];

const OFF_TOPIC_TERMS = [
  'write code', 'write a poem', 'write a story', 'recipe',
  'weather', 'joke', 'riddle', 'translate', 'math problem',
  'debug', 'fix bug', 'essay', 'homework', 'assignment help',
  'write me', 'tell me about', 'what is the meaning',
  'how to make', 'how to cook', 'who is', 'where is',
  'how are you', 'what\'s up', 'hello', 'hi there',
  'tell me a joke', 'sing a song',
];

const CHAT_GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|sup|howdy|greetings)(\s+there)?[\s!.,]*$/i,
  /^how are you[\s?]*$/i,
  /^what'?s up[\s?]*$/i,
  /^(good )?(morning|afternoon|evening|night)[\s!.,]*$/i,
];

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|above|system) (instructions?|prompts?)/i,
  /disregard (all )?(previous|prior|above|system) (instructions?|prompts?)/i,
  /forget (all )?(previous|prior|above|system) (instructions?|prompts?)/i,
  /you are now/i,
  /act as (a|an)/i,
  /pretend (you are|to be)/i,
  /system prompt/i,
  /your (original|initial|previous) (instructions?|prompts?)/i,
  /give me your (ip|password|api key|secret|token|credential)/i,
  /your (ip address|password|api key|secret|token)/i,
  /what is your (ip|password|api key)/i,
  /reveal your/i,
  /show me your (system|config|env)/i,
];

const OFFENSIVE_TERMS = [
  'fuck you', 'kill yourself', 'kys', 'nigger', 'retard',
  'dumbass', 'bitch', 'asshole', 'fucking', 'shithead',
];

const MAX_PROMPT_LENGTH = 4000;

interface AbuseResult {
  isAbuse: boolean;
  reason: string;
  category: string;
}

export function detectAbuse(userMessage: string | undefined | null): AbuseResult {
  if (!userMessage || typeof userMessage !== 'string') {
    return { isAbuse: true, reason: 'No valid input provided.', category: 'irrelevant' };
  }

  const trimmed = userMessage.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      isAbuse: true,
      reason: `Input exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.`,
      category: 'excessive_length',
    };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(lower)) {
      return {
        isAbuse: true,
        reason: 'Input contains instructions that could interfere with the planner.',
        category: 'injection',
      };
    }
  }

  for (const term of OFFENSIVE_TERMS) {
    if (lower.includes(term)) {
      return {
        isAbuse: true,
        reason: 'Input contains inappropriate language.',
        category: 'offensive',
      };
    }
  }

  // Chat greetings: clear non-planning intent
  for (const pattern of CHAT_GREETING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isAbuse: true,
        reason: 'Input appears to be a casual greeting/chitchat, not a study planning request.',
        category: 'irrelevant',
      };
    }
  }

  const offTopicHits = OFF_TOPIC_TERMS.filter(t => lower.includes(t));
  if (offTopicHits.length >= 2) {
    return {
      isAbuse: true,
      reason: 'Request does not appear to be related to study planning.',
      category: 'irrelevant',
    };
  }

  const onTopicHits = STUDY_PLANNING_TERMS.filter(t => lower.includes(t));
  if (onTopicHits.length === 0 && trimmed.length >= 20) {
    // Lenient: allow shorter messages through as they may be legitimate planning requests
    return { isAbuse: false, reason: '', category: 'none' };
  }

  return { isAbuse: false, reason: '', category: 'none' };
}
