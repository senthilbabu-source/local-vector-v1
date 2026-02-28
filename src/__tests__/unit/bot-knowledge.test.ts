import { describe, it, expect } from 'vitest';
import { BOT_KNOWLEDGE_BASE, getBotInfo } from '@/lib/bot-activity/bot-knowledge';
import { getAllTrackedBots } from '@/lib/crawler/bot-detector';

describe('BOT_KNOWLEDGE_BASE', () => {
  const allBotTypes = Object.keys(BOT_KNOWLEDGE_BASE);

  it('has entries for all 10 tracked AI bots', () => {
    expect(allBotTypes.length).toBe(10);
  });

  it('covers all bots in AI_BOT_REGISTRY', () => {
    const registryBots = getAllTrackedBots();
    for (const bot of registryBots) {
      expect(
        BOT_KNOWLEDGE_BASE[bot.botType],
        `Missing knowledge base entry for ${bot.botType}`,
      ).toBeDefined();
    }
  });

  it.each(allBotTypes)('%s has all required fields', (botType) => {
    const info = BOT_KNOWLEDGE_BASE[botType];
    expect(info.displayName).toBeTruthy();
    expect(info.owner).toBeTruthy();
    expect(info.whyItMatters).toBeTruthy();
    expect(info.userAgent).toBeTruthy();
    expect(info.robotsTxtAllow).toBeTruthy();
  });

  it.each(allBotTypes)('%s robotsTxtAllow starts with User-agent:', (botType) => {
    const info = BOT_KNOWLEDGE_BASE[botType];
    expect(info.robotsTxtAllow).toMatch(/^User-agent: .+/);
  });

  it.each(allBotTypes)('%s robotsTxtAllow contains Allow: /', (botType) => {
    const info = BOT_KNOWLEDGE_BASE[botType];
    expect(info.robotsTxtAllow).toContain('Allow: /');
  });

  it.each(allBotTypes)('%s whyItMatters is at least 50 chars (meaningful)', (botType) => {
    const info = BOT_KNOWLEDGE_BASE[botType];
    expect(info.whyItMatters.length).toBeGreaterThan(50);
  });
});

describe('getBotInfo', () => {
  it('returns info for known bot type', () => {
    const info = getBotInfo('gptbot');
    expect(info).not.toBeNull();
    expect(info!.displayName).toBe('GPTBot');
  });

  it('returns info for claudebot', () => {
    const info = getBotInfo('claudebot');
    expect(info).not.toBeNull();
    expect(info!.owner).toBe('Claude (Anthropic)');
  });

  it('returns null for unknown bot type', () => {
    expect(getBotInfo('unknown_bot_xyz')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getBotInfo('')).toBeNull();
  });
});
