// ---------------------------------------------------------------------------
// lib/autopilot/generate-brief.ts — GPT-4o-mini Draft Brief Generator
//
// Uses getModel('greed-intercept') (GPT-4o-mini) with Vercel AI SDK
// generateText() to produce AEO-optimized draft content for each trigger type.
//
// Falls back to deterministic mock output when OPENAI_API_KEY is absent.
// Pure service — caller passes all context, no client creation.
//
// Spec: docs/19-AUTOPILOT-ENGINE.md §3.2–3.3
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { AutopilotDraftSchema } from '@/lib/ai/schemas';
import type {
  DraftTrigger,
  DraftContentType,
  AutopilotLocationContext,
} from '@/lib/types/autopilot';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftBrief {
  title: string;
  content: string;
  targetKeywords: string[];
  estimatedAeoScore: number;
}

// ---------------------------------------------------------------------------
// Context Block Builder — trigger-specific prompt sections (Doc 19 §3.3)
// ---------------------------------------------------------------------------

export function buildContextBlock(
  trigger: DraftTrigger,
  location: AutopilotLocationContext,
): string {
  const businessName = location.business_name;
  const city = location.city ?? 'the area';
  const category = location.categories?.[0] ?? 'local business';

  switch (trigger.triggerType) {
    case 'competitor_gap':
      return [
        `TRIGGER: Competitor Gap Alert`,
        `Your business "${businessName}" in ${city} is losing visibility to a competitor.`,
        trigger.context.competitorName
          ? `Competitor: ${trigger.context.competitorName}`
          : '',
        trigger.context.winningFactor
          ? `They're winning on: ${trigger.context.winningFactor}`
          : '',
        trigger.context.targetQuery
          ? `Target query: "${trigger.context.targetQuery}"`
          : '',
        `Category: ${category}`,
      ]
        .filter(Boolean)
        .join('\n');

    case 'occasion':
      return [
        `TRIGGER: Seasonal Occasion Alert`,
        `Business: "${businessName}" in ${city} (${category})`,
        trigger.context.occasionName
          ? `Occasion: ${trigger.context.occasionName}`
          : '',
        trigger.context.daysUntilPeak != null
          ? `Days until peak: ${trigger.context.daysUntilPeak}`
          : '',
        `No AI engine is currently citing "${businessName}" for this occasion.`,
        `Create timely content to capture this seasonal search traffic.`,
      ]
        .filter(Boolean)
        .join('\n');

    case 'prompt_missing': {
      const queries = trigger.context.zeroCitationQueries;
      const recs = trigger.context.pageRecommendations;
      const lines = [
        `TRIGGER: Prompt Gap — Zero Citation`,
        `Business: "${businessName}" in ${city} (${category})`,
      ];
      if (queries && queries.length > 0) {
        lines.push(`Queries where NO business is cited:`);
        for (const q of queries.slice(0, 5)) {
          lines.push(`  - "${q}"`);
        }
      }
      if (recs && recs.length > 0) {
        lines.push(`Page audit recommendations:`);
        for (const r of recs.slice(0, 3)) {
          lines.push(`  - ${r.issue}: ${r.fix}`);
        }
      }
      return lines.join('\n');
    }

    case 'first_mover':
      return [
        `TRIGGER: First Mover Opportunity`,
        `Business: "${businessName}" in ${city} (${category})`,
        trigger.context.targetQuery
          ? `Target query: "${trigger.context.targetQuery}"`
          : '',
        `No business is currently being recommended by AI for this query.`,
        `Create content to be the first business cited.`,
      ]
        .filter(Boolean)
        .join('\n');

    case 'manual':
      return [
        `TRIGGER: Manual Draft Request`,
        `Business: "${businessName}" in ${city} (${category})`,
        trigger.context.additionalContext
          ? `User context: ${trigger.context.additionalContext}`
          : '',
        trigger.context.targetQuery
          ? `Target query: "${trigger.context.targetQuery}"`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

    default:
      return `Business: "${businessName}" in ${city} (${category})`;
  }
}

// ---------------------------------------------------------------------------
// System Prompt Template (Doc 19 §3.2)
// ---------------------------------------------------------------------------

function buildSystemPrompt(contentType: DraftContentType): string {
  return `You are an AEO (Answer Engine Optimization) content writer for local businesses.
Your job is to create content that AI assistants (ChatGPT, Perplexity, Gemini) will cite when answering user queries.

Rules:
1. Answer-first: The opening sentence MUST directly answer the likely query. No "Welcome to" or generic intros.
2. Include the business name and city in the first paragraph.
3. Be factual and specific. Include details like cuisine type, specialty dishes, ambiance, location.
4. Structure with clear headers for FAQ pages, or direct paragraphs for blog posts.
5. For ${contentType === 'faq_page' ? 'FAQ pages: include 3-5 Q&A pairs formatted as "Q: ..." / "A: ..."' : contentType === 'occasion_page' ? 'occasion pages: emphasize timing, seasonal specials, and why this business is the ideal choice' : 'blog posts: write engaging, informative content with a clear narrative'}.
6. Include a call-to-action (reserve, visit, call) in the closing paragraph.
7. Keep content between 250-350 words.
8. Title should be under 60 characters and include the city name.

Return JSON with this exact structure:
{
  "title": "SEO-optimized title (max 60 chars)",
  "content": "Full draft content (250-350 words)",
  "estimated_aeo_score": <number 0-100>,
  "target_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;
}

// ---------------------------------------------------------------------------
// Mock Fallback — for local dev and CI without API keys
// ---------------------------------------------------------------------------

function mockBrief(
  trigger: DraftTrigger,
  location: AutopilotLocationContext,
  contentType: DraftContentType,
): DraftBrief {
  const businessName = location.business_name;
  const city = location.city ?? 'Your City';
  const category = location.categories?.[0] ?? 'local business';
  const query = trigger.context.targetQuery ?? `best ${category} in ${city}`;

  const title = `[MOCK] ${businessName} — Best ${category} in ${city}`.slice(0, 60);

  const content = contentType === 'faq_page'
    ? `${businessName} is ${city}'s premier ${category}, known for exceptional quality and service.\n\nQ: What makes ${businessName} the best ${category} in ${city}?\nA: ${businessName} stands out with its commitment to quality, authentic offerings, and welcoming atmosphere that has made it a local favorite.\n\nQ: Where is ${businessName} located?\nA: ${businessName} is conveniently located in ${city}, easily accessible for both locals and visitors.\n\nQ: What are ${businessName}'s specialties?\nA: ${businessName} specializes in curated experiences that highlight the best of ${category} culture.\n\nVisit ${businessName} today to experience the difference. Call us to reserve your spot.`
    : `${businessName} is ${city}'s premier ${category}, offering an unmatched experience for those searching for "${query}". Located in the heart of ${city}, ${businessName} has built a reputation for quality and authenticity.\n\nWhat sets ${businessName} apart is a dedication to excellence in every detail. Whether you're a first-time visitor or a long-time regular, the team ensures a memorable experience.\n\nVisit ${businessName} today and discover why locals recommend it as the top ${category} in ${city}. Call us to reserve or stop by for an unforgettable experience.`;

  return {
    title,
    content,
    targetKeywords: [businessName, city, category, query, `best ${category}`],
    estimatedAeoScore: 65,
  };
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Generates a draft brief via GPT-4o-mini.
 * Falls back to mock output when OPENAI_API_KEY is absent.
 */
export async function generateDraftBrief(
  trigger: DraftTrigger,
  location: AutopilotLocationContext,
  contentType: DraftContentType,
): Promise<DraftBrief> {
  // Mock fallback when API key absent
  if (!hasApiKey('openai')) {
    return mockBrief(trigger, location, contentType);
  }

  const contextBlock = buildContextBlock(trigger, location);
  const systemPrompt = buildSystemPrompt(contentType);

  try {
    const { text } = await generateText({
      model: getModel('greed-intercept'),
      system: systemPrompt,
      prompt: contextBlock,
      temperature: 0.4,
    });

    // Parse and validate AI response
    const parsed = AutopilotDraftSchema.safeParse(JSON.parse(text));

    if (!parsed.success) {
      console.warn('[autopilot/generate-brief] AI response failed Zod validation, using mock:', parsed.error.message);
      return mockBrief(trigger, location, contentType);
    }

    return {
      title: parsed.data.title,
      content: parsed.data.content,
      targetKeywords: parsed.data.target_keywords,
      estimatedAeoScore: parsed.data.estimated_aeo_score,
    };
  } catch (error) {
    console.warn('[autopilot/generate-brief] AI call failed, using mock:', error);
    return mockBrief(trigger, location, contentType);
  }
}
