/**
 * AI bot user-agent detection — pure function.
 * Returns the canonical bot_type string if the UA matches a known AI crawler, else null.
 *
 * Sprint 73 — Centralized bot registry. Never hardcode UA patterns inline.
 */

export interface DetectedBot {
  /** Canonical identifier stored in crawler_hits.bot_type */
  botType: string;
  /** Human-readable label for the dashboard */
  label: string;
  /** Which AI engine this bot feeds */
  engine: string;
  /** Description of what this bot does */
  description: string;
}

/**
 * Known AI bot user-agents.
 * Update this registry when new AI crawlers emerge.
 * Each entry: [UA substring to match (case-insensitive), DetectedBot info]
 *
 * Order matters — first match wins.
 */
export const AI_BOT_REGISTRY: readonly [string, DetectedBot][] = [
  ['GPTBot',             { botType: 'gptbot',            label: 'GPTBot',          engine: 'ChatGPT',            description: 'OpenAI training crawler' }],
  ['OAI-SearchBot',      { botType: 'oai-searchbot',     label: 'OAI-SearchBot',   engine: 'ChatGPT Search',     description: 'ChatGPT live search' }],
  ['ChatGPT-User',       { botType: 'chatgpt-user',      label: 'ChatGPT-User',    engine: 'ChatGPT',            description: 'ChatGPT browsing mode' }],
  ['ClaudeBot',          { botType: 'claudebot',         label: 'ClaudeBot',       engine: 'Claude',             description: 'Anthropic training crawler' }],
  ['Google-Extended',    { botType: 'google-extended',   label: 'Google-Extended', engine: 'Gemini',             description: 'Gemini AI training' }],
  ['PerplexityBot',      { botType: 'perplexitybot',     label: 'PerplexityBot',   engine: 'Perplexity',         description: 'Perplexity search crawler' }],
  ['meta-externalagent', { botType: 'meta-external',     label: 'Meta-External',   engine: 'Meta AI',            description: 'Meta AI training crawler' }],
  ['Bytespider',         { botType: 'bytespider',        label: 'Bytespider',      engine: 'TikTok/ByteDance',   description: 'ByteDance AI crawler' }],
  ['Amazonbot',          { botType: 'amazonbot',         label: 'Amazonbot',       engine: 'Amazon AI',          description: 'Amazon AI crawler' }],
  ['Applebot-Extended',  { botType: 'applebot-extended', label: 'Applebot',        engine: 'Apple Intelligence', description: 'Apple Siri/Intelligence' }],
] as const;

/**
 * Pure function — detects if a User-Agent string belongs to a known AI bot.
 * Returns DetectedBot if matched, null otherwise.
 * Matching is case-insensitive substring match. First match wins.
 */
export function detectAIBot(userAgent: string | null | undefined): DetectedBot | null {
  if (!userAgent) return null;

  const ua = userAgent.toLowerCase();
  for (const [pattern, bot] of AI_BOT_REGISTRY) {
    if (ua.includes(pattern.toLowerCase())) {
      return bot;
    }
  }
  return null;
}

/**
 * Returns the full registry for dashboard display.
 * Used to show ALL possible bots (including ones with 0 visits).
 */
export function getAllTrackedBots(): DetectedBot[] {
  return AI_BOT_REGISTRY.map(([, bot]) => bot);
}
