// ---------------------------------------------------------------------------
// lib/services/source-intelligence.service.ts — Citation Source Intelligence
//
// Sprint 82: Identifies which web pages and sources AI engines cite when
// describing the business. Two data paths:
//   1. Structured cited_sources JSONB (Google/Perplexity — Sprint 74)
//   2. AI-extracted source_mentions from raw_response (OpenAI/Copilot)
//
// Part A: extractSourceMentions() — AI extraction via gpt-4o-mini
// Part B: analyzeSourceIntelligence() — Pure analysis, categorization, alerts
//
// This module is a pure service — no Supabase client creation.
// ---------------------------------------------------------------------------

import { generateObject } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { SourceMentionExtractionSchema, zodSchema, type SourceMentionExtraction } from '@/lib/ai/schemas';

// ── Types ─────────────────────────────────────────────

export type SourceCategory = 'first_party' | 'review_site' | 'directory' | 'competitor' | 'news' | 'social' | 'blog' | 'other';

export interface NormalizedSource {
  /** Display name (e.g., "Yelp", "Google Business Profile", "charcoalnchill.com") */
  name: string;
  /** Actual URL if available, null otherwise */
  url: string | null;
  /** Categorized source type */
  category: SourceCategory;
  /** Which engines cited this source */
  engines: string[];
  /** Number of times cited across all evaluations */
  citationCount: number;
  /** Context snippets from extractions */
  contexts: string[];
  /** Is this competitor content appearing for the business's queries? */
  isCompetitorAlert: boolean;
}

export interface SourceAlert {
  type: 'competitor_content' | 'outdated_source' | 'negative_source' | 'missing_first_party';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  source: NormalizedSource | null;
  recommendation: string;
}

export interface SourceIntelligenceResult {
  /** All sources, deduplicated and ranked by citation frequency */
  sources: NormalizedSource[];
  /** Per-engine source breakdown */
  byEngine: Record<string, NormalizedSource[]>;
  /** Source category distribution */
  categoryBreakdown: Array<{ category: SourceCategory; count: number; percentage: number }>;
  /** First-party citation rate (what % of citations reference the business's own content) */
  firstPartyRate: number;
  /** Alerts requiring attention */
  alerts: SourceAlert[];
  /** Total evaluations analyzed */
  evaluationCount: number;
}

export interface SourceIntelligenceInput {
  businessName: string;
  websiteUrl: string | null;
  /** Evaluations with both structured and extracted sources */
  evaluations: Array<{
    engine: string;
    citedSources: Array<{ url: string; title: string }> | null;
    extractedMentions: SourceMentionExtraction | null;
    queryText: string;
  }>;
}

// ── Part A: Source Mention Extraction (AI-powered) ────────────────────────────

/**
 * Extract source mentions from an AI response that doesn't have structured citations.
 * Used for OpenAI and Copilot engines.
 * Returns null if extraction fails or isn't needed.
 */
export async function extractSourceMentions(
  rawResponse: string | null,
  businessName: string,
): Promise<SourceMentionExtraction | null> {
  if (!rawResponse || rawResponse.trim().length === 0) return null;
  if (!hasApiKey('openai')) return null;

  try {
    const { object } = await generateObject({
      model: getModel('source-extract'),
      schema: zodSchema(SourceMentionExtractionSchema),
      system: `You analyze AI-generated responses about local businesses to identify what information sources the AI appears to be drawing from. Look for:
- Explicit source references ("according to Yelp", "based on Google reviews")
- Implicit source signals (star ratings suggest review sites, specific details suggest directory listings)
- Competitor content being used as a source for queries about the target business
Be conservative — only extract sources you're confident are being referenced.`,
      prompt: `Identify the information sources referenced in this AI response about "${businessName}":\n\n${rawResponse}`,
    });
    return object;
  } catch (err) {
    console.error('[source-intelligence] Extraction failed:', err);
    return null;
  }
}

// ── Part B: Pure Analysis Functions ───────────────────────────────────────────

/**
 * Analyze source intelligence from all evaluation data.
 * Pure function — no I/O, no side effects.
 */
export function analyzeSourceIntelligence(input: SourceIntelligenceInput): SourceIntelligenceResult {
  const sourceMap = new Map<string, NormalizedSource>();

  // Process structured citations (Google, Perplexity)
  for (const evaluation of input.evaluations) {
    if (evaluation.citedSources) {
      for (const source of evaluation.citedSources) {
        const key = normalizeSourceKey(source.url);
        const existing = sourceMap.get(key);
        if (existing) {
          existing.citationCount++;
          if (!existing.engines.includes(evaluation.engine)) {
            existing.engines.push(evaluation.engine);
          }
        } else {
          sourceMap.set(key, {
            name: source.title || extractDomainName(source.url),
            url: source.url,
            category: categorizeUrl(source.url, input.businessName, input.websiteUrl),
            engines: [evaluation.engine],
            citationCount: 1,
            contexts: [],
            isCompetitorAlert: false,
          });
        }
      }
    }

    // Process extracted mentions (OpenAI, Copilot)
    if (evaluation.extractedMentions) {
      for (const mention of evaluation.extractedMentions.sources) {
        const key = mention.inferredUrl
          ? normalizeSourceKey(mention.inferredUrl)
          : `mention:${mention.name.toLowerCase()}`;
        const existing = sourceMap.get(key);
        if (existing) {
          existing.citationCount++;
          if (!existing.engines.includes(evaluation.engine)) {
            existing.engines.push(evaluation.engine);
          }
          if (mention.context && !existing.contexts.includes(mention.context)) {
            existing.contexts.push(mention.context);
          }
          if (mention.isCompetitorContent) existing.isCompetitorAlert = true;
        } else {
          sourceMap.set(key, {
            name: mention.name,
            url: mention.inferredUrl,
            category: mapMentionTypeToCategory(mention.type, mention.isCompetitorContent),
            engines: [evaluation.engine],
            citationCount: 1,
            contexts: mention.context ? [mention.context] : [],
            isCompetitorAlert: mention.isCompetitorContent,
          });
        }
      }
    }
  }

  // Sort by citation count descending
  const sources = [...sourceMap.values()].sort((a, b) => b.citationCount - a.citationCount);

  // Per-engine breakdown
  const byEngine: Record<string, NormalizedSource[]> = {};
  for (const source of sources) {
    for (const engine of source.engines) {
      (byEngine[engine] ??= []).push(source);
    }
  }

  // Category breakdown
  const categoryCounts = new Map<SourceCategory, number>();
  for (const source of sources) {
    categoryCounts.set(source.category, (categoryCounts.get(source.category) ?? 0) + source.citationCount);
  }
  const totalCitations = sources.reduce((sum, s) => sum + s.citationCount, 0);
  const categoryBreakdown = [...categoryCounts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalCitations > 0 ? Math.round((count / totalCitations) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // First-party rate
  const firstPartyCitations = sources
    .filter(s => s.category === 'first_party')
    .reduce((sum, s) => sum + s.citationCount, 0);
  const firstPartyRate = totalCitations > 0
    ? Math.round((firstPartyCitations / totalCitations) * 100)
    : 0;

  // Generate alerts
  const alerts = generateAlerts(sources, firstPartyRate, input);

  return {
    sources,
    byEngine,
    categoryBreakdown,
    firstPartyRate,
    alerts,
    evaluationCount: input.evaluations.length,
  };
}

// ── Helpers (exported for testing) ────────────────────────────────────────────

/** Normalize URL to a deduplication key */
export function normalizeSourceKey(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slashes, www prefix, query params for dedup
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Extract readable domain name from URL */
export function extractDomainName(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // Map common domains to friendly names
    const domainMap: Record<string, string> = {
      'yelp.com': 'Yelp',
      'tripadvisor.com': 'TripAdvisor',
      'google.com': 'Google',
      'maps.google.com': 'Google Maps',
      'facebook.com': 'Facebook',
      'instagram.com': 'Instagram',
      'twitter.com': 'Twitter/X',
      'x.com': 'Twitter/X',
      'bingplaces.com': 'Bing Places',
    };
    for (const [domain, name] of Object.entries(domainMap)) {
      if (hostname.includes(domain)) return name;
    }
    return hostname;
  } catch {
    return url;
  }
}

/** Categorize a URL into a source category */
export function categorizeUrl(
  url: string,
  businessName: string,
  websiteUrl: string | null,
): SourceCategory {
  const hostname = (() => {
    try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
    catch { return ''; }
  })();

  // First-party: business's own website
  if (websiteUrl) {
    try {
      const bizHost = new URL(websiteUrl).hostname.toLowerCase().replace(/^www\./, '');
      if (hostname === bizHost) return 'first_party';
    } catch { /* ignore */ }
  }

  // Review sites
  const reviewSites = ['yelp.com', 'tripadvisor.com', 'trustpilot.com', 'glassdoor.com'];
  if (reviewSites.some(s => hostname.includes(s))) return 'review_site';

  // Directories
  const directories = ['google.com/maps', 'maps.google.com', 'bingplaces.com', 'mapsconnect.apple.com', 'yellowpages.com', 'foursquare.com'];
  if (directories.some(s => url.toLowerCase().includes(s))) return 'directory';

  // Social
  const social = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com'];
  if (social.some(s => hostname.includes(s))) return 'social';

  // News/blogs (heuristic)
  const news = ['eater.com', 'timeout.com', 'thrillist.com', 'infatuation.com', 'patch.com'];
  if (news.some(s => hostname.includes(s))) return 'news';

  return 'other';
}

/** Map extracted mention type to source category */
export function mapMentionTypeToCategory(
  mentionType: string,
  isCompetitor: boolean,
): SourceCategory {
  if (isCompetitor) return 'competitor';
  switch (mentionType) {
    case 'review_site': return 'review_site';
    case 'directory': return 'directory';
    case 'news': return 'news';
    case 'blog': return 'blog';
    case 'social_media': return 'social';
    case 'official_website': return 'first_party';
    default: return 'other';
  }
}

/** Generate actionable alerts from source analysis */
export function generateAlerts(
  sources: NormalizedSource[],
  firstPartyRate: number,
  input: SourceIntelligenceInput,
): SourceAlert[] {
  const alerts: SourceAlert[] = [];

  // Alert: competitor content appearing as a source
  const competitorSources = sources.filter(s => s.isCompetitorAlert);
  for (const cs of competitorSources) {
    alerts.push({
      type: 'competitor_content',
      severity: 'high',
      title: 'Competitor content cited for your queries',
      description: `"${cs.name}" appears as a source when AI answers questions about ${input.businessName}. This means a competitor's content is influencing how AI describes you.`,
      source: cs,
      recommendation: 'Create authoritative first-party content to outrank this competitor source. Publish a blog post or FAQ page that directly addresses the queries where this source appears.',
    });
  }

  // Alert: low first-party citation rate
  if (firstPartyRate < 10 && sources.length > 0) {
    alerts.push({
      type: 'missing_first_party',
      severity: 'medium',
      title: 'AI rarely cites your own website',
      description: `Only ${firstPartyRate}% of AI citations reference your website. AI engines are forming opinions about ${input.businessName} from third-party sources you don't control.`,
      source: null,
      recommendation: 'Improve your website\'s AI readability: add structured FAQ content, update your llms.txt, and ensure your homepage clearly states your business name, address, hours, and specialties.',
    });
  }

  // Alert: heavy reliance on a single third-party source
  if (sources.length > 0) {
    const totalCitations = sources.reduce((sum, s) => sum + s.citationCount, 0);
    const topSource = sources[0];
    if (topSource && topSource.category !== 'first_party') {
      const topSourceShare = totalCitations > 0 ? topSource.citationCount / totalCitations : 0;
      if (topSourceShare > 0.5) {
        alerts.push({
          type: 'negative_source',
          severity: 'medium',
          title: `AI over-relies on ${topSource.name}`,
          description: `${Math.round(topSourceShare * 100)}% of AI citations come from ${topSource.name}. If that listing becomes outdated or inaccurate, it directly impacts how AI describes ${input.businessName}.`,
          source: topSource,
          recommendation: `Diversify your online presence. Ensure your information is accurate on ${topSource.name}, and build presence on other platforms so AI has multiple authoritative sources.`,
        });
      }
    }
  }

  // Sort by severity (high first)
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  return alerts;
}
