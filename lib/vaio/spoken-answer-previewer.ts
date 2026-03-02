// ---------------------------------------------------------------------------
// lib/vaio/spoken-answer-previewer.ts — Spoken answer simulation
//
// Pure functions — no I/O. Converts raw content into voice-ready previews.
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import type { SpokenAnswerPreview, VoiceContentIssue } from './types';
import { scoreVoiceContent, fleschKincaidGrade } from './voice-content-scorer';

export const VOICE_IDEAL_MIN_WORDS = 75;
export const VOICE_IDEAL_MAX_WORDS = 150;
export const VOICE_ACCEPTABLE_MAX_WORDS = 250;
export const VOICE_TTS_WPM = 150;

// ---------------------------------------------------------------------------
// Main previewer
// ---------------------------------------------------------------------------

export function generateSpokenPreview(
  content: string,
  businessName: string,
  city: string,
  contentType: 'faq_page' | 'gbp_post' | 'faq_answer' | 'llms_txt',
): SpokenAnswerPreview {
  const cleaned = cleanForVoice(content);
  const words = cleaned.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const spokenSeconds = estimateSpokenSeconds(wordCount);
  const gradeLevel = fleschKincaidGrade(cleaned);

  const scoreResult = scoreVoiceContent(content, businessName, city, contentType);
  const issues: VoiceContentIssue[] = [...scoreResult.issues];

  // Additional preview-specific checks
  if (wordCount < VOICE_IDEAL_MIN_WORDS) {
    issues.push({
      type: 'too_long', // reusing type — actually too short
      severity: 'info',
      description: `Only ${wordCount} words — may be too brief for a complete spoken answer.`,
      fix: `Expand to ${VOICE_IDEAL_MIN_WORDS}–${VOICE_IDEAL_MAX_WORDS} words for an ideal voice answer.`,
    });
  }

  if (gradeLevel > 10) {
    issues.push({
      type: 'long_sentences',
      severity: 'warning',
      description: `Reading grade level is ${gradeLevel.toFixed(1)} — aim for 6–8 for voice.`,
      fix: 'Simplify vocabulary and shorten sentences for easier spoken comprehension.',
    });
  }

  const isVoiceReady =
    wordCount >= VOICE_IDEAL_MIN_WORDS &&
    wordCount <= VOICE_ACCEPTABLE_MAX_WORDS &&
    gradeLevel <= 10 &&
    issues.filter((i) => i.severity === 'critical').length === 0;

  return {
    content,
    word_count: wordCount,
    estimated_spoken_seconds: Math.round(spokenSeconds),
    is_voice_ready: isVoiceReady,
    cleaned_content: cleaned,
    issues,
    reading_grade_level: Math.round(gradeLevel * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Cleaning pipeline
// ---------------------------------------------------------------------------

export function cleanForVoice(text: string): string {
  let cleaned = text;

  // 1. Strip HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // 2. Strip markdown formatting: **, *, ##, #, ─, ═
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  cleaned = cleaned.replace(/[─═]/g, '');

  // 3. Replace bullet list items with comma-joined prose
  const bulletLines = cleaned.match(/^[\s]*[-•*]\s+.+$/gm);
  if (bulletLines && bulletLines.length > 1) {
    const items = bulletLines.map((line) => line.replace(/^[\s]*[-•*]\s+/, '').trim());
    const lastItem = items.pop();
    const prose = items.length > 0
      ? `${items.join(', ')}, and ${lastItem}`
      : lastItem ?? '';
    // Replace the bullet block with prose
    for (const line of bulletLines) {
      cleaned = cleaned.replace(line, '');
    }
    cleaned = cleaned.trim() + ' ' + prose;
  }

  // 4. Replace raw URLs with [link]
  cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, '[link]');

  // 5. Replace email addresses with [email]
  cleaned = cleaned.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email]');

  // 6. Normalize whitespace
  cleaned = cleaned.replace(/\n{2,}/g, ' ').replace(/\n/g, ' ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // 7. Truncate at 250 words
  const words = cleaned.split(/\s+/);
  if (words.length > VOICE_ACCEPTABLE_MAX_WORDS) {
    cleaned = words.slice(0, VOICE_ACCEPTABLE_MAX_WORDS).join(' ') + '...';
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// Duration estimation
// ---------------------------------------------------------------------------

export function estimateSpokenSeconds(wordCount: number): number {
  return (wordCount / VOICE_TTS_WPM) * 60;
}
