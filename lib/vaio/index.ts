// ---------------------------------------------------------------------------
// lib/vaio/index.ts — Barrel export
//
// Sprint 109: VAIO — Voice & Conversational AI Optimization
// ---------------------------------------------------------------------------

export { runVAIO, runVAIOForAllLocations, computeVoiceReadinessScore } from './vaio-service';
export { scoreVoiceContent, countActionVerbs, avgSentenceWords, fleschKincaidGrade, containsMarkdown, containsRawUrls, ACTION_VERBS } from './voice-content-scorer';
export { generateSpokenPreview, cleanForVoice, estimateSpokenSeconds, VOICE_IDEAL_MIN_WORDS, VOICE_IDEAL_MAX_WORDS, VOICE_ACCEPTABLE_MAX_WORDS, VOICE_TTS_WPM } from './spoken-answer-previewer';
export { VOICE_QUERY_TEMPLATES, instantiateVoiceTemplate, seedVoiceQueriesForLocation, getVoiceQueriesForLocation } from './voice-query-library';
export { generateLlmsTxt, buildStandardLlmsTxt, buildFullLlmsTxt, formatHoursForVoice } from './llms-txt-generator';
export { auditAICrawlerAccess, parseRobotsTxtForAgent, KNOWN_AI_CRAWLERS, generateRobotsTxtFix } from './ai-crawler-auditor';
export { detectVoiceGaps, triggerVoiceGapDrafts, buildSuggestedAnswer } from './voice-gap-detector';
export * from './types';
