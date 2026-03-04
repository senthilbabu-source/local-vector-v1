// ---------------------------------------------------------------------------
// lib/sandbox/query-simulation-engine.ts — Query Simulation Engine
//
// Sprint 110: Simulates AI answers to queries given submitted content.
// Uses Vercel AI SDK with Claude for simulation, pure functions for evaluation.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { normalizePhone, extractPhonePatterns } from './ground-truth-diffuser';
import type {
  SandboxGroundTruth,
  GroundTruthField,
  QuerySimulationResult,
  AnswerQuality,
} from './types';
import { SANDBOX_LIMITS } from './types';

interface TargetQuery {
  id: string;
  query_text: string;
  query_category: string;
}

/**
 * Simulates queries against content and evaluates each answer.
 */
export async function simulateQueriesAgainstContent(
  contentText: string,
  queries: TargetQuery[],
  groundTruth: SandboxGroundTruth,
): Promise<{ results: QuerySimulationResult[]; tokensUsed: { input: number; output: number } }> {
  const results: QuerySimulationResult[] = [];
  let totalInput = 0;
  let totalOutput = 0;

  // Truncate content to word limit
  const words = contentText.split(/\s+/);
  const truncated = words.length > SANDBOX_LIMITS.MAX_CONTENT_WORDS
    ? words.slice(0, SANDBOX_LIMITS.MAX_CONTENT_WORDS).join(' ')
    : contentText;

  const limited = queries.slice(0, SANDBOX_LIMITS.MAX_QUERIES_PER_RUN);

  for (const query of limited) {
    if (!hasApiKey('anthropic')) {
      results.push(buildNoApiResult(query, groundTruth));
      continue;
    }

    try {
      const { text: answer, usage } = await generateText({
        model: getModel('sandbox-simulation'),
        system: buildQuerySimSystemPrompt(),
        prompt: buildQuerySimUserPrompt(truncated, query.query_text),
        maxTokens: 250,
        temperature: 0.3,
      });

      totalInput += usage?.promptTokens ?? 0;
      totalOutput += usage?.completionTokens ?? 0;

      const evaluation = evaluateSimulatedAnswer(answer, query.query_text, groundTruth, truncated);

      results.push({
        query_id: query.id,
        query_text: query.query_text,
        query_category: query.query_category,
        simulated_answer: answer,
        ...evaluation,
      });

      // 200ms delay between API calls to avoid rate limit burst
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'sandbox-query-sim', sprint: '110' }, extra: { queryId: query.id } });
      results.push(buildErrorResult(query));
    }
  }

  return { results, tokensUsed: { input: totalInput, output: totalOutput } };
}

/**
 * Selects optimal queries for simulation from target_queries table.
 * Returns up to MAX_QUERIES_PER_RUN active queries.
 */
export async function selectQueriesForSimulation(
  supabase: SupabaseClient<Database>,
  locationId: string,
): Promise<TargetQuery[]> {
  const { data, error } = await supabase
    .from('target_queries')
    .select('id, query_text, query_category')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(SANDBOX_LIMITS.MAX_QUERIES_PER_RUN);

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id,
    query_text: row.query_text,
    query_category: row.query_category ?? 'discovery',
  }));
}

/**
 * Builds the query simulation system prompt.
 */
export function buildQuerySimSystemPrompt(): string {
  return `You are an AI assistant answering a user's question about a local business. You have access ONLY to the business information provided below. Do not use any knowledge you may have about this business from other sources — use ONLY what is in the content. If the content does not provide enough information to answer the question, say so clearly. Do not fabricate business facts.`;
}

/**
 * Builds the query simulation user prompt.
 */
export function buildQuerySimUserPrompt(contentText: string, queryText: string): string {
  return `Business information:\n${contentText}\n\nUser question: ${queryText}`;
}

/**
 * Evaluates a simulated answer for quality and accuracy. Pure function.
 */
export function evaluateSimulatedAnswer(
  simulatedAnswer: string,
  queryText: string,
  groundTruth: SandboxGroundTruth,
  contentText: string,
): Pick<QuerySimulationResult, 'answer_quality' | 'cites_business' | 'facts_present' | 'facts_hallucinated' | 'ground_truth_alignment' | 'word_count'> {
  const answerLower = simulatedAnswer.toLowerCase();
  const wordCount = simulatedAnswer.split(/\s+/).filter(Boolean).length;

  // Check for "no answer" indicators
  const noAnswerPhrases = [
    "i don't have",
    'not provided',
    'i cannot',
    'no information',
    'not mentioned',
    'the content does not',
    'not enough information',
    'no basis',
  ];
  const isNoAnswer = noAnswerPhrases.some(phrase => answerLower.includes(phrase));

  // Check if answer cites the business by name
  const citesBusiness = groundTruth.name
    ? answerLower.includes(groundTruth.name.toLowerCase())
    : false;

  // Check which GT facts are present
  const factsPresent = checkFactsPresent(simulatedAnswer, groundTruth);

  // Detect hallucinated facts
  const factsHallucinated = detectHallucinatedFacts(simulatedAnswer, groundTruth, contentText);

  // Compute GT alignment
  const totalCheckable = factsPresent.length + factsHallucinated.length;
  const alignment = totalCheckable > 0
    ? Math.round((factsPresent.length / totalCheckable) * 100)
    : isNoAnswer ? 0 : 50;

  // Determine answer quality
  let quality: AnswerQuality;
  if (isNoAnswer) {
    quality = 'no_answer';
  } else if (factsHallucinated.length > 0) {
    quality = 'wrong';
  } else if (citesBusiness && factsPresent.length >= 2) {
    quality = 'complete';
  } else {
    quality = 'partial';
  }

  return {
    answer_quality: quality,
    cites_business: citesBusiness,
    facts_present: factsPresent,
    facts_hallucinated: factsHallucinated,
    ground_truth_alignment: alignment,
    word_count: wordCount,
  };
}

/**
 * Detects hallucinated numeric/temporal facts in a simulated answer.
 * Checks for phone numbers, prices, dates, and times not in content or GT.
 */
export function detectHallucinatedFacts(
  simulatedAnswer: string,
  groundTruth: SandboxGroundTruth,
  contentText: string,
): string[] {
  const hallucinated: string[] = [];

  // Check phone numbers
  const answerPhones = extractPhonePatterns(simulatedAnswer);
  const gtPhone = groundTruth.phone ? normalizePhone(groundTruth.phone) : null;
  const contentPhones = extractPhonePatterns(contentText);

  for (const phone of answerPhones) {
    const inGT = gtPhone && phone === gtPhone;
    const inContent = contentPhones.some(cp => cp === phone);
    if (!inGT && !inContent) {
      hallucinated.push(`Phone number: ${phone}`);
    }
  }

  // Check dollar amounts
  const priceRegex = /\$\d+(?:\.\d{2})?/g;
  const answerPrices: string[] = simulatedAnswer.match(priceRegex) || [];
  const contentPrices: string[] = contentText.match(priceRegex) || [];
  for (const price of answerPrices) {
    if (!contentPrices.includes(price)) {
      hallucinated.push(`Price: ${price}`);
    }
  }

  return hallucinated;
}

/**
 * Checks which Ground Truth fields are present in the simulated answer.
 */
export function checkFactsPresent(
  simulatedAnswer: string,
  groundTruth: SandboxGroundTruth,
): GroundTruthField[] {
  const present: GroundTruthField[] = [];
  const answerLower = simulatedAnswer.toLowerCase();

  if (groundTruth.name && answerLower.includes(groundTruth.name.toLowerCase())) {
    present.push('name');
  }
  if (groundTruth.phone) {
    const gtDigits = normalizePhone(groundTruth.phone);
    const answerPhones = extractPhonePatterns(simulatedAnswer);
    if (answerPhones.some(p => p === gtDigits)) {
      present.push('phone');
    }
  }
  if (groundTruth.address && answerLower.includes(groundTruth.address.toLowerCase())) {
    present.push('address');
  }
  if (groundTruth.city && answerLower.includes(groundTruth.city.toLowerCase())) {
    present.push('city');
  }
  if (groundTruth.state && answerLower.includes(groundTruth.state.toLowerCase())) {
    present.push('state');
  }
  if (groundTruth.category && answerLower.includes(groundTruth.category.toLowerCase())) {
    present.push('category');
  }
  if (groundTruth.website && answerLower.includes(groundTruth.website.toLowerCase())) {
    present.push('website');
  }

  return present;
}

function buildNoApiResult(query: TargetQuery, groundTruth: SandboxGroundTruth): QuerySimulationResult {
  return {
    query_id: query.id,
    query_text: query.query_text,
    query_category: query.query_category,
    simulated_answer: '[No API key configured — simulation skipped]',
    answer_quality: 'no_answer',
    cites_business: false,
    facts_present: [],
    facts_hallucinated: [],
    word_count: 0,
    ground_truth_alignment: 0,
  };
}

function buildErrorResult(query: TargetQuery): QuerySimulationResult {
  return {
    query_id: query.id,
    query_text: query.query_text,
    query_category: query.query_category,
    simulated_answer: '[Simulation error]',
    answer_quality: 'no_answer',
    cites_business: false,
    facts_present: [],
    facts_hallucinated: [],
    word_count: 0,
    ground_truth_alignment: 0,
  };
}
