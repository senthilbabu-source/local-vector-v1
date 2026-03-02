// ---------------------------------------------------------------------------
// lib/vaio/voice-content-scorer.ts — Voice-friendliness scoring
//
// Pure functions — no I/O. Scores text content for voice search optimization.
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import type { VoiceContentScore, VoiceContentIssue } from './types';

export const ACTION_VERBS = [
  'book', 'reserve', 'visit', 'call', 'order', 'enjoy', 'experience',
  'taste', 'find', 'try', 'discover', 'explore', 'dine', 'celebrate',
  'join', 'bring', 'host', 'plan', 'attend',
];

// ---------------------------------------------------------------------------
// Main scorer
// ---------------------------------------------------------------------------

export function scoreVoiceContent(
  content: string,
  businessName: string,
  city: string,
  contentType: 'faq_page' | 'gbp_post' | 'faq_answer' | 'llms_txt',
): VoiceContentScore {
  if (!content || content.trim().length === 0) {
    return {
      overall_score: 0,
      avg_sentence_words: 0,
      direct_answer_score: 0,
      local_specificity_score: 0,
      action_language_score: 0,
      spoken_length_score: 0,
      issues: [{
        type: 'no_direct_answer',
        severity: 'critical',
        description: 'Content is empty.',
        fix: 'Add content with a direct answer to the target question.',
      }],
    };
  }

  const issues: VoiceContentIssue[] = [];
  const words = content.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lowerContent = content.toLowerCase();
  const lowerName = businessName.toLowerCase();
  const lowerCity = city.toLowerCase();

  // ── 1. Direct Answer Score (max 30) ────────────────────────────────────
  let directAnswerScore = 0;
  const firstSentence = getFirstSentence(content);
  const firstSentenceLower = firstSentence.toLowerCase();

  const hasNameOrCategory = firstSentenceLower.includes(lowerName) ||
    firstSentenceLower.includes(lowerCity);
  const startsWithFiller = /^(welcome to|at [a-z]|thank you|we believe)/i.test(firstSentence);
  const startsWithWe = /^we /i.test(firstSentence);

  if (startsWithFiller) {
    directAnswerScore = 0;
    issues.push({
      type: 'no_direct_answer',
      severity: 'warning',
      description: 'First sentence starts with filler ("Welcome to..." or "At...").',
      fix: 'Start with a concrete fact: business name, location, hours, or a specific feature.',
    });
  } else if (hasNameOrCategory) {
    directAnswerScore = 30;
  } else if (startsWithWe) {
    directAnswerScore = 15;
  } else {
    directAnswerScore = 10;
  }

  // ── 2. Local Specificity Score (max 25) ────────────────────────────────
  let localSpecificityScore = 0;
  const first50Words = words.slice(0, 50).join(' ').toLowerCase();
  const nameInFirst50 = first50Words.includes(lowerName);
  const cityInFirst50 = first50Words.includes(lowerCity);

  if (nameInFirst50 && cityInFirst50) {
    localSpecificityScore = 25;
  } else if (nameInFirst50 || cityInFirst50) {
    localSpecificityScore = 15;
  } else if (lowerContent.includes(lowerName) || lowerContent.includes(lowerCity)) {
    localSpecificityScore = 5;
  } else {
    localSpecificityScore = 0;
  }

  if (!lowerContent.includes(lowerName)) {
    issues.push({
      type: 'no_business_name',
      severity: 'critical',
      description: 'Business name is not mentioned in the content.',
      fix: `Include "${businessName}" in the opening sentence so AI can attribute the answer.`,
    });
  }
  if (!lowerContent.includes(lowerCity)) {
    issues.push({
      type: 'no_local_mention',
      severity: 'warning',
      description: 'City/area is not mentioned in the content.',
      fix: `Include "${city}" to help AI associate the answer with a specific location.`,
    });
  }

  // ── 3. Action Language Score (max 25) ───────────────────────────────────
  const actionVerbCount = countActionVerbs(content);
  let actionLanguageScore = 0;
  if (actionVerbCount >= 3) {
    actionLanguageScore = 25;
  } else if (actionVerbCount >= 1) {
    actionLanguageScore = 15;
  }

  // ── 4. Spoken Length Score (max 20) ─────────────────────────────────────
  let spokenLengthScore = 0;
  if (wordCount >= 50 && wordCount <= 200) {
    spokenLengthScore = 20;
  } else if (wordCount >= 201 && wordCount <= 300) {
    spokenLengthScore = 10;
  } else if (wordCount < 30) {
    spokenLengthScore = 5;
  }

  if (wordCount > 300) {
    issues.push({
      type: 'too_long',
      severity: contentType === 'faq_answer' ? 'critical' : 'warning',
      description: `Content is ${wordCount} words — too long for a spoken answer.`,
      fix: 'Shorten to 50–200 words for an ideal voice answer length.',
    });
  }

  // ── Additional issue detection ──────────────────────────────────────────
  const avgWords = avgSentenceWords(content);

  if (avgWords > 30) {
    issues.push({
      type: 'long_sentences',
      severity: 'critical',
      description: `Average sentence length is ${Math.round(avgWords)} words — very hard to parse when spoken.`,
      fix: 'Break sentences into 15–20 word chunks for natural speech rhythm.',
    });
  } else if (avgWords > 20) {
    issues.push({
      type: 'long_sentences',
      severity: 'warning',
      description: `Average sentence length is ${Math.round(avgWords)} words — could be shorter for voice.`,
      fix: 'Target 15–20 words per sentence for optimal voice delivery.',
    });
  }

  if (containsMarkdown(content)) {
    issues.push({
      type: 'contains_markdown',
      severity: 'critical',
      description: 'Content contains markdown formatting that reads poorly aloud.',
      fix: 'Remove ** bold markers, # headers, and - bullet lists. Use plain sentence structure.',
    });
  }

  if (containsRawUrls(content)) {
    issues.push({
      type: 'contains_urls',
      severity: 'critical',
      description: 'Content contains raw URLs that sound awkward when spoken.',
      fix: 'Remove URLs or replace with "visit our website" or "call us at..."',
    });
  }

  const overallScore = directAnswerScore + localSpecificityScore +
    actionLanguageScore + spokenLengthScore;

  return {
    overall_score: Math.min(100, overallScore),
    avg_sentence_words: Math.round(avgWords * 10) / 10,
    direct_answer_score: directAnswerScore,
    local_specificity_score: localSpecificityScore,
    action_language_score: actionLanguageScore,
    spoken_length_score: spokenLengthScore,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Helper functions (exported for testing)
// ---------------------------------------------------------------------------

export function countActionVerbs(text: string): number {
  const lower = text.toLowerCase();
  const words = lower.split(/\b/);
  let count = 0;
  for (const verb of ACTION_VERBS) {
    if (words.includes(verb)) count++;
  }
  return count;
}

export function avgSentenceWords(text: string): number {
  const cleaned = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Jr|Sr|St|U\.S|vs)\./gi, '$1_DOT_')
    .replace(/\.\.\./g, '_ELLIPSIS_');
  const sentences = cleaned.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;

  let totalWords = 0;
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    totalWords += words.length;
  }
  return totalWords / sentences.length;
}

export function fleschKincaidGrade(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;

  let totalSyllables = 0;
  for (const word of words) {
    totalSyllables += countSyllables(word);
  }

  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = totalSyllables / words.length;

  return Math.max(0, 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59);
}

export function containsMarkdown(text: string): boolean {
  return /(\*\*|__|##?|^- |^\* |^#{1,3} )/m.test(text);
}

export function containsRawUrls(text: string): boolean {
  return /https?:\/\/[^\s)]+/.test(text);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.split('\n')[0].trim();
}

function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length <= 3) return 1;

  const vowelGroups = cleaned.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Silent 'e' at end
  if (cleaned.endsWith('e') && !cleaned.endsWith('le')) {
    count = Math.max(1, count - 1);
  }

  return Math.max(1, count);
}
