// ---------------------------------------------------------------------------
// lib/services/correction-verifier.service.ts — Sprint F (N3)
//
// Re-runs the original detection query against the original AI model to check
// whether a hallucination has been corrected. Used by the correction follow-up
// cron (app/api/cron/correction-follow-up/route.ts).
//
// Pure logic + AI calls. No direct DB writes.
//
// Detection strategy: substring match on key phrases extracted from the
// original wrong description. If ANY distinctive wrong fact (phone number,
// time, address) still appears in the new response, we consider it
// "still hallucinating."
//
// Improvement path: use an LLM judge in a future sprint for more nuanced
// verification. For Sprint F, substring match is sufficient and costs no credits.
// ---------------------------------------------------------------------------

import { queryOpenAI, queryPerplexity, queryGemini } from '@/lib/ai-preview/model-queries';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FollowUpAlert {
  id: string;
  correction_query: string;
  model_provider: string;
  claim_text: string;
}

export interface FollowUpResult {
  stillHallucinating: boolean;
}

// ---------------------------------------------------------------------------
// Main check function
// ---------------------------------------------------------------------------

export async function checkCorrectionStatus(alert: FollowUpAlert): Promise<FollowUpResult> {
  const { correction_query, model_provider, claim_text } = alert;

  // Re-query the original model with the stored query
  let aiResponse: string;
  try {
    aiResponse = await runSingleModelQuery(correction_query, model_provider);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'correction-verifier', sprint: 'F' },
      extra: { alertId: alert.id, model: model_provider },
    });
    // If the model query fails, assume still hallucinating (conservative)
    return { stillHallucinating: true };
  }

  // Extract distinctive wrong phrases from the original claim
  const wrongPhrases = extractKeyPhrases(claim_text);

  // If no key phrases could be extracted, fall back to broad substring match
  if (wrongPhrases.length === 0) {
    // Use the first 30 chars of the claim as a loose match
    const fragment = claim_text.slice(0, 30).toLowerCase();
    return { stillHallucinating: aiResponse.toLowerCase().includes(fragment) };
  }

  // If ANY of the wrong phrases appear in the new response → still hallucinating
  const stillHallucinating = wrongPhrases.some((phrase) =>
    aiResponse.toLowerCase().includes(phrase.toLowerCase()),
  );

  return { stillHallucinating };
}

// ---------------------------------------------------------------------------
// Key phrase extraction
// ---------------------------------------------------------------------------

/**
 * Extracts 1–4 distinctive wrong facts from the hallucination claim_text
 * to use for substring matching in the follow-up response.
 *
 * Targets: phone numbers, times (11am, 5pm), addresses, specific numbers.
 */
export function extractKeyPhrases(description: string): string[] {
  const phrases: string[] = [];

  // Phone numbers: 404-555-0100, (404) 555-0100
  const phones = description.match(/\b\d{3}[-.\s)]\s*\d{3}[-.\s]\d{4}\b/g);
  if (phones) phrases.push(...phones);

  // Times: 11am, 5pm, 10:30am
  const times = description.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi);
  if (times) phrases.push(...times);

  // Street addresses: 123 Main St
  const addresses = description.match(
    /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Dr|Blvd|Rd|Way|Pkwy|Ln|Ct|Pl)\b/g,
  );
  if (addresses) phrases.push(...addresses);

  // Dollar amounts: $15, $12.99
  const dollars = description.match(/\$\d+(?:\.\d{2})?/g);
  if (dollars) phrases.push(...dollars);

  // Fallback: use the longest contiguous word sequence (3+ word-length words)
  if (phrases.length === 0 && description.length > 10) {
    const words = description.split(/\s+/).filter((w) => w.length > 4);
    if (words.length >= 2) {
      phrases.push(words.slice(0, 3).join(' '));
    }
  }

  // Deduplicate and limit to 4
  return [...new Set(phrases)].slice(0, 4);
}

// ---------------------------------------------------------------------------
// Model routing
// ---------------------------------------------------------------------------

/**
 * Maps model_provider enum values to the appropriate query function.
 * model_provider values: 'openai-gpt4o', 'perplexity-sonar', 'google-gemini',
 * 'anthropic-claude', 'microsoft-copilot'
 */
async function runSingleModelQuery(query: string, modelProvider: string): Promise<string> {
  const provider = modelProvider.toLowerCase();

  let result;
  if (provider.includes('openai') || provider.includes('gpt') || provider.includes('copilot')) {
    result = await queryOpenAI(query, '');
  } else if (provider.includes('perplexity')) {
    result = await queryPerplexity(query, '');
  } else if (provider.includes('gemini') || provider.includes('google')) {
    result = await queryGemini(query, '');
  } else {
    // Unknown model — fall back to OpenAI
    result = await queryOpenAI(query, '');
  }

  if (result.status === 'error') {
    throw new Error(`Model query failed: ${result.content}`);
  }

  return result.content;
}
