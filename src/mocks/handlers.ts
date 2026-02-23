// MSW Handlers — Forward-looking API mocks for Phase 18 AI integration
//
// These handlers intercept real HTTP calls to OpenAI and Perplexity so that:
//   • Integration tests never hit real paid APIs (AI_RULES §4)
//   • Phase 18 feature code can be tested with deterministic responses
//   • Response shapes are validated against canonical schemas (Doc 03 §15)
//
// Activated via instrumentation.ts when NEXT_PUBLIC_API_MOCKING=enabled.
// NOT active during normal Playwright E2E runs (no env var set).
//
// MSW v2 API: import { http, HttpResponse } from 'msw'

import { http, HttpResponse } from 'msw';
import type { MenuExtractedData } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Shared fixtures (Charcoal N Chill golden-tenant per AI_RULES §4)
// ---------------------------------------------------------------------------

/**
 * A deterministic MenuExtractedData payload matching the golden-tenant menu.
 * Used as the simulated output of the Phase 18 GPT-4o Vision OCR pipeline.
 * All confidence scores ≥ 0.85 (auto-approved tier).
 */
const MOCK_EXTRACTED_MENU: MenuExtractedData = {
  items: [
    {
      id: 'mock-item-001',
      name: 'Brisket Plate',
      description: 'Slow-smoked beef brisket, two sides, cornbread.',
      price: '$22.00',
      category: 'BBQ Plates',
      confidence: 0.96,
    },
    {
      id: 'mock-item-002',
      name: 'Pulled Pork Sandwich',
      description: 'House-smoked pulled pork on brioche with pickles.',
      price: '$14.00',
      category: 'BBQ Plates',
      confidence: 0.92,
    },
    {
      id: 'mock-item-003',
      name: 'Mac & Cheese',
      description: 'Creamy four-cheese blend, baked to order.',
      price: '$8.00',
      category: 'Sides',
      confidence: 0.88,
    },
  ],
  extracted_at: '2026-02-22T10:00:00.000Z',
  source_url: 'https://charcoalnchill.com/menu.pdf',
};

/**
 * Hallucination detection payload matching the updated ai_hallucinations schema.
 * Doc 03 §15.11: model_provider (not engine), correction_status (not is_resolved),
 * all enum values strictly lowercase.
 */
const MOCK_HALLUCINATION_DETECTION = {
  model_provider:   'perplexity-sonar',   // correct column name
  severity:         'critical',           // lowercase — PostgreSQL ENUM constraint
  category:         'status',             // valid: 'status'|'hours'|'amenity'|'menu'|'address'|'phone'
  claim_text:       'Charcoal N Chill is permanently closed.',
  expected_truth:   'Open Tuesday–Sunday 11 AM–10 PM. Full bar and hookah available.',
  correction_status:'open',               // correct column name (not is_resolved)
  occurrence_count: 1,
  first_detected_at:'2026-02-22T10:00:00.000Z',
  last_seen_at:     '2026-02-22T10:00:00.000Z',
};

// ---------------------------------------------------------------------------
// OpenAI handler — Magic Menu OCR extraction (Phase 18)
// ---------------------------------------------------------------------------

/**
 * Intercepts POST https://api.openai.com/v1/chat/completions
 *
 * In Phase 18, the Magic Menu pipeline sends the menu PDF pages to GPT-4o
 * Vision and expects a JSON-encoded MenuExtractedData in the response content.
 * This handler returns a deterministic golden-tenant payload so tests pass
 * without spending real API credits.
 */
const openAiHandler = http.post(
  'https://api.openai.com/v1/chat/completions',
  () => {
    return HttpResponse.json({
      id: 'chatcmpl-mock-0001',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            // The Phase 18 pipeline expects the model to return a JSON string
            // that can be parsed into MenuExtractedData.
            content: JSON.stringify(MOCK_EXTRACTED_MENU),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 512, completion_tokens: 256, total_tokens: 768 },
    });
  }
);

// ---------------------------------------------------------------------------
// Perplexity handler — Hallucination detection (Phase 18)
// ---------------------------------------------------------------------------

/**
 * Intercepts POST https://api.perplexity.ai/chat/completions
 *
 * In Phase 18, the Fear Engine sends a grounding prompt to Perplexity Sonar
 * and expects the response to describe any factual discrepancies it found.
 * This handler returns a response that the hallucination classifier would
 * flag as a 'critical' status hallucination.
 */
const perplexityHandler = http.post(
  'https://api.perplexity.ai/chat/completions',
  () => {
    return HttpResponse.json({
      id: 'perplexity-mock-0001',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'sonar',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            // Phase 18: runFreeScan requests JSON output via its system prompt.
            // Returning JSON here lets the server action take the clean JSON parse
            // path. Values map directly to the ScanResult fields the Playwright
            // test asserts: claim_text="Permanently Closed", expected_truth="Open".
            content: JSON.stringify({
              is_closed: true,
              claim_text: 'Permanently Closed',
              expected_truth: 'Open',
              severity: 'critical',
            }),
          },
          finish_reason: 'stop',
        },
      ],
      // The Phase 18 pipeline stores this in ai_hallucinations using the
      // corrected schema (model_provider, correction_status — see Doc 03 §15.11).
      _localvector_mock_schema: MOCK_HALLUCINATION_DETECTION,
    });
  }
);

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const handlers = [openAiHandler, perplexityHandler];
