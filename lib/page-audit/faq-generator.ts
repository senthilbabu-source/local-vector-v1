// ---------------------------------------------------------------------------
// lib/page-audit/faq-generator.ts — AI FAQ Auto-Generator (Sprint 104)
//
// Generates 5 realistic customer Q&A pairs for a business using GPT-4o-mini.
// Produces ready-to-paste FAQPage JSON-LD schema.
//
// Called when: page audit finds faqSchemaPresent === false AND user clicks
// "Generate Schema Fix" (AI_RULES §5 — never on page load).
//
// Returns GeneratedSchema (same type as static generators) so it renders
// identically in SchemaFixPanel without UI changes.
//
// Spec: docs/17-CONTENT-GRADER.md §4
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import * as Sentry from '@sentry/nextjs';
import type { LocationContext } from './auditor';
import type { GeneratedSchema } from '@/lib/schema-generator/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FaqGenerationInput {
  location: LocationContext;
  pageType: string;
}

// ---------------------------------------------------------------------------
// Static fallback — used when no API key or AI call fails
// ---------------------------------------------------------------------------

function staticFaqFallback(
  location: LocationContext,
  pageType: string,
): Array<{ question: string; answer: string }> {
  const name = location.business_name;
  const city = location.city ?? 'our area';
  const category = location.categories?.[0] ?? 'business';

  return [
    {
      question: `What is ${name}?`,
      answer: `${name} is a ${category} located in ${city}. Visit us to experience our full menu and atmosphere.`,
    },
    {
      question: `Where is ${name} located?`,
      answer: `${name} is located in ${city}${location.state ? `, ${location.state}` : ''}.`,
    },
    {
      question: `What are the hours for ${name}?`,
      answer: `Please visit our website or call us for current hours. We update our schedule regularly.`,
    },
    {
      question: `Does ${name} take reservations?`,
      answer: `Contact ${name} directly for reservation availability and booking information.`,
    },
    {
      question: `What makes ${name} unique in ${city}?`,
      answer: `${name} stands out as a premier ${category} in ${city}, offering a distinctive experience for our guests.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// buildFaqSchema — JSON-LD builder (Doc 17 §4.2)
// ---------------------------------------------------------------------------

export function buildFaqSchema(
  faqs: Array<{ question: string; answer: string }>,
): string {
  const schema = {
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
  return JSON.stringify(schema, null, 2);
}

// ---------------------------------------------------------------------------
// generateAiFaqSet — Main export (Doc 17 §4)
// ---------------------------------------------------------------------------

export async function generateAiFaqSet(
  input: FaqGenerationInput,
): Promise<GeneratedSchema> {
  const { location, pageType } = input;
  let faqs: Array<{ question: string; answer: string }>;

  if (!hasApiKey('openai')) {
    faqs = staticFaqFallback(location, pageType);
  } else {
    try {
      const businessName = location.business_name;
      const city = location.city ?? 'the area';
      const state = location.state ?? '';
      const primaryCategory = location.categories?.[0] ?? 'restaurant';

      const prompt = `Generate 5 FAQ questions and answers for a ${pageType} page for this business:

Business: ${businessName}
Category: ${primaryCategory}
City: ${city}, ${state}
Page purpose: ${pageType}

Requirements:
- Questions must be realistic queries a customer would type into ChatGPT or Perplexity
- Answers must be direct (Answer-First), factual, and ≤ 50 words
- Include the business name and city naturally in at least 2 answers
- Mix of operational questions (hours, parking, reservations) and experiential ("What is the vibe at...")

Return JSON only, no markdown:
{
  "faqs": [
    { "question": "...", "answer": "..." }
  ]
}`;

      const { text } = await generateText({
        model: getModel('faq-generation'),
        prompt,
        temperature: 0.4,
      });

      // Strip markdown code fences if present (defensive)
      const clean = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(clean);
      faqs = parsed.faqs as Array<{ question: string; answer: string }>;

      if (!Array.isArray(faqs) || faqs.length === 0) {
        throw new Error('AI returned empty or invalid faqs array');
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { file: 'faq-generator.ts', sprint: '104' },
      });
      faqs = staticFaqFallback(location, pageType);
    }
  }

  const jsonLdString = buildFaqSchema(faqs);

  return {
    schemaType: 'FAQPage',
    jsonLd: JSON.parse(jsonLdString),
    jsonLdString,
    description: `AI-generated FAQ schema with ${faqs.length} questions tailored to ${input.location.business_name}. Paste into your website <head>.`,
    estimatedImpact:
      'Est. +20 AEO score points — FAQPage schema is the #1 driver of AI citation probability.',
    missingReason: 'No FAQPage structured data found on your website.',
  };
}
