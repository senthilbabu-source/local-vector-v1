// ---------------------------------------------------------------------------
// lib/bot-activity/bot-knowledge.ts — AI Crawler Knowledge Base
//
// Sprint I: Human-readable information about AI crawlers and how to unblock
// them. Used by the BotFixInstructions component.
//
// Never claim a robots.txt change will "definitely" fix a block.
// Always say "should allow" — robots.txt is advisory, not enforced by all bots.
// ---------------------------------------------------------------------------

export interface BotInfo {
  displayName: string;
  owner: string;
  whyItMatters: string;
  userAgent: string;
  robotsTxtAllow: string;
  officialDocs?: string;
}

export const BOT_KNOWLEDGE_BASE: Record<string, BotInfo> = {
  gptbot: {
    displayName: 'GPTBot',
    owner: 'ChatGPT (OpenAI)',
    whyItMatters:
      'GPTBot trains ChatGPT. When blocked, ChatGPT relies on older, potentially inaccurate third-party data about your business instead of reading your website directly.',
    userAgent: 'GPTBot',
    robotsTxtAllow: 'User-agent: GPTBot\nAllow: /',
    officialDocs: 'https://platform.openai.com/docs/gptbot',
  },

  'oai-searchbot': {
    displayName: 'OAI-SearchBot',
    owner: 'ChatGPT Search (OpenAI)',
    whyItMatters:
      'OAI-SearchBot powers ChatGPT\'s real-time search feature. Blocking it means ChatGPT Search shows outdated information about your business when customers ask.',
    userAgent: 'OAI-SearchBot',
    robotsTxtAllow: 'User-agent: OAI-SearchBot\nAllow: /',
    officialDocs: 'https://platform.openai.com/docs/bots',
  },

  'chatgpt-user': {
    displayName: 'ChatGPT-User',
    owner: 'ChatGPT Browsing (OpenAI)',
    whyItMatters:
      'ChatGPT-User is the browsing mode crawler. When blocked, ChatGPT cannot visit your website in real-time when a customer asks it to look up your business.',
    userAgent: 'ChatGPT-User',
    robotsTxtAllow: 'User-agent: ChatGPT-User\nAllow: /',
    officialDocs: 'https://platform.openai.com/docs/bots',
  },

  claudebot: {
    displayName: 'ClaudeBot',
    owner: 'Claude (Anthropic)',
    whyItMatters:
      'ClaudeBot feeds Claude AI. Blocking it means Claude has less accurate information about your business and may describe it incorrectly to customers who ask.',
    userAgent: 'ClaudeBot',
    robotsTxtAllow: 'User-agent: ClaudeBot\nAllow: /',
    officialDocs:
      'https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawl',
  },

  'google-extended': {
    displayName: 'Google-Extended',
    owner: 'Gemini (Google AI)',
    whyItMatters:
      "Google-Extended feeds Gemini, Google's AI assistant. If blocked, Gemini uses older Google index data instead of your current website content.",
    userAgent: 'Google-Extended',
    robotsTxtAllow: 'User-agent: Google-Extended\nAllow: /',
    officialDocs:
      'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers#google-extended',
  },

  perplexitybot: {
    displayName: 'PerplexityBot',
    owner: 'Perplexity AI',
    whyItMatters:
      "PerplexityBot powers Perplexity's real-time search. It's one of the fastest-growing AI search engines. Blocking it means your business information in Perplexity is outdated.",
    userAgent: 'PerplexityBot',
    robotsTxtAllow: 'User-agent: PerplexityBot\nAllow: /',
    officialDocs: 'https://docs.perplexity.ai/guides/bots',
  },

  'meta-external': {
    displayName: 'Meta-External',
    owner: 'Meta AI',
    whyItMatters:
      'Meta-External feeds Meta AI (used in WhatsApp, Instagram, and Facebook). Blocking it means Meta AI has less accurate information when customers ask about your business on these platforms.',
    userAgent: 'meta-externalagent',
    robotsTxtAllow: 'User-agent: meta-externalagent\nAllow: /',
  },

  bytespider: {
    displayName: 'Bytespider',
    owner: 'TikTok / ByteDance AI',
    whyItMatters:
      "Bytespider crawls pages for ByteDance's AI products. As TikTok becomes a search platform for local businesses, having up-to-date information matters.",
    userAgent: 'Bytespider',
    robotsTxtAllow: 'User-agent: Bytespider\nAllow: /',
  },

  amazonbot: {
    displayName: 'Amazonbot',
    owner: 'Amazon AI / Alexa',
    whyItMatters:
      'Amazonbot powers Amazon AI and Alexa. Blocking it means voice assistants like Alexa have outdated information when customers ask about your business.',
    userAgent: 'Amazonbot',
    robotsTxtAllow: 'User-agent: Amazonbot\nAllow: /',
    officialDocs: 'https://developer.amazon.com/amazonbot',
  },

  'applebot-extended': {
    displayName: 'Applebot-Extended',
    owner: 'Apple Intelligence / Siri',
    whyItMatters:
      'Applebot-Extended feeds Apple Intelligence and Siri. Blocking it means Siri and Apple Maps have less accurate business information for iPhone users.',
    userAgent: 'Applebot-Extended',
    robotsTxtAllow: 'User-agent: Applebot-Extended\nAllow: /',
    officialDocs:
      'https://support.apple.com/en-us/119829',
  },
};

/**
 * Get bot info by botType. Returns null if unknown.
 */
export function getBotInfo(botType: string): BotInfo | null {
  return BOT_KNOWLEDGE_BASE[botType] ?? null;
}
