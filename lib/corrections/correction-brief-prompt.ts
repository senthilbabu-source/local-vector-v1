// ---------------------------------------------------------------------------
// lib/corrections/correction-brief-prompt.ts — Sprint 121: Pure prompt builders
//
// No side effects, no DB calls. Pure functions only.
// ---------------------------------------------------------------------------

export interface CorrectionBriefPromptParams {
  claim_text: string;
  org_name: string;
  correct_info: string;
  content_type: string;
}

export function buildCorrectionBriefPrompt(params: CorrectionBriefPromptParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt:
      'You are a professional content writer helping a local business correct ' +
      'misinformation appearing in AI responses. Write factual, authoritative ' +
      'content that clearly establishes the correct information so AI systems ' +
      'can learn from it. Keep content concise (150-200 words) and factual.',
    userPrompt:
      `A false claim about ${params.org_name} is circulating in AI responses:\n` +
      `FALSE CLAIM: "${params.claim_text}"\n\n` +
      `Write a ${params.content_type} that clearly establishes: ${params.correct_info}\n\n` +
      'Make it factual, easy for AI systems to parse, suitable for publishing.',
  };
}

export function buildCorrectionDraftTitle(claim_text: string, org_name: string): string {
  return `Correction: ${claim_text.slice(0, 60)} — ${org_name}`;
}
