import { describe, it, expect } from 'vitest';
import { detectAIBot, getAllTrackedBots, AI_BOT_REGISTRY } from '@/lib/crawler/bot-detector';

describe('detectAIBot', () => {
  it('detects GPTBot from full user-agent string', () => {
    const result = detectAIBot(
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)'
    );
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('gptbot');
  });

  it('detects OAI-SearchBot', () => {
    const result = detectAIBot('OAI-SearchBot/1.0');
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('oai-searchbot');
  });

  it('detects ChatGPT-User', () => {
    const result = detectAIBot(
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)'
    );
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('chatgpt-user');
  });

  it('detects ClaudeBot', () => {
    const result = detectAIBot('ClaudeBot/1.0');
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('claudebot');
  });

  it('detects Google-Extended', () => {
    const result = detectAIBot('Mozilla/5.0 (compatible; Google-Extended)');
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('google-extended');
  });

  it('detects PerplexityBot', () => {
    const result = detectAIBot('PerplexityBot/1.0');
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('perplexitybot');
  });

  it('detects meta-externalagent (case-insensitive)', () => {
    const result = detectAIBot('Mozilla/5.0 (compatible; Meta-ExternalAgent/1.0)');
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('meta-external');
  });

  it('detects Bytespider', () => {
    const result = detectAIBot('Mozilla/5.0 (compatible; Bytespider; https://zhanzhang.toutiao.com/)');
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('bytespider');
  });

  it('detects Amazonbot', () => {
    const result = detectAIBot('Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)');
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('amazonbot');
  });

  it('detects Applebot-Extended', () => {
    const result = detectAIBot('Mozilla/5.0 (Applebot-Extended/0.1; +http://www.apple.com/go/applebot)');
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('applebot-extended');
  });

  it('returns null for regular browser UA (Chrome)', () => {
    const result = detectAIBot(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    expect(result).toBeNull();
  });

  it('returns null for regular browser UA (Safari)', () => {
    const result = detectAIBot(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    );
    expect(result).toBeNull();
  });

  it('returns null for Googlebot (NOT Google-Extended — regular search bot)', () => {
    const result = detectAIBot(
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    );
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectAIBot('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(detectAIBot(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(detectAIBot(undefined)).toBeNull();
  });

  it('returns correct botType, label, engine, description for each match', () => {
    for (const [pattern, expected] of AI_BOT_REGISTRY) {
      const result = detectAIBot(`Mozilla/5.0 (compatible; ${pattern}/1.0)`);
      expect(result).not.toBeNull();
      expect(result!.botType).toBe(expected.botType);
      expect(result!.label).toBe(expected.label);
      expect(result!.engine).toBe(expected.engine);
      expect(result!.description).toBe(expected.description);
    }
  });

  it('first match wins when UA contains multiple bot patterns', () => {
    // GPTBot appears before ChatGPT-User in registry, so GPTBot wins
    const result = detectAIBot('GPTBot ChatGPT-User');
    expect(result).not.toBeNull();
    expect(result!.botType).toBe('gptbot');
  });
});

describe('getAllTrackedBots', () => {
  it('returns all 10 tracked bots', () => {
    const bots = getAllTrackedBots();
    expect(bots).toHaveLength(10);
  });

  it('each entry has botType, label, engine, description', () => {
    const bots = getAllTrackedBots();
    for (const bot of bots) {
      expect(bot.botType).toBeTruthy();
      expect(bot.label).toBeTruthy();
      expect(bot.engine).toBeTruthy();
      expect(bot.description).toBeTruthy();
    }
  });
});
