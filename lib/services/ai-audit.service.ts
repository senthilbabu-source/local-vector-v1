// ---------------------------------------------------------------------------
// AI Audit Service — Phase 20: Automated Web Audit Engine
//
// Surgery 1: Replaced raw fetch() with Vercel AI SDK generateText().
// Surgery 2: Replaced generateText() + JSON.parse() with generateObject()
//            for Zod-validated structured output (Sprint 54).
// ---------------------------------------------------------------------------

import { generateObject } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { AuditResultSchema } from '@/lib/ai/schemas';

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

If no discrepancies exist, return an empty hallucinations array.
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

  const { object } = await generateObject({
    model: getModel('fear-audit'),
    schema: AuditResultSchema,
    system: SYSTEM_PROMPT,
    prompt: buildAuditPrompt(location),
  });

  return (object as { hallucinations: DetectedHallucination[] }).hallucinations;
}