"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractJsonFromModelOutput = extractJsonFromModelOutput;
function extractJsonFromModelOutput(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        return trimmed;
    }
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch && fencedMatch[1]) {
        return fencedMatch[1].trim();
    }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return trimmed.slice(firstBrace, lastBrace + 1);
    }
    return trimmed;
}
