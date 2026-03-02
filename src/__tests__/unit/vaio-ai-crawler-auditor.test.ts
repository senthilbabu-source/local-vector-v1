// ---------------------------------------------------------------------------
// vaio-ai-crawler-auditor.test.ts — AI crawler auditor unit tests
//
// Sprint 109: VAIO — ~12 tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  auditAICrawlerAccess,
  parseRobotsTxtForAgent,
  KNOWN_AI_CRAWLERS,
  generateRobotsTxtFix,
} from '@/lib/vaio/ai-crawler-auditor';
import type { AICrawlerStatus } from '@/lib/vaio/types';

describe('parseRobotsTxtForAgent', () => {
  it('returns "blocked" when user-agent has Disallow: /', () => {
    const robots = `
User-agent: GPTBot
Disallow: /
`;
    expect(parseRobotsTxtForAgent(robots, 'GPTBot')).toBe('blocked');
  });

  it('returns "allowed" when user-agent has Allow: /', () => {
    const robots = `
User-agent: GPTBot
Allow: /
`;
    expect(parseRobotsTxtForAgent(robots, 'GPTBot')).toBe('allowed');
  });

  it('returns "allowed" when user-agent section exists but no directives', () => {
    const robots = `
User-agent: GPTBot

User-agent: Googlebot
Disallow: /private
`;
    expect(parseRobotsTxtForAgent(robots, 'GPTBot')).toBe('allowed');
  });

  it('returns "not_specified" when user-agent is not in robots.txt and no wildcard', () => {
    const robots = `
User-agent: Googlebot
Disallow: /private
`;
    expect(parseRobotsTxtForAgent(robots, 'GPTBot')).toBe('not_specified');
  });

  it('falls back to wildcard section when agent not found', () => {
    const robots = `
User-agent: *
Disallow: /
`;
    expect(parseRobotsTxtForAgent(robots, 'PerplexityBot')).toBe('blocked');
  });

  it('returns "allowed" from wildcard when Allow: /', () => {
    const robots = `
User-agent: *
Allow: /
`;
    expect(parseRobotsTxtForAgent(robots, 'ClaudeBot')).toBe('allowed');
  });

  it('is case-insensitive for user-agent matching', () => {
    const robots = `
User-agent: gptbot
Disallow: /
`;
    expect(parseRobotsTxtForAgent(robots, 'GPTBot')).toBe('blocked');
  });

  it('Allow takes precedence over Disallow when both present', () => {
    const robots = `
User-agent: GPTBot
Disallow: /
Allow: /
`;
    expect(parseRobotsTxtForAgent(robots, 'GPTBot')).toBe('allowed');
  });

  it('handles multiple user-agent sections correctly', () => {
    const robots = `
User-agent: Googlebot
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Allow: /
`;
    expect(parseRobotsTxtForAgent(robots, 'GPTBot')).toBe('blocked');
    expect(parseRobotsTxtForAgent(robots, 'PerplexityBot')).toBe('allowed');
  });

  it('ignores comment lines', () => {
    const robots = `
# This is a comment
User-agent: GPTBot
# Block this bot
Disallow: /
`;
    expect(parseRobotsTxtForAgent(robots, 'GPTBot')).toBe('blocked');
  });
});

describe('KNOWN_AI_CRAWLERS', () => {
  it('has exactly 10 crawlers', () => {
    expect(KNOWN_AI_CRAWLERS).toHaveLength(10);
  });

  it('includes critical crawlers', () => {
    const names = KNOWN_AI_CRAWLERS.map((c) => c.name);
    expect(names).toContain('GPTBot');
    expect(names).toContain('PerplexityBot');
    expect(names).toContain('Google-Extended');
    expect(names).toContain('ClaudeBot');
  });

  it('has impact levels for all crawlers', () => {
    for (const crawler of KNOWN_AI_CRAWLERS) {
      expect(['high', 'medium', 'low']).toContain(crawler.impact);
    }
  });
});

describe('generateRobotsTxtFix', () => {
  it('generates allow rules for blocked/missing crawlers', () => {
    const blockedCrawlers: AICrawlerStatus[] = [
      { name: 'GPTBot', user_agent: 'GPTBot', status: 'blocked', used_by: 'ChatGPT', impact: 'high' },
      { name: 'ClaudeBot', user_agent: 'ClaudeBot', status: 'not_specified', used_by: 'Claude', impact: 'medium' },
    ];
    const fix = generateRobotsTxtFix(blockedCrawlers);
    expect(fix).toContain('User-agent: GPTBot');
    expect(fix).toContain('User-agent: ClaudeBot');
    expect(fix).toContain('Allow: /');
  });

  it('returns empty string for no crawlers', () => {
    expect(generateRobotsTxtFix([])).toBe('');
  });
});

describe('auditAICrawlerAccess', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns all crawlers with statuses when robots.txt is found', async () => {
    const robotsTxt = `
User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Allow: /

User-agent: *
Allow: /
`;
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(robotsTxt),
    });

    const result = await auditAICrawlerAccess('https://example.com');
    expect(result.robots_txt_found).toBe(true);
    expect(result.crawlers).toHaveLength(10);

    const gptBot = result.crawlers.find((c) => c.name === 'GPTBot');
    expect(gptBot?.status).toBe('blocked');

    const perplexity = result.crawlers.find((c) => c.name === 'PerplexityBot');
    expect(perplexity?.status).toBe('allowed');
  });

  it('returns "unknown" health when robots.txt fetch fails', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await auditAICrawlerAccess('https://example.com');
    expect(result.robots_txt_found).toBe(false);
    expect(result.overall_health).toBe('unknown');
    expect(result.missing_count).toBe(10);
  });

  it('returns "unknown" health on network error (never throws)', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const result = await auditAICrawlerAccess('https://example.com');
    expect(result.robots_txt_found).toBe(false);
    expect(result.overall_health).toBe('unknown');
  });

  it('strips trailing slashes from website URL', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('User-agent: *\nAllow: /'),
    });

    const result = await auditAICrawlerAccess('https://example.com///');
    expect(result.robots_txt_url).toBe('https://example.com/robots.txt');
  });
});
