// ---------------------------------------------------------------------------
// lib/services/content-brief-generator.service.ts — AI Content Brief Generator
//
// Sprint 86: Uses generateObject with gpt-4o-mini to produce the creative
// content for an SOV gap content brief: answer capsule, outline sections,
// FAQ questions. Constrained by ContentBriefSchema.
// ---------------------------------------------------------------------------

import { generateObject } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { ContentBriefSchema, zodSchema } from '@/lib/ai/schemas';
import type { ContentBrief } from '@/lib/ai/schemas';

export interface ContentBriefGeneratorInput {
  queryText: string;
  queryCategory: string;
  businessName: string;
  city: string;
  state: string;
  /** Business context for grounding */
  businessContext: {
    cuisineType: string | null;
    amenities: string[];
    categories: string[];
    hoursDescription: string | null;
    phone: string | null;
    websiteUrl: string | null;
  };
  /** How many engines are missing this business */
  missingEngineCount: number;
  totalEngineCount: number;
  /** Competitor names that DO appear for this query */
  competitorsMentioned: string[];
}

/**
 * Generate the AI-powered creative content for a content brief.
 * Uses gpt-4o-mini via generateObject (§19.3).
 * Returns null if no API key available (fallback to structure-only brief).
 */
export async function generateBriefContent(
  input: ContentBriefGeneratorInput,
): Promise<ContentBrief | null> {
  if (!hasApiKey('openai')) return null;

  const competitorContext = input.competitorsMentioned.length > 0
    ? `Competitors currently mentioned: ${input.competitorsMentioned.join(', ')}. The content should position ${input.businessName} as a strong alternative.`
    : `No competitor dominates this query — this is a First Mover opportunity.`;

  const systemPrompt = `You are an AEO (Answer Engine Optimization) content strategist for local restaurants.
Your job is to create a content brief that will make a restaurant appear in AI engine responses for a specific query.

KEY AEO PRINCIPLES:
- Answer Capsule: The first 40-60 words MUST directly answer the query. AI engines extract this as a citation.
- Entity clarity: Use the business name, exact location, and category early and naturally.
- FAQ format: AI engines heavily weight FAQ content for citation.
- Ground truth only: Use ONLY the business facts provided. Never fabricate details, prices, menu items, or hours.

BUSINESS FACTS (use these, do not invent others):
- Name: ${input.businessName}
- Location: ${input.city}, ${input.state}
- Cuisine/Type: ${input.businessContext.cuisineType ?? 'not specified'}
- Categories: ${input.businessContext.categories.join(', ') || 'not specified'}
- Amenities: ${input.businessContext.amenities.join(', ') || 'not specified'}
- Hours: ${input.businessContext.hoursDescription ?? 'not specified'}
- Phone: ${input.businessContext.phone ?? 'not specified'}
- Website: ${input.businessContext.websiteUrl ?? 'not specified'}

COMPETITIVE CONTEXT:
${competitorContext}
${input.missingEngineCount} of ${input.totalEngineCount} AI engines do not mention this business for "${input.queryText}".`;

  const { object } = await generateObject({
    model: getModel('content-brief'),
    schema: zodSchema(ContentBriefSchema),
    system: systemPrompt,
    prompt: `Generate a content brief for the query: "${input.queryText}"

The brief should help ${input.businessName} appear in AI engine responses for this query.
Category: ${input.queryCategory}`,
  });

  return object;
}
