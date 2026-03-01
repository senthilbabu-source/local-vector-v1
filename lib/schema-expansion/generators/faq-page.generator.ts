// ---------------------------------------------------------------------------
// lib/schema-expansion/generators/faq-page.generator.ts
//
// Sprint 106: Generates FAQPage schema from extracted FAQ pairs.
// Falls back to LLM-generated FAQs when extraction yields none.
//
// Reuses: buildFaqSchema() pattern from lib/page-audit/faq-generator.ts
// ---------------------------------------------------------------------------

import { SchemaGenerator } from './types';
import type { SchemaGeneratorInput, GeneratedSchema, PageType } from './types';
import type { FAQ } from '../types';
import * as Sentry from '@sentry/nextjs';

export class FAQPageGenerator extends SchemaGenerator {
  readonly supportsPageType: PageType[] = ['faq'];

  async generate(input: SchemaGeneratorInput): Promise<GeneratedSchema> {
    const { groundTruth, page } = input;
    const missingFields: string[] = [];
    let faqs: FAQ[];
    let isAIGenerated = false;

    if (page.detected_faqs.length > 0) {
      // Use extracted FAQs directly — human-authored content is best
      faqs = page.detected_faqs;
    } else {
      // Generate FAQs via LLM
      faqs = await generateFAQsWithLLM(
        groundTruth.name,
        groundTruth.city,
        page.body_excerpt,
      );
      isAIGenerated = true;
      missingFields.push('faqs_auto_generated');
    }

    const faqSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    const websiteUrl = groundTruth.website ?? page.url;
    const breadcrumb = this.buildBreadcrumb(
      this.getOrigin(websiteUrl),
      this.getPathname(page.url),
      page.title ?? 'FAQ',
    );

    return {
      page_type: 'faq',
      schema_types: ['FAQPage', 'BreadcrumbList'],
      json_ld: [faqSchema, breadcrumb],
      confidence: isAIGenerated ? 0.7 : 0.9,
      missing_fields: missingFields,
      generated_at: new Date().toISOString(),
    };
  }
}

/**
 * Generate 5 FAQs via GPT-4o-mini when page extraction yields none.
 * Falls back to static FAQ pairs if no API key or LLM call fails.
 */
async function generateFAQsWithLLM(
  businessName: string,
  city: string,
  bodyExcerpt: string,
): Promise<FAQ[]> {
  try {
    const { hasApiKey, getModel } = await import('@/lib/ai/providers');
    if (!hasApiKey('openai')) {
      return staticFallbackFAQs(businessName, city);
    }

    const { generateText } = await import('ai');

    const result = await generateText({
      model: getModel('greed-intercept'),
      prompt: `Generate exactly 5 FAQ pairs for ${businessName}, a local business in ${city}.
Focus on questions customers ask AI assistants about local businesses.

Context from website: ${bodyExcerpt.slice(0, 500)}

Respond in this exact JSON format (no markdown, no code blocks):
[{"question":"...","answer":"..."},{"question":"...","answer":"..."}]`,
      maxTokens: 800,
    });

    const parsed = JSON.parse(result.text.trim());
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 5).map((p: { question: string; answer: string }) => ({
        question: p.question,
        answer: p.answer,
      }));
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'faq-generator', sprint: '106' } });
  }

  return staticFallbackFAQs(businessName, city);
}

function staticFallbackFAQs(businessName: string, city: string): FAQ[] {
  return [
    { question: `What is ${businessName}?`, answer: `${businessName} is a local business in ${city}. Visit us to experience our full offerings.` },
    { question: `Where is ${businessName} located?`, answer: `${businessName} is located in ${city}. Check our website for full address details.` },
    { question: `What are the hours for ${businessName}?`, answer: `Please visit our website or call us for current hours.` },
    { question: `Does ${businessName} take reservations?`, answer: `Contact ${businessName} directly for reservation availability.` },
    { question: `What makes ${businessName} unique?`, answer: `${businessName} offers a distinctive experience for our guests in ${city}.` },
  ];
}
