// ---------------------------------------------------------------------------
// lib/review-engine/response-generator.ts — AI Response Drafting
//
// Sprint 107: Uses GPT-4o-mini via Vercel AI SDK to generate on-brand,
// SEO-optimized review response drafts. Cost-sensitive volume operation.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { Review, ReviewSentiment, BrandVoiceProfile, ReviewResponseDraft } from './types';
import type { GroundTruth } from '@/lib/nap-sync/types';

/**
 * Response generation limits per plan tier.
 */
export const RESPONSE_GENERATION_LIMITS: Record<string, number> = {
  trial:   5,
  starter: 25,
  growth:  100,
  agency:  500,
};

/**
 * Builds the system prompt for the response generator.
 * Pure function — exported for testing.
 */
export function buildResponseSystemPrompt(
  groundTruth: GroundTruth,
  brandVoice: BrandVoiceProfile,
  sentiment: ReviewSentiment,
): string {
  const lines: string[] = [];

  lines.push(`You are writing a review response for ${groundTruth.name}, a business located in ${groundTruth.city}, ${groundTruth.state}.`);
  lines.push('');

  // Brand voice instructions
  lines.push('Brand voice guidelines:');
  lines.push(`- Tone: ${brandVoice.tone}`);
  lines.push(`- Formality: ${brandVoice.formality}`);
  lines.push(`- Emojis: ${brandVoice.use_emojis ? 'Use 1-2 relevant emojis naturally' : 'Do not use emojis'}`);
  lines.push(`- Sign off with: ${brandVoice.sign_off}`);
  if (brandVoice.owner_name && sentiment.label === 'negative') {
    lines.push(`- For this negative review, sign off as: ${brandVoice.owner_name}, Owner`);
  }
  lines.push('');

  // SEO instruction
  if (brandVoice.highlight_keywords.length > 0) {
    lines.push(`SEO: Naturally weave 1-2 of these keywords into the response: ${brandVoice.highlight_keywords.join(', ')}`);
    lines.push('');
  }

  // Avoid phrases
  if (brandVoice.avoid_phrases.length > 0) {
    lines.push(`Never use these phrases: ${brandVoice.avoid_phrases.join(', ')}`);
    lines.push('');
  }

  // Negative review rules
  if (sentiment.label === 'negative') {
    lines.push('IMPORTANT — This is a negative review:');
    lines.push('- Always acknowledge the specific complaint mentioned');
    lines.push('- Never be defensive or dismissive');
    lines.push('- Always offer a concrete next step (call, email, or visit again)');
    lines.push(`- If available, mention contact: ${groundTruth.website ?? 'our team'}`);
    lines.push('');
  }

  // Custom instructions
  if (brandVoice.custom_instructions) {
    lines.push(`Additional instructions: ${brandVoice.custom_instructions}`);
    lines.push('');
  }

  lines.push('Response rules:');
  lines.push('- Length: 50-150 words (optimal for Google and Yelp display)');
  lines.push('- Output: plain text only — no markdown, no JSON, no HTML');
  lines.push('- Address the reviewer by first name');
  lines.push('- Be genuine and specific to what they mentioned');

  return lines.join('\n');
}

/**
 * Builds the user message for the response generator.
 * Pure function — exported for testing.
 */
export function buildResponseUserMessage(
  review: Review,
  sentiment: ReviewSentiment,
): string {
  const lines: string[] = [];

  lines.push(`Reviewer: ${review.reviewer_name}`);
  lines.push(`Rating: ${review.rating}/5 stars`);
  lines.push(`Sentiment: ${sentiment.label} (keywords: ${sentiment.keywords.join(', ') || 'none'})`);
  lines.push('');
  lines.push('Review text:');
  lines.push(`"${review.text}"`);
  lines.push('');
  lines.push('Write a response to this review following the brand voice guidelines above.');

  return lines.join('\n');
}

/**
 * Validates a generated response draft.
 * Checks: word count (50-150), no forbidden phrases, sign-off present.
 */
export function validateResponseDraft(
  draft: string,
  brandVoice: BrandVoiceProfile,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const wordCount = draft.split(/\s+/).filter(Boolean).length;

  if (wordCount < 30) {
    issues.push(`Response too short: ${wordCount} words (minimum 30)`);
  }
  if (wordCount > 200) {
    issues.push(`Response too long: ${wordCount} words (maximum 200)`);
  }

  for (const phrase of brandVoice.avoid_phrases) {
    if (draft.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(`Contains forbidden phrase: "${phrase}"`);
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Generates an on-brand, SEO-optimized review response draft.
 * Uses GPT-4o-mini via Vercel AI SDK. Returns ReviewResponseDraft.
 */
export async function generateResponseDraft(
  review: Review,
  sentiment: ReviewSentiment,
  brandVoice: BrandVoiceProfile,
  groundTruth: GroundTruth,
): Promise<ReviewResponseDraft> {
  const systemPrompt = buildResponseSystemPrompt(groundTruth, brandVoice, sentiment);
  const userMessage = buildResponseUserMessage(review, sentiment);

  try {
    const { text: draftText } = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      prompt: userMessage,
      maxTokens: 300,
      temperature: 0.7,
    });

    // Check which SEO keywords were used
    const seoKeywordsUsed = brandVoice.highlight_keywords.filter(
      (kw) => draftText.toLowerCase().includes(kw.toLowerCase()),
    );

    // Simple tone match heuristic
    const toneMatchScore = calculateToneMatch(draftText, brandVoice);

    return {
      review_id: review.id,
      platform: review.platform,
      draft_text: draftText.trim(),
      character_count: draftText.trim().length,
      seo_keywords_used: seoKeywordsUsed,
      tone_match_score: toneMatchScore,
      generation_method: 'ai',
      requires_approval: review.rating <= 2,
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'response-generator', sprint: '107' },
    });

    // Fallback to template-based response
    return generateTemplateResponse(review, sentiment, brandVoice);
  }
}

/**
 * Simple tone match heuristic. Returns 0-1.
 */
function calculateToneMatch(text: string, brandVoice: BrandVoiceProfile): number {
  let score = 0.5; // Base

  // Check sign-off presence
  if (text.includes(brandVoice.sign_off)) score += 0.2;

  // Check emoji compliance
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(text);
  if (brandVoice.use_emojis === hasEmoji) score += 0.15;

  // Check no forbidden phrases
  const hasForbidden = brandVoice.avoid_phrases.some(
    (p) => text.toLowerCase().includes(p.toLowerCase()),
  );
  if (!hasForbidden) score += 0.15;

  return Math.min(1, Math.round(score * 100) / 100);
}

/**
 * Fallback template-based response when LLM fails.
 */
function generateTemplateResponse(
  review: Review,
  sentiment: ReviewSentiment,
  brandVoice: BrandVoiceProfile,
): ReviewResponseDraft {
  const firstName = review.reviewer_name.split(' ')[0] || review.reviewer_name;
  let draft: string;

  if (sentiment.label === 'negative') {
    draft = `${firstName}, thank you for taking the time to share your feedback. We take all guest experiences seriously and want to make this right. Please reach out to our team directly so we can address your concerns. ${brandVoice.sign_off}`;
  } else if (sentiment.label === 'neutral') {
    draft = `${firstName}, thank you for visiting and sharing your thoughts! We appreciate your honest feedback and are always looking to improve. We hope to welcome you back soon. ${brandVoice.sign_off}`;
  } else {
    draft = `${firstName}, thank you so much for the wonderful review! We're thrilled you had a great experience. We look forward to welcoming you back soon! ${brandVoice.sign_off}`;
  }

  return {
    review_id: review.id,
    platform: review.platform,
    draft_text: draft,
    character_count: draft.length,
    seo_keywords_used: [],
    tone_match_score: 0.5,
    generation_method: 'template',
    requires_approval: review.rating <= 2,
    generated_at: new Date().toISOString(),
  };
}
