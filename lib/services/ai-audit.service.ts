// ---------------------------------------------------------------------------
// AI Audit Service — Phase 20: Automated Web Audit Engine
//
// Accepts a location's ground-truth data, constructs a structured prompt,
// and asks OpenAI GPT-4o to identify discrepancies between the ground truth
// and what the model "knows" about the restaurant.
//
// Returns an array of DetectedHallucination objects ready for insertion
// into the ai_hallucinations table. Enum values match prod_schema.sql
// exactly (all lowercase).
//
// Demo mode: when OPENAI_API_KEY is absent (local dev, CI), returns one
// placeholder hallucination so the route's insert pipeline can be exercised
// end-to-end without a real API key.
// ---------------------------------------------------------------------------

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

// ── OpenAI response shape ──────────────────────────────────────────────────

interface OpenAIResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

interface AuditResult {
  hallucinations: DetectedHallucination[];
}

// ── Demo result ────────────────────────────────────────────────────────────
// Returned in local dev / CI when OPENAI_API_KEY is absent. Allows the
// cron route's database insert pipeline to be exercised without a real key.

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

/**
 * Audits a single location for AI hallucinations.
 *
 * Calls OpenAI GPT-4o with a structured ground-truth prompt and parses the
 * JSON response into DetectedHallucination objects. Falls back to a single
 * demo hallucination when OPENAI_API_KEY is absent.
 *
 * Throws on network or API errors — the cron route catches these per-org.
 */
export async function auditLocation(
  location: LocationAuditInput
): Promise<DetectedHallucination[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.log(
      '[ai-audit] OPENAI_API_KEY absent — returning demo result for:',
      location.business_name
    );
    return [DEMO_HALLUCINATION];
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildAuditPrompt(location) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as AuditResult;
  return Array.isArray(parsed.hallucinations) ? parsed.hallucinations : [];
}
