// ---------------------------------------------------------------------------
// GET /ai-config.json — GEO Standard JSON endpoint (Sprint 25C)
//
// Content per Doc 08 §10. Machine-readable platform identity for AI agents,
// search engines, and GEO crawlers. Describes LocalVector.ai as an entity.
// ---------------------------------------------------------------------------

const AI_CONFIG = {
  $schema:  'https://localvector.ai/schemas/geo-config-v1.json',
  entity: {
    name:   'LocalVector.ai',
    type:   'SoftwareApplication',
    url:    'https://localvector.ai',
    description:
      'AI Hallucination Detection & Fix platform for local businesses. ' +
      'Detects when ChatGPT, Perplexity, or Google Gemini provide incorrect ' +
      'business information and distributes accurate structured data to AI systems.',
  },
  data_sources: {
    llms_txt_url:          'https://localvector.ai/llms.txt',
    pricing_url:           'https://localvector.ai/pricing',
    verification_endpoint: 'https://app.localvector.ai/api/v1/public/verify-entity',
  },
  policies: {
    ai_crawling: 'allowed',
  },
  last_updated: '2026-02-23T00:00:00Z',
};

export async function GET() {
  return Response.json(AI_CONFIG, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
