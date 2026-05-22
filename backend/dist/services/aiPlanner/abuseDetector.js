"use strict";
/**
 * Abuse Detection for AI Study Planner
 *
 * Detects prompts that are irrelevant, offensive, excessively long,
 * or appear to be prompt injection attempts. Runs before any OpenAI API call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectAbuse = detectAbuse;
// Keywords strongly associated with legitimate study-planning requests
const STUDY_PLANNING_TERMS = [
    'study plan', 'plan my', 'schedule', 'semester', 'course', 'unit',
    'specialisation', 'specialization', 'degree', 'programme', 'program',
    'enrol', 'enroll', 'prerequisite', 'elective', 'core unit',
    'credit', 'credit point', 'uwa', 'university', 'master of',
    'bachelor of', 'postgraduate', 'undergraduate', 'major',
    'completion', 'graduate', 'graduation', 'handbook',
    // Common study/intent terms
    'research', 'machine learning', 'software', 'computing',
    'cyber', 'ai ', 'data science', 'networks', 'systems',
    'i want to study', 'i want to learn', 'help me plan',
];
// Terms that indicate non-study-planning intent
const OFF_TOPIC_TERMS = [
    'write code', 'write a poem', 'write a story', 'recipe',
    'weather', 'joke', 'riddle', 'translate', 'math problem',
    'debug', 'fix bug', 'essay', 'homework', 'assignment help',
    'write me', 'tell me about', 'what is the meaning',
    'how to make', 'how to cook', 'who is', 'where is',
];
// Patterns indicative of prompt injection
const INJECTION_PATTERNS = [
    /ignore (all )?(previous|prior|above|system) (instructions?|prompts?)/i,
    /disregard (all )?(previous|prior|above|system) (instructions?|prompts?)/i,
    /forget (all )?(previous|prior|above|system) (instructions?|prompts?)/i,
    /you are now/i,
    /act as (a|an)/i,
    /pretend (you are|to be)/i,
    /system prompt/i,
    /your (original|initial|previous) (instructions?|prompts?)/i,
];
// Offensive / harassing terms that should be blocked
const OFFENSIVE_TERMS = [
    'fuck you', 'kill yourself', 'kys', 'nigger', 'retard',
    'dumbass', 'bitch', 'asshole', 'fucking', 'shithead',
];
// Maximum reasonable prompt length (characters)
const MAX_PROMPT_LENGTH = 4000;
function detectAbuse(userMessage) {
    if (!userMessage || typeof userMessage !== 'string') {
        return {
            isAbuse: true,
            reason: 'No valid input provided.',
            category: 'irrelevant',
        };
    }
    const trimmed = userMessage.trim();
    const lower = trimmed.toLowerCase();
    // Check for excessive length
    if (trimmed.length > MAX_PROMPT_LENGTH) {
        return {
            isAbuse: true,
            reason: `Input exceeds maximum length of ${MAX_PROMPT_LENGTH} characters. Please provide a concise study planning request.`,
            category: 'excessive_length',
        };
    }
    // Check for prompt injection patterns
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(lower)) {
            return {
                isAbuse: true,
                reason: 'Your input appears to contain instructions that could interfere with the study planning system. Please provide a valid study planning request.',
                category: 'injection',
            };
        }
    }
    // Check for offensive/harassing content
    for (const term of OFFENSIVE_TERMS) {
        if (lower.includes(term)) {
            return {
                isAbuse: true,
                reason: 'Your input contains inappropriate language. Please provide a valid study planning request.',
                category: 'offensive',
            };
        }
    }
    // Check for strong off-topic indicators
    const offTopicHits = OFF_TOPIC_TERMS.filter(term => lower.includes(term));
    if (offTopicHits.length >= 2) {
        return {
            isAbuse: true,
            reason: 'Your request does not appear to be related to study planning. This tool is designed for generating university study plans. Please provide a relevant request involving course planning, semester scheduling, or programme information.',
            category: 'irrelevant',
        };
    }
    // Check for any study-planning relevance
    const onTopicHits = STUDY_PLANNING_TERMS.filter(term => lower.includes(term));
    if (onTopicHits.length === 0) {
        // Very short messages are hard to classify; be lenient
        if (trimmed.length < 20) {
            // Could be "plan for IT" or similar; let through but add context
            return {
                isAbuse: false,
                reason: '',
                category: 'none',
            };
        }
        // Medium-length message with no study planning keywords
        return {
            isAbuse: true,
            reason: 'Your request does not appear to be related to study planning. Please describe your study-planning needs: which programme, your specialisation, preferences, and any completed units.',
            category: 'irrelevant',
        };
    }
    return {
        isAbuse: false,
        reason: '',
        category: 'none',
    };
}
