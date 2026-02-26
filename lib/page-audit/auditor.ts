// ---------------------------------------------------------------------------
// lib/page-audit/auditor.ts — Page AEO Auditor
//
// Surgery 3: Scores a page across 5 dimensions defined in Doc 17 §2.
//
// Dimensions and weights:
//   Answer-First Structure   35%  — Does the opening text answer the intent?
//   Schema Completeness      25%  — Are required JSON-LD types present?
//   FAQ Schema Presence      20%  — FAQPage schema with Q&A pairs?
//   Keyword Density          10%  — Business name, city, category present?
//   Entity Clarity           10%  — NAP+H extractable from page text?
//
// One GPT-4o-mini call per audit (Answer-First scoring).
// All other dimensions are computed locally via HTML analysis.
//
// Spec: docs/17-CONTENT-GRADER.md §2–3
// ---------------------------------------------------------------------------

import { generateText, Output } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { parsePage, type ParsedPage } from './html-parser';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageType = 'homepage' | 'menu' | 'about' | 'faq' | 'events' | 'occasion' | 'other';

export interface LocationContext {
  business_name: string;
  city: string | null;
  state: string | null;
  categories: string[] | null;
  amenities: Record<string, boolean | undefined> | null;
}

export type DimensionKey = 'answerFirst' | 'schemaCompleteness' | 'faqSchema' | 'keywordDensity' | 'entityClarity';
export type SchemaFixType = 'FAQPage' | 'OpeningHoursSpecification' | 'LocalBusiness';

export interface PageAuditRecommendation {
  issue: string;
  fix: string;
  impactPoints: number;
  dimensionKey?: DimensionKey;
  schemaType?: SchemaFixType;
}

export interface PageAuditResult {
  overallScore: number;
  answerFirstScore: number;
  schemaCompletenessScore: number;
  faqSchemaPresent: boolean;
  faqSchemaScore: number;
  keywordDensityScore: number;
  entityClarityScore: number;
  recommendations: PageAuditRecommendation[];
}

// ---------------------------------------------------------------------------
// Schema for AI scoring response
// ---------------------------------------------------------------------------

const AnswerFirstScoreSchema = z.object({
  score: z.number().min(0).max(100),
});

// ---------------------------------------------------------------------------
// Dimension 1: Answer-First Structure (35%) — Doc 17 §2.2
// ---------------------------------------------------------------------------

async function scoreAnswerFirst(
  openingText: string,
  location: LocationContext,
): Promise<number> {
  if (!openingText || openingText.length < 20) return 0;

  // If no API key, use heuristic scoring
  if (!hasApiKey('openai')) {
    return heuristicAnswerFirst(openingText, location);
  }

  const category = location.categories?.[0] ?? 'restaurant';
  const city = location.city ?? 'the area';
  const state = location.state ?? '';
  const targetQuery = `best ${category} in ${city} ${state}`.trim();

  try {
    const { text } = await generateText({
      model: getModel('greed-intercept'),
      prompt: `On a scale of 0–100, how directly does this opening text answer the query "${targetQuery}"?\n\nOpening text: "${openingText.slice(0, 500)}"\n\nReturn JSON: { "score": <number> }`,
      temperature: 0,
    });

    const parsed = JSON.parse(text);
    return typeof parsed.score === 'number' ? parsed.score : heuristicAnswerFirst(openingText, location);
  } catch {
    return heuristicAnswerFirst(openingText, location);
  }
}

function heuristicAnswerFirst(text: string, location: LocationContext): number {
  const lower = text.toLowerCase();
  let score = 20; // Base score for having text

  const name = location.business_name?.toLowerCase() ?? '';
  const city = location.city?.toLowerCase() ?? '';
  const category = (location.categories?.[0] ?? '').toLowerCase();

  if (name && lower.includes(name)) score += 25;
  if (city && lower.includes(city)) score += 15;
  if (category && lower.includes(category)) score += 15;

  // Check if the first sentence is substantive (not just "Welcome to...")
  const firstSentence = text.split(/[.!?]/)[0] ?? '';
  if (firstSentence.length > 50) score += 10;
  if (/welcome to|home page|navigation/i.test(firstSentence)) score -= 15;

  return Math.min(100, Math.max(0, score));
}

// ---------------------------------------------------------------------------
// Dimension 2: Schema Completeness (25%) — Doc 17 §2.3
// ---------------------------------------------------------------------------

const REQUIRED_SCHEMAS: Record<PageType, { types: string[]; properties: string[] }> = {
  homepage: {
    types: ['LocalBusiness', 'Restaurant', 'FoodEstablishment'],
    properties: ['name', 'address', 'telephone', 'openingHours'],
  },
  menu: {
    types: ['MenuPage', 'Restaurant'],
    properties: ['hasMenu', 'servesCuisine', 'name'],
  },
  about: {
    types: ['LocalBusiness', 'Restaurant', 'Organization'],
    properties: ['name', 'description'],
  },
  faq: {
    types: ['FAQPage'],
    properties: ['mainEntity'],
  },
  events: {
    types: ['Event'],
    properties: ['name', 'startDate', 'location'],
  },
  occasion: {
    types: ['LocalBusiness', 'FAQPage'],
    properties: ['name', 'mainEntity'],
  },
  other: {
    types: ['LocalBusiness'],
    properties: ['name'],
  },
};

function scoreSchemaCompleteness(
  jsonLdBlocks: Record<string, unknown>[],
  pageType: PageType,
): number {
  if (jsonLdBlocks.length === 0) return 0;

  const req = REQUIRED_SCHEMAS[pageType] ?? REQUIRED_SCHEMAS.other;

  // Check if any required @type is present
  const allTypes = jsonLdBlocks.flatMap((block) => {
    const t = block['@type'];
    return Array.isArray(t) ? t : [t];
  }).filter(Boolean) as string[];

  const hasRequiredType = req.types.some((t) =>
    allTypes.some((at) => String(at).includes(t)),
  );

  if (!hasRequiredType) return 10; // 10 points just for having any JSON-LD

  // Check required properties across all blocks
  const allKeys = new Set(jsonLdBlocks.flatMap((b) => Object.keys(b)));
  const presentProps = req.properties.filter((p) => allKeys.has(p));
  const propScore = req.properties.length > 0
    ? (presentProps.length / req.properties.length) * 100
    : 100;

  return Math.round(propScore);
}

// ---------------------------------------------------------------------------
// Dimension 3: FAQ Schema Presence (20%) — Doc 17 §2.4
// ---------------------------------------------------------------------------

function scoreFaqSchema(jsonLdBlocks: Record<string, unknown>[]): { score: number; present: boolean } {
  const faqBlock = jsonLdBlocks.find((b) => {
    const t = b['@type'];
    return t === 'FAQPage' || (Array.isArray(t) && t.includes('FAQPage'));
  });

  if (!faqBlock) return { score: 0, present: false };

  const mainEntity = faqBlock.mainEntity;
  const qaCount = Array.isArray(mainEntity) ? mainEntity.length : 0;

  if (qaCount >= 5) return { score: 100, present: true };
  if (qaCount >= 3) return { score: 75, present: true };
  if (qaCount >= 1) return { score: 40, present: true };

  return { score: 10, present: true }; // FAQPage exists but empty mainEntity
}

// ---------------------------------------------------------------------------
// Dimension 4: Keyword Density (10%) — Doc 17 §2.5
// ---------------------------------------------------------------------------

function scoreKeywordDensity(
  visibleText: string,
  location: LocationContext,
): number {
  if (!visibleText) return 0;

  const lower = visibleText.toLowerCase();
  const required: string[] = [];

  if (location.business_name) required.push(location.business_name.toLowerCase());
  if (location.city) required.push(location.city.toLowerCase());
  if (location.state) required.push(location.state.toLowerCase());
  if (location.categories?.[0]) required.push(location.categories[0].toLowerCase());

  // Add 2 amenity descriptors (Doc 17 §2.5)
  if (location.amenities) {
    const amenityLabels = Object.entries(location.amenities)
      .filter(([, v]) => v === true)
      .map(([k]) => k.replace(/^has_|^is_|^serves_/, '').replace(/_/g, ' '))
      .slice(0, 2);
    required.push(...amenityLabels);
  }

  if (required.length === 0) return 50; // No data to check against

  const present = required.filter((term) => lower.includes(term));
  return Math.round((present.length / required.length) * 100);
}

// ---------------------------------------------------------------------------
// Dimension 5: Entity Clarity (10%) — Doc 17 §2.6
// ---------------------------------------------------------------------------

function scoreEntityClarity(
  visibleText: string,
  parsed: ParsedPage,
  location: LocationContext,
): number {
  if (!visibleText) return 0;

  const lower = visibleText.toLowerCase();
  let signals = 0;
  const total = 4;

  // 1. Business name in H1 or prominent text
  const name = location.business_name?.toLowerCase() ?? '';
  if (name && (parsed.h1.toLowerCase().includes(name) || parsed.title.toLowerCase().includes(name))) {
    signals++;
  }

  // 2. Address (at minimum city + state)
  const city = location.city?.toLowerCase() ?? '';
  const state = location.state?.toLowerCase() ?? '';
  if (city && state && lower.includes(city) && lower.includes(state)) {
    signals++;
  }

  // 3. Phone number (any phone-like pattern)
  if (/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(visibleText)) {
    signals++;
  }

  // 4. Hours (day + time pattern)
  if (/(?:mon|tue|wed|thu|fri|sat|sun)/i.test(visibleText) &&
      /\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?/.test(visibleText)) {
    signals++;
  }

  return Math.round((signals / total) * 100);
}

// ---------------------------------------------------------------------------
// Recommendation builder — Doc 17 §2.2 fix templates
// ---------------------------------------------------------------------------

function buildRecommendations(
  scores: {
    answerFirst: number;
    schemaCompleteness: number;
    faqScore: number;
    faqPresent: boolean;
    keywordDensity: number;
    entityClarity: number;
  },
  pageType: PageType,
  location: LocationContext,
): PageAuditRecommendation[] {
  const recs: PageAuditRecommendation[] = [];
  const name = location.business_name ?? 'Your Business';
  const city = location.city ?? 'your area';

  // Answer-First recommendations (Doc 17 §2.2)
  if (scores.answerFirst <= 30) {
    recs.push({
      issue: 'Opening text is navigation/hero copy with no substance',
      fix: `Replace your opening section with: "${name} is ${city}'s premier [value prop]. [Top differentiator]. [CTA]." Start with the answer.`,
      impactPoints: 35,
      dimensionKey: 'answerFirst',
    });
  } else if (scores.answerFirst <= 60) {
    recs.push({
      issue: 'Content exists but doesn\'t lead with the key claim',
      fix: 'Move your strongest claim to the first sentence. AI reads top-down and stops early.',
      impactPoints: 20,
      dimensionKey: 'answerFirst',
    });
  } else if (scores.answerFirst <= 80) {
    recs.push({
      issue: 'Good but not optimized for the most common query',
      fix: `Add: "Serving ${city} since [year], ${name} is known for [top 2 attributes]." to your opening paragraph.`,
      impactPoints: 10,
      dimensionKey: 'answerFirst',
    });
  }

  // Schema recommendations
  if (scores.schemaCompleteness < 50) {
    recs.push({
      issue: `Missing required JSON-LD schema for ${pageType} page`,
      fix: `Add a <script type="application/ld+json"> block with the correct @type for your ${pageType} page. This is the single highest-impact technical fix for AI visibility.`,
      impactPoints: 25,
      dimensionKey: 'schemaCompleteness',
      schemaType: 'LocalBusiness',
    });
  }

  // FAQ recommendations
  if (!scores.faqPresent) {
    recs.push({
      issue: 'No FAQPage schema found — this is the #1 driver of AI citations',
      fix: `Add FAQPage schema with at least 5 Q&A pairs about ${name}. AI models directly extract and quote FAQ content.`,
      impactPoints: 20,
      dimensionKey: 'faqSchema',
      schemaType: 'FAQPage',
    });
  } else if (scores.faqScore < 75) {
    recs.push({
      issue: 'FAQPage schema exists but has fewer than 5 Q&A pairs',
      fix: 'Expand to 5+ Q&A pairs. Include mix of operational (hours, parking) and experiential ("What is the vibe at...") questions.',
      impactPoints: 10,
      dimensionKey: 'faqSchema',
      schemaType: 'FAQPage',
    });
  }

  // Keyword recommendations
  if (scores.keywordDensity < 50) {
    recs.push({
      issue: 'Missing key business terms in page text',
      fix: `Ensure "${name}", "${city}", and your primary category appear naturally in your page copy. AI needs these signals to associate the page with search queries.`,
      impactPoints: 10,
      dimensionKey: 'keywordDensity',
    });
  }

  // Entity clarity
  if (scores.entityClarity < 50) {
    recs.push({
      issue: 'Business entity not fully extractable from page text',
      fix: `Add your complete NAP+H (Name, Address, Phone, Hours) in visible text — not just in schema or footer. AI models need this in the main content area.`,
      impactPoints: 10,
      dimensionKey: 'entityClarity',
    });
  }

  return recs.sort((a, b) => b.impactPoints - a.impactPoints);
}

// ---------------------------------------------------------------------------
// auditPage — Main export (Doc 17 §3.1)
// ---------------------------------------------------------------------------

/**
 * Audit a page URL against 5 AEO dimensions.
 *
 * Fetches the page, parses HTML, scores all dimensions, and generates
 * a prioritized recommendation list.
 *
 * Cost: 1 HTTP fetch + 1 GPT-4o-mini call (Answer-First scoring).
 * Total: ~$0.002 per audit.
 *
 * Throws on fetch errors — caller must handle.
 */
export async function auditPage(
  pageUrl: string,
  pageType: PageType,
  location: LocationContext,
): Promise<PageAuditResult> {
  // 1. Fetch page HTML
  const response = await fetch(pageUrl, {
    headers: { 'User-Agent': 'LocalVector-AuditBot/1.0 (+https://localvector.ai/bot)' },
    signal: AbortSignal.timeout(10_000), // 10s timeout
  });

  if (!response.ok) {
    throw new Error(`Page fetch failed: ${response.status} ${response.statusText} for ${pageUrl}`);
  }

  const html = await response.text();
  const parsed = parsePage(html);

  // 2. Score all dimensions
  const answerFirstScore = await scoreAnswerFirst(parsed.openingText, location);
  const schemaCompletenessScore = scoreSchemaCompleteness(parsed.jsonLdBlocks, pageType);
  const { score: faqSchemaScore, present: faqSchemaPresent } = scoreFaqSchema(parsed.jsonLdBlocks);
  const keywordDensityScore = scoreKeywordDensity(parsed.visibleText, location);
  const entityClarityScore = scoreEntityClarity(parsed.visibleText, parsed, location);

  // 3. Composite score (Doc 17 §2.1)
  const overallScore = Math.round(
    (answerFirstScore * 0.35) +
    (schemaCompletenessScore * 0.25) +
    (faqSchemaScore * 0.20) +
    (keywordDensityScore * 0.10) +
    (entityClarityScore * 0.10),
  );

  // 4. Recommendations
  const recommendations = buildRecommendations(
    {
      answerFirst: answerFirstScore,
      schemaCompleteness: schemaCompletenessScore,
      faqScore: faqSchemaScore,
      faqPresent: faqSchemaPresent,
      keywordDensity: keywordDensityScore,
      entityClarity: entityClarityScore,
    },
    pageType,
    location,
  );

  return {
    overallScore,
    answerFirstScore,
    schemaCompletenessScore,
    faqSchemaPresent,
    faqSchemaScore,
    keywordDensityScore,
    entityClarityScore,
    recommendations,
  };
}
