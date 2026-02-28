// ---------------------------------------------------------------------------
// AI Audit Service — Phase 20: Automated Web Audit Engine
//
// Surgery 1: Replaced raw fetch() with Vercel AI SDK generateText().
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import * as Sentry from '@sentry/nextjs';

// ── Types (mirror prod_schema.sql enums exactly) ───────────────────────────

export type ModelProvider =
  | 'openai-gpt4o'
  | 'perplexity-sonar'
  | 'google-gemini'
  | 'anthropic-claude'
  | 'microsoft-copilot';

export type HallucinationSeverity = 'critical' | 'high' | 'medium' | 'low';

export type HallucinationCategory =
  | 'status'
  | 'hours'
  | 'amenity'
  | 'menu'
  | 'address'
  | 'phone';

export interface LocationAuditInput {
  id: string;
  org_id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  address_line1: string | null;
  hours_data: Record<string, unknown> | null;
  amenities: Record<string, unknown> | null;
}

export interface DetectedHallucination {
  model_provider: ModelProvider;
  severity: HallucinationSeverity;
  category: HallucinationCategory;
  claim_text: string;
  expected_truth: string;
}

// ── Demo result ────────────────────────────────────────────────────────────

const DEMO_HALLUCINATION: DetectedHallucination = {
  model_provider: 'openai-gpt4o',
  severity: 'medium',
  category: 'status',
  claim_text: '[Demo] This restaurant may be permanently closed.',
  expected_truth:
    'Restaurant is actively operating — ground truth data on file.',
};

// ── Prompt construction ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI hallucination auditor specialising in local restaurants.
Given ground-truth data about a restaurant, identify any facts that the
OpenAI GPT-4o model commonly gets wrong about this business based on its
training data.

Return ONLY valid JSON in this exact format:
{
  "hallucinations": [
    {
      "model_provider": "openai-gpt4o",
      "severity": "high",
      "category": "status",
      "claim_text": "The incorrect claim the model makes",
      "expected_truth": "The correct information from ground truth"
    }
  ]
}

If no discrepancies exist, return { "hallucinations": [] }.

Valid model_provider values: openai-gpt4o, perplexity-sonar, google-gemini,
  anthropic-claude, microsoft-copilot
Valid severity values (all lowercase): critical, high, medium, low
Valid category values (all lowercase): status, hours, amenity, menu, address, phone

Only report genuine discrepancies backed by the ground truth provided.`;

function buildAuditPrompt(location: LocationAuditInput): string {
  const lines: string[] = [`Business Name: ${location.business_name}`];

  if (location.city && location.state) {
    lines.push(`Location: ${location.city}, ${location.state}`);
  }
  if (location.address_line1) {
    lines.push(`Address: ${location.address_line1}`);
  }
  if (location.hours_data) {
    lines.push(`Hours (ground truth): ${JSON.stringify(location.hours_data)}`);
  }
  if (location.amenities) {
    lines.push(
      `Amenities (ground truth): ${JSON.stringify(location.amenities)}`
    );
  }

  return [
    'Check the following ground truth against what GPT-4o would claim about this restaurant:',
    ...lines,
    '',
    'Return JSON: { "hallucinations": [...] }',
  ].join('\n');
}

// ── Main export ────────────────────────────────────────────────────────────

export async function auditLocation(
  location: LocationAuditInput
): Promise<DetectedHallucination[]> {
  if (!hasApiKey('openai')) {
    console.log(
      '[ai-audit] OPENAI_API_KEY absent — returning demo result for:',
      location.business_name
    );
    return [DEMO_HALLUCINATION];
  }

  const { text } = await generateText({
    model: getModel('fear-audit'),
    system: SYSTEM_PROMPT,
    prompt: buildAuditPrompt(location),
  });

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.hallucinations) ? parsed.hallucinations : [];
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'ai-audit.service.ts', sprint: 'A' } });
    return [];
  }
}