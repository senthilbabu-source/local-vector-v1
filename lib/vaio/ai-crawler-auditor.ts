// ---------------------------------------------------------------------------
// lib/vaio/ai-crawler-auditor.ts — AI crawler access auditor
//
// Checks a business website's robots.txt for AI crawler access policies.
// One external HTTP call per audit. Never throws.
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import type { AICrawlerAuditResult, AICrawlerStatus } from './types';

export const KNOWN_AI_CRAWLERS: Array<{
  name: string;
  user_agent: string;
  used_by: string;
  impact: 'high' | 'medium' | 'low';
}> = [
  { name: 'GPTBot',            user_agent: 'GPTBot',            used_by: 'ChatGPT / OpenAI',          impact: 'high' },
  { name: 'PerplexityBot',     user_agent: 'PerplexityBot',     used_by: 'Perplexity AI',              impact: 'high' },
  { name: 'Google-Extended',   user_agent: 'Google-Extended',   used_by: 'Google Bard / Gemini',       impact: 'high' },
  { name: 'ClaudeBot',         user_agent: 'ClaudeBot',         used_by: 'Claude / Anthropic',         impact: 'medium' },
  { name: 'anthropic-ai',      user_agent: 'anthropic-ai',      used_by: 'Claude / Anthropic (alt)',   impact: 'medium' },
  { name: 'ChatGPT-User',      user_agent: 'ChatGPT-User',      used_by: 'ChatGPT browsing',           impact: 'medium' },
  { name: 'OAI-SearchBot',     user_agent: 'OAI-SearchBot',     used_by: 'OpenAI SearchBot',           impact: 'medium' },
  { name: 'Applebot-Extended', user_agent: 'Applebot-Extended', used_by: 'Apple Intelligence / Siri', impact: 'medium' },
  { name: 'Amazonbot',         user_agent: 'Amazonbot',         used_by: 'Alexa / Amazon AI',          impact: 'low' },
  { name: 'Bytespider',        user_agent: 'Bytespider',        used_by: 'TikTok / ByteDance AI',      impact: 'low' },
];

// ---------------------------------------------------------------------------
// Main auditor
// ---------------------------------------------------------------------------

export async function auditAICrawlerAccess(websiteUrl: string): Promise<AICrawlerAuditResult> {
  const baseUrl = websiteUrl.replace(/\/+$/, '');
  const robotsUrl = `${baseUrl}/robots.txt`;
  const now = new Date().toISOString();

  try {
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'LocalVectorBot/1.0' },
    });

    if (!response.ok) {
      return buildResult(websiteUrl, robotsUrl, false, now);
    }

    const robotsTxt = await response.text();
    const crawlers = KNOWN_AI_CRAWLERS.map((crawler) => {
      const status = parseRobotsTxtForAgent(robotsTxt, crawler.user_agent);
      return { ...crawler, status } as AICrawlerStatus;
    });

    const blocked = crawlers.filter((c) => c.status === 'blocked');
    const allowed = crawlers.filter((c) => c.status === 'allowed');
    const missing = crawlers.filter((c) => c.status === 'not_specified');

    const highImpactBlocked = blocked.filter((c) => c.impact === 'high').length;
    const highImpactTotal = crawlers.filter((c) => c.impact === 'high').length;

    let overall_health: AICrawlerAuditResult['overall_health'] = 'healthy';
    if (highImpactBlocked >= highImpactTotal) {
      overall_health = 'blocked';
    } else if (highImpactBlocked > 0) {
      overall_health = 'partial';
    }

    return {
      website_url: websiteUrl,
      robots_txt_found: true,
      robots_txt_url: robotsUrl,
      crawlers,
      overall_health,
      blocked_count: blocked.length,
      allowed_count: allowed.length,
      missing_count: missing.length,
      last_checked_at: now,
    };
  } catch (err) {
    console.error('[vaio/ai-crawler-auditor] fetch failed:', err);
    return buildResult(websiteUrl, robotsUrl, false, now);
  }
}

// ---------------------------------------------------------------------------
// robots.txt parser (pure function)
// ---------------------------------------------------------------------------

export function parseRobotsTxtForAgent(
  robotsTxt: string,
  userAgent: string,
): 'allowed' | 'blocked' | 'not_specified' {
  const lines = robotsTxt.split('\n').map((l) => l.trim());
  const lowerAgent = userAgent.toLowerCase();

  // Find the section for this user-agent
  let inSection = false;
  let foundSection = false;
  let hasDisallow = false;
  let hasAllow = false;

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || line.length === 0) continue;

    const lower = line.toLowerCase();
    if (lower.startsWith('user-agent:')) {
      const agent = lower.replace('user-agent:', '').trim();
      if (inSection && foundSection) {
        // We've moved past our section
        break;
      }
      inSection = agent === lowerAgent;
      if (inSection) foundSection = true;
      continue;
    }

    if (!inSection) continue;

    if (lower.startsWith('disallow:')) {
      const path = lower.replace('disallow:', '').trim();
      if (path === '/' || path === '') {
        // Empty disallow means allow, "/" means block root
        if (path === '/') hasDisallow = true;
      }
    } else if (lower.startsWith('allow:')) {
      const path = lower.replace('allow:', '').trim();
      if (path === '/' || path === '') {
        hasAllow = true;
      }
    }
  }

  if (!foundSection) {
    // Check wildcard section
    return parseWildcardSection(lines);
  }

  // Allow takes precedence over Disallow when both are present
  if (hasAllow) return 'allowed';
  if (hasDisallow) return 'blocked';
  return 'allowed'; // Section found but no directives means allowed
}

function parseWildcardSection(lines: string[]): 'allowed' | 'blocked' | 'not_specified' {
  let inWildcard = false;
  let hasDisallow = false;
  let hasAllow = false;

  for (const line of lines) {
    if (line.startsWith('#') || line.length === 0) continue;
    const lower = line.toLowerCase();

    if (lower.startsWith('user-agent:')) {
      const agent = lower.replace('user-agent:', '').trim();
      if (inWildcard && agent !== '*') break;
      inWildcard = agent === '*';
      continue;
    }

    if (!inWildcard) continue;

    if (lower.startsWith('disallow:')) {
      const path = lower.replace('disallow:', '').trim();
      if (path === '/') hasDisallow = true;
    } else if (lower.startsWith('allow:')) {
      const path = lower.replace('allow:', '').trim();
      if (path === '/' || path === '') hasAllow = true;
    }
  }

  if (!inWildcard) return 'not_specified';
  if (hasAllow) return 'allowed';
  if (hasDisallow) return 'blocked';
  return 'not_specified';
}

// ---------------------------------------------------------------------------
// Fix generator
// ---------------------------------------------------------------------------

export function generateRobotsTxtFix(blockedOrMissing: AICrawlerStatus[]): string {
  if (blockedOrMissing.length === 0) return '';

  const lines: string[] = [
    '# AI Crawler Access — recommended additions',
    '# These allow AI search engines to index your content for AI-powered answers.',
    '',
  ];

  for (const crawler of blockedOrMissing) {
    lines.push(`User-agent: ${crawler.user_agent}`);
    lines.push('Allow: /');
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildResult(
  websiteUrl: string,
  robotsUrl: string,
  found: boolean,
  now: string,
): AICrawlerAuditResult {
  return {
    website_url: websiteUrl,
    robots_txt_found: found,
    robots_txt_url: robotsUrl,
    crawlers: KNOWN_AI_CRAWLERS.map((c) => ({
      ...c,
      status: 'not_specified' as const,
    })),
    overall_health: 'unknown',
    blocked_count: 0,
    allowed_count: 0,
    missing_count: KNOWN_AI_CRAWLERS.length,
    last_checked_at: now,
  };
}
