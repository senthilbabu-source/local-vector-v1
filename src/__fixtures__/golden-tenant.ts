/**
 * Golden Tenant — Charcoal N Chill
 *
 * Canonical test data used across ALL test suites (Doc 11, Section 3).
 * Every test that needs a realistic business should import from here.
 * Do NOT invent ad-hoc test data.
 *
 * Phase 3 additions: MOCK_COMPETITOR and MOCK_INTERCEPT — canonical
 * competitor intercept fixture data for all Compete page tests.
 */

import type { GBPAccount, GBPLocation } from '@/lib/types/gbp';
import type { HallucinationAuditRow } from '@/lib/exports/csv-builder';
import type { AuditReportData } from '@/lib/exports/pdf-assembler';
import type { RateLimitResult } from '@/lib/rate-limit/types';
import type { SOVDropAlertParams } from '@/lib/alerts/slack';

export const GOLDEN_TENANT = {
  org: {
    name: 'Charcoal N Chill',
    slug: 'charcoal-n-chill',
    plan: 'growth' as const,
    plan_status: 'active' as const,
    audit_frequency: 'daily',
    max_locations: 1,
    max_ai_audits_per_month: 60,
  },
  location: {
    name: 'Charcoal N Chill - Alpharetta',
    slug: 'alpharetta',
    business_name: 'Charcoal N Chill',
    address_line1: '11950 Jones Bridge Road Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    phone: '(470) 546-4866',
    website_url: 'https://charcoalnchill.com',
    operational_status: 'OPERATIONAL',
    hours_data: {
      monday: 'closed',
      tuesday: { open: '17:00', close: '01:00' },
      wednesday: { open: '17:00', close: '01:00' },
      thursday: { open: '17:00', close: '01:00' },
      friday: { open: '17:00', close: '02:00' },
      saturday: { open: '17:00', close: '02:00' },
      sunday: { open: '17:00', close: '01:00' },
    },
    amenities: {
      has_outdoor_seating: true,
      serves_alcohol: true,
      has_hookah: true,
      is_kid_friendly: false,
      takes_reservations: true,
      has_live_music: true,
      has_dj: true,
      has_private_rooms: true,
    },
    categories: ['Hookah Bar', 'Indian Restaurant', 'Fusion Restaurant', 'Lounge'],
  },
  user: {
    email: 'test-owner@charcoalnchill.com',
    full_name: 'Test Owner',
    role: 'owner' as const,
  },
} as const;

/**
 * Phase 3 — Canonical competitor fixture for Charcoal N Chill.
 * UUIDs are stable and match supabase/seed.sql Section 13.
 * Use in all Competitor Intercept unit and integration tests.
 */
export const MOCK_COMPETITOR = {
  id:                 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id:             'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  competitor_name:    'Cloud 9 Lounge',
  competitor_address: '123 Main St, Alpharetta, GA 30005',
  notes:              null,
} as const;

/**
 * Phase 3 — Canonical competitor intercept result fixture.
 * Mirrors the GPT-4o-mini Intercept Analysis output shape (Doc 04, §3.2).
 * UUIDs are stable and match supabase/seed.sql Section 13.
 */
export const MOCK_INTERCEPT = {
  id:              'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id:          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  competitor_name: 'Cloud 9 Lounge',
  query_asked:     'Best hookah bar in Alpharetta GA',
  model_provider:  'openai-gpt4o-mini',
  winner:          'Cloud 9 Lounge',
  winner_reason:   'More review mentions of late-night atmosphere and happy hour deals.',
  winning_factor:  '15 more review mentions of "late night" atmosphere',
  gap_analysis:    { competitor_mentions: 15, your_mentions: 2 },
  gap_magnitude:   'high',
  suggested_action:'Ask 3 customers to mention "late night" in their reviews this week',
  action_status:   'pending',
} as const;

/**
 * Sprint 68 — Canonical ai_audits fixture for Charcoal N Chill.
 * UUID matches supabase/seed.sql Section 16 (ai_audit_1).
 * Use in all audit-cron tests that validate ai_audits INSERT behavior.
 */
export const MOCK_AI_AUDIT = {
  id: 'd6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  model_provider: 'openai-gpt4o' as const,
  prompt_type: 'status_check' as const,
  is_hallucination_detected: true,
  audit_date: new Date().toISOString(),
  created_at: new Date().toISOString(),
} as const;

/**
 * Rival Tenant — used exclusively for RLS isolation tests.
 * Verifies that Tenant B cannot read or mutate Tenant A's data.
 */
/**
 * Sprint 69 — Canonical SOV response fixture for "AI Says" page tests.
 * UUIDs match supabase/seed.sql Section 9 (target_query + sov_evaluations).
 */
export const MOCK_SOV_RESPONSE = {
  queryId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  queryText: 'Best BBQ restaurant in Alpharetta GA',
  queryCategory: 'discovery',
  engines: [
    {
      engine: 'openai',
      rankPosition: 2,
      rawResponse:
        'Here are some of the best BBQ restaurants in Alpharetta, GA: 1. Dreamland BBQ — a beloved regional chain. 2. Charcoal N Chill — popular for smoked brisket. 3. Pappadeaux Seafood Kitchen — BBQ offerings worth a visit.',
      mentionedCompetitors: ['Dreamland BBQ', 'Pappadeaux Seafood Kitchen'],
      createdAt: '2026-02-26T12:00:00.000Z',
    },
    {
      engine: 'perplexity',
      rankPosition: 1,
      rawResponse:
        'Based on recent reviews, Charcoal N Chill stands out as a top dining destination in Alpharetta, GA. Dreamland BBQ is another popular option.',
      mentionedCompetitors: ['Dreamland BBQ'],
      createdAt: '2026-02-26T12:05:00.000Z',
    },
    {
      engine: 'google',
      rankPosition: 1,
      rawResponse:
        'Based on recent reviews and Google Business Profile data, Charcoal N Chill is a highly-rated hookah lounge in Alpharetta, GA, known for its Indo-American fusion cuisine and premium hookah experience. Other options include Cloud 9 Lounge and Astra Hookah.',
      mentionedCompetitors: ['Cloud 9 Lounge', 'Astra Hookah'],
      citedSources: [
        { url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta', title: 'Charcoal N Chill - Alpharetta - Yelp' },
        { url: 'https://g.co/charcoal-n-chill', title: 'Charcoal N Chill - Google Business Profile' },
      ],
      createdAt: '2026-02-26T12:10:00.000Z',
    },
    {
      engine: 'copilot',
      rankPosition: 2,
      rawResponse:
        'Based on Bing Places and Yelp reviews, Charcoal N Chill in Alpharetta is a well-reviewed hookah lounge offering Indo-American fusion cuisine. Cloud 9 Lounge is another popular option in the area.',
      mentionedCompetitors: ['Cloud 9 Lounge'],
      createdAt: '2026-02-26T12:15:00.000Z',
    },
  ],
  latestDate: '2026-02-26T12:15:00.000Z',
} as const;

/**
 * Sprint 74 — Canonical Google-grounded SOV result fixture.
 * Use in all Google AI Overview tests.
 */
export const MOCK_GOOGLE_SOV_RESULT: import('@/lib/services/sov-engine.service').SOVQueryResult = {
  queryId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  queryText: 'Best BBQ restaurant in Alpharetta GA',
  queryCategory: 'discovery',
  locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  ourBusinessCited: true,
  businessesFound: [],
  citationUrl: null,
  engine: 'google',
  citedSources: [
    { url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta', title: 'Charcoal N Chill - Yelp' },
    { url: 'https://g.co/charcoal-n-chill', title: 'Google Business Profile' },
  ],
};

/**
 * Sprint 79 — Canonical Copilot SOV result fixture.
 * Use in all Microsoft Copilot SOV tests.
 */
export const MOCK_COPILOT_SOV_RESULT: import('@/lib/services/sov-engine.service').SOVQueryResult = {
  queryId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  queryText: 'Best BBQ restaurant in Alpharetta GA',
  queryCategory: 'discovery',
  locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  ourBusinessCited: true,
  businessesFound: [],
  citationUrl: null,
  engine: 'copilot',
};

/**
 * Sprint 70 — Schema Fix Generator input fixture.
 * Mirrors GOLDEN_TENANT.location but typed as SchemaLocationInput for
 * use in schema generator unit tests.
 *
 * Explicitly typed (not `as const`) to avoid readonly inference on
 * `categories: string[]` which is incompatible with mutable `Categories`.
 */
export const MOCK_SCHEMA_LOCATION: import('@/lib/schema-generator/types').SchemaLocationInput = {
  business_name: 'Charcoal N Chill',
  address_line1: '11950 Jones Bridge Road Ste 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  country: 'US',
  phone: '(470) 546-4866',
  website_url: 'https://charcoalnchill.com',
  hours_data: {
    monday: 'closed',
    tuesday: { open: '17:00', close: '01:00' },
    wednesday: { open: '17:00', close: '01:00' },
    thursday: { open: '17:00', close: '01:00' },
    friday: { open: '17:00', close: '02:00' },
    saturday: { open: '17:00', close: '02:00' },
    sunday: { open: '17:00', close: '01:00' },
  },
  amenities: {
    has_outdoor_seating: true,
    serves_alcohol: true,
    has_hookah: true,
    is_kid_friendly: false,
    takes_reservations: true,
    has_live_music: true,
    has_dj: true,
    has_private_rooms: true,
  },
  categories: ['Hookah Bar', 'Indian Restaurant', 'Fusion Restaurant', 'Lounge', 'Nightlife'],
  google_place_id: 'ChIJi8-1ywdO9YgR9s5j-y0_1lI',
};

/**
 * Sprint 70 — Mock integrations for LocalBusiness schema tests.
 */
export const MOCK_SCHEMA_INTEGRATIONS: import('@/lib/schema-generator/types').SchemaIntegrationInput[] = [
  { platform: 'google', listing_url: 'https://g.page/charcoal-n-chill-alpharetta' },
  { platform: 'yelp', listing_url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta' },
  { platform: 'facebook', listing_url: 'https://www.facebook.com/profile.php?id=61571869656813' },
  { platform: 'instagram', listing_url: 'https://www.instagram.com/charcoal_n_chill/' },
  { platform: 'linkedin', listing_url: 'https://www.linkedin.com/in/charcoal-n-chill-7837323ab/' },
  { platform: 'youtube', listing_url: 'https://www.youtube.com/@CharcoalNChill' },
  { platform: 'tiktok', listing_url: 'https://www.tiktok.com/@charcoalnchill' },
];

/**
 * Sprint 70 — Mock target queries for FAQ schema tests.
 */
export const MOCK_SCHEMA_QUERIES: import('@/lib/schema-generator/types').SchemaQueryInput[] = [
  { query_text: 'Best BBQ restaurant in Alpharetta GA', query_category: 'discovery' },
  { query_text: 'Best hookah bar near Alpharetta', query_category: 'near_me' },
  { query_text: 'Charcoal N Chill vs Cloud 9 Lounge Alpharetta', query_category: 'comparison' },
  { query_text: 'birthday party venue Alpharetta with hookah and private rooms', query_category: 'occasion' },
];

/**
 * Sprint 71 — Canonical page_audits fixture for Charcoal N Chill.
 * UUID matches supabase/seed.sql Section 14c (page_audit).
 * Use in all page audit unit tests.
 */
export const MOCK_PAGE_AUDIT = {
  id: 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  page_url: 'https://charcoalnchill.com',
  page_type: 'homepage',
  overall_score: 66,
  answer_first_score: 65,
  schema_completeness_score: 55,
  faq_schema_present: false,
  faq_schema_score: 0,
  entity_clarity_score: 62,
  aeo_readability_score: 78,
  recommendations: [
    {
      issue: 'Opening text is navigation/hero copy with no substance',
      fix: 'Replace your opening section with: "Charcoal N Chill is Alpharetta\'s premier [value prop]. [Top differentiator]. [CTA]." Start with the answer.',
      impactPoints: 35,
      dimensionKey: 'answerFirst' as const,
    },
    {
      issue: 'Missing required JSON-LD schema for homepage page',
      fix: 'Add a <script type="application/ld+json"> block with the correct @type for your homepage page. This is the single highest-impact technical fix for AI visibility.',
      impactPoints: 25,
      dimensionKey: 'schemaCompleteness' as const,
      schemaType: 'LocalBusiness' as const,
    },
    {
      issue: 'No FAQPage schema found — this is the #1 driver of AI citations',
      fix: 'Add FAQPage schema with at least 5 Q&A pairs about Charcoal N Chill. AI models directly extract and quote FAQ content.',
      impactPoints: 20,
      dimensionKey: 'faqSchema' as const,
      schemaType: 'FAQPage' as const,
    },
  ],
  last_audited_at: '2026-02-26T09:00:00.000Z',
  created_at: '2026-02-26T09:00:00.000Z',
} as const;

/**
 * Sprint 72 — Canonical HealthScoreInput fixture for Charcoal N Chill.
 * Use in all AI Health Score unit tests.
 */
export const MOCK_HEALTH_SCORE_INPUT: import('@/lib/services/ai-health-score.service').HealthScoreInput = {
  sovScore: 0.42,
  pageAudit: {
    overall_score: 66,
    answer_first_score: 65,
    schema_completeness_score: 55,
    faq_schema_score: 0,
    entity_clarity_score: 62,
    aeo_readability_score: 78,
    faq_schema_present: false,
    recommendations: [
      {
        issue: 'Opening text is navigation/hero copy with no substance',
        fix: 'Replace your opening section with an answer-first format.',
        impactPoints: 35,
        dimensionKey: 'answerFirst',
      },
      {
        issue: 'Missing required JSON-LD schema for homepage page',
        fix: 'Add LocalBusiness JSON-LD schema.',
        impactPoints: 25,
        dimensionKey: 'schemaCompleteness',
        schemaType: 'LocalBusiness',
      },
      {
        issue: 'No FAQPage schema found',
        fix: 'Add FAQPage schema with at least 5 Q&A pairs.',
        impactPoints: 20,
        dimensionKey: 'faqSchema',
        schemaType: 'FAQPage',
      },
    ],
  },
  openHallucinationCount: 2,
  totalAuditCount: 5,
  hasFaqSchema: false,
  hasLocalBusinessSchema: false,
};

/**
 * Sprint 73 — Canonical crawler_hits fixture for Charcoal N Chill.
 * UUIDs match supabase/seed.sql Section 20.
 */
export const MOCK_CRAWLER_HIT = {
  id: 'g0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  menu_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  bot_type: 'gptbot',
  user_agent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0)',
  crawled_at: '2026-02-25T12:00:00.000Z',
} as const;

/**
 * Sprint 73 — Canonical CrawlerSummary fixture for dashboard tests.
 */
export const MOCK_CRAWLER_SUMMARY: import('@/lib/data/crawler-analytics').CrawlerSummary = {
  totalVisits: 6,
  blindSpotCount: 5,
  bots: [
    { botType: 'google-extended', label: 'Google-Extended', engine: 'Gemini', description: 'Gemini AI training', visitCount: 2, lastVisitAt: '2026-02-26T12:00:00.000Z', status: 'low' },
    { botType: 'gptbot', label: 'GPTBot', engine: 'ChatGPT', description: 'OpenAI training crawler', visitCount: 2, lastVisitAt: '2026-02-25T12:00:00.000Z', status: 'low' },
    { botType: 'oai-searchbot', label: 'OAI-SearchBot', engine: 'ChatGPT Search', description: 'ChatGPT live search', visitCount: 1, lastVisitAt: '2026-02-23T12:00:00.000Z', status: 'low' },
    { botType: 'claudebot', label: 'ClaudeBot', engine: 'Claude', description: 'Anthropic training crawler', visitCount: 1, lastVisitAt: '2026-02-24T12:00:00.000Z', status: 'low' },
    { botType: 'chatgpt-user', label: 'ChatGPT-User', engine: 'ChatGPT', description: 'ChatGPT browsing mode', visitCount: 0, lastVisitAt: null, status: 'blind_spot' },
    { botType: 'perplexitybot', label: 'PerplexityBot', engine: 'Perplexity', description: 'Perplexity search crawler', visitCount: 0, lastVisitAt: null, status: 'blind_spot' },
    { botType: 'meta-external', label: 'Meta-External', engine: 'Meta AI', description: 'Meta AI training crawler', visitCount: 0, lastVisitAt: null, status: 'blind_spot' },
    { botType: 'bytespider', label: 'Bytespider', engine: 'TikTok/ByteDance', description: 'ByteDance AI crawler', visitCount: 0, lastVisitAt: null, status: 'blind_spot' },
    { botType: 'amazonbot', label: 'Amazonbot', engine: 'Amazon AI', description: 'Amazon AI crawler', visitCount: 0, lastVisitAt: null, status: 'blind_spot' },
    { botType: 'applebot-extended', label: 'Applebot', engine: 'Apple Intelligence', description: 'Apple Siri/Intelligence', visitCount: 0, lastVisitAt: null, status: 'blind_spot' },
  ],
  blindSpots: [
    { botType: 'chatgpt-user', label: 'ChatGPT-User', engine: 'ChatGPT', fixRecommendation: 'ChatGPT browsing requires GPTBot access. Check robots.txt and ensure your site loads without JavaScript.' },
    { botType: 'perplexitybot', label: 'PerplexityBot', engine: 'Perplexity', fixRecommendation: 'Allow PerplexityBot in robots.txt. Submit your URL to Perplexity via their web interface.' },
    { botType: 'meta-external', label: 'Meta-External', engine: 'Meta AI', fixRecommendation: 'Allow meta-externalagent in robots.txt. Ensure your Facebook/Instagram business profiles link to your website.' },
    { botType: 'bytespider', label: 'Bytespider', engine: 'TikTok/ByteDance', fixRecommendation: 'Bytespider crawls pages linked from TikTok. Ensure your TikTok profile links to your menu page.' },
    { botType: 'amazonbot', label: 'Amazonbot', engine: 'Amazon AI', fixRecommendation: 'Allow Amazonbot in robots.txt. Ensure your business is listed on Amazon/Alexa.' },
  ],
};

/**
 * Sprint 75 — Canonical CorrectionInput fixture for Charcoal N Chill.
 * Uses a "permanently closed" hallucination — the most common and impactful type.
 */
export const MOCK_CORRECTION_INPUT: import('@/lib/services/correction-generator.service').CorrectionInput = {
  hallucination: {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    claim_text: 'Charcoal N Chill appears to be permanently closed.',
    expected_truth: 'Charcoal N Chill is actively operating at 11950 Jones Bridge Road Ste 103, Alpharetta, GA.',
    category: 'closed',
    severity: 'critical',
    model_provider: 'openai-gpt4o',
  },
  location: {
    business_name: 'Charcoal N Chill',
    address_line1: '11950 Jones Bridge Road Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    phone: '(470) 546-4866',
    website_url: 'https://charcoalnchill.com',
    hours_data: {
      monday: 'closed',
      tuesday: { open: '17:00', close: '01:00' },
      wednesday: { open: '17:00', close: '01:00' },
      thursday: { open: '17:00', close: '01:00' },
      friday: { open: '17:00', close: '02:00' },
      saturday: { open: '17:00', close: '02:00' },
      sunday: { open: '17:00', close: '01:00' },
    },
    amenities: {
      has_outdoor_seating: true,
      serves_alcohol: true,
      has_hookah: true,
      is_kid_friendly: false,
      takes_reservations: true,
      has_live_music: true,
      has_dj: true,
      has_private_rooms: true,
    },
    categories: ['Hookah Bar', 'Indian Restaurant', 'Fusion Restaurant', 'Lounge'],
    operational_status: 'OPERATIONAL',
  },
};

/**
 * Sprint 76 — Canonical cron_run_log fixtures for System Health dashboard tests.
 * UUIDs match supabase/seed.sql Section 21.
 */
export const MOCK_CRON_RUN_SUCCESS: import('@/lib/services/cron-health.service').CronRunRow = {
  id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  cron_name: 'audit',
  started_at: '2026-02-26T08:00:00.000Z',
  completed_at: '2026-02-26T08:02:30.000Z',
  duration_ms: 150000,
  status: 'success',
  summary: { orgs_processed: 5, hallucinations_found: 3 },
  error_message: null,
  created_at: '2026-02-26T08:00:00.000Z',
};

export const MOCK_CRON_RUN_FAILED: import('@/lib/services/cron-health.service').CronRunRow = {
  id: 'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  cron_name: 'sov',
  started_at: '2026-02-25T07:00:00.000Z',
  completed_at: '2026-02-25T07:01:00.000Z',
  duration_ms: 60000,
  status: 'failed',
  summary: null,
  error_message: 'Perplexity API rate limit exceeded',
  created_at: '2026-02-25T07:00:00.000Z',
};

/**
 * Sprint 76 — Canonical visibility_analytics snapshots for freshness decay tests.
 * Shows a 28.6% decline in citation_rate from 0.42 to 0.30 (warning-level alert).
 */
export const MOCK_FRESHNESS_SNAPSHOTS: import('@/lib/services/freshness-alert.service').VisibilitySnapshot[] = [
  { snapshot_date: '2026-02-12', citation_rate: 0.45, share_of_voice: 0.50 },
  { snapshot_date: '2026-02-19', citation_rate: 0.42, share_of_voice: 0.42 },
  { snapshot_date: '2026-02-26', citation_rate: 0.30, share_of_voice: 0.35 },
];

/**
 * Sprint 77 — Canonical TimelineInput fixture for Charcoal N Chill.
 * 4 weeks of data showing SOV improvement after schema addition.
 */
export const MOCK_TIMELINE_INPUT: import('@/lib/services/proof-timeline.service').TimelineInput = {
  snapshots: [
    { snapshot_date: '2026-01-29', share_of_voice: 0.12 },
    { snapshot_date: '2026-02-05', share_of_voice: 0.12 },
    { snapshot_date: '2026-02-12', share_of_voice: 0.17 },
    { snapshot_date: '2026-02-19', share_of_voice: 0.19 },
  ],
  audits: [
    { last_audited_at: '2026-01-30T10:00:00.000Z', overall_score: 54, faq_schema_present: false, schema_completeness_score: 20 },
    { last_audited_at: '2026-02-06T10:00:00.000Z', overall_score: 72, faq_schema_present: true, schema_completeness_score: 85 },
  ],
  publishedContent: [
    {
      id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      published_at: '2026-02-01T14:00:00.000Z',
      draft_title: 'FAQ Page: Hookah Menu & Experience',
      content_type: 'faq_page',
      trigger_type: 'competitor_gap',
    },
  ],
  firstBotVisits: [
    { bot_type: 'gptbot', first_crawled_at: '2026-02-07T08:00:00.000Z' },
    { bot_type: 'perplexitybot', first_crawled_at: '2026-02-14T12:00:00.000Z' },
  ],
  hallucinations: [
    {
      id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      claim_text: 'Charcoal N Chill appears to be permanently closed.',
      severity: 'critical',
      detected_at: '2026-01-28T09:00:00.000Z',
      resolved_at: '2026-02-15T11:00:00.000Z',
      correction_status: 'fixed',
    },
  ],
};

export const RIVAL_TENANT = {
  org: {
    name: 'Cloud 9 Lounge',
    slug: 'cloud-9-lounge',
    plan: 'starter' as const,
    plan_status: 'active' as const,
  },
  user: {
    email: 'test-rival@cloud9lounge.com',
    full_name: 'Rival Owner',
    role: 'owner' as const,
  },
} as const;

/**
 * Sprint 78 — Canonical DigestDataInput fixture for Charcoal N Chill.
 * Represents a good week: score up +3, one win, one new issue, one opportunity.
 */
export const MOCK_DIGEST_INPUT: import('@/lib/services/weekly-digest.service').DigestDataInput = {
  org: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: "Aruna's Venue" },
  owner: { email: 'dev@localvector.ai', full_name: 'Aruna Surendera Babu' },
  location: { business_name: 'Charcoal N Chill', city: 'Alpharetta', state: 'GA' },
  currentHealthScore: 67,
  previousHealthScore: 64,
  currentSov: 0.19,
  previousSov: 0.17,
  newHallucinations: [
    { claim_text: 'Charcoal N Chill closes at 10pm', severity: 'high', model_provider: 'openai-gpt4o' },
  ],
  resolvedHallucinations: 1,
  sovWins: [
    { query_text: 'hookah near Alpharetta', engine: 'perplexity' },
  ],
  topRecommendation: {
    title: 'Add FAQ Schema',
    description: 'Add structured FAQ markup for estimated +8 points.',
    href: '/dashboard/page-audits',
    estimatedImpact: 8,
  },
  botVisitsThisWeek: 12,
  newBlindSpots: 3,
};

/**
 * Sprint 80 — Canonical EntityCheckRow fixture for Charcoal N Chill.
 * 3/6 confirmed: Google KP, GBP, Yelp. TripAdvisor and Apple Maps missing. Bing incomplete.
 * UUIDs match supabase/seed.sql Section 25.
 */
/**
 * Sprint 81 — Canonical sentiment extraction for Charcoal N Chill.
 * Positive overall, with one minor negative descriptor.
 */
export const MOCK_SENTIMENT_EXTRACTION: import('@/lib/ai/schemas').SentimentExtraction = {
  score: 0.72,
  label: 'positive',
  descriptors: {
    positive: ['popular', 'premium atmosphere', 'unique', 'highly rated', 'Indo-American fusion'],
    negative: ['limited parking'],
    neutral: ['located in Alpharetta', 'offers hookah'],
  },
  tone: 'enthusiastic',
  recommendation_strength: 'primary',
};

/**
 * Sprint 81 — Canonical sentiment summary for dashboard tests.
 */
export const MOCK_SENTIMENT_SUMMARY: import('@/lib/services/sentiment.service').SentimentSummary = {
  averageScore: 0.65,
  dominantLabel: 'positive',
  dominantTone: 'positive',
  topPositive: ['popular', 'premium', 'unique atmosphere', 'highly rated', 'Indo-American fusion'],
  topNegative: ['limited parking'],
  byEngine: {
    perplexity: {
      averageScore: 0.72,
      label: 'positive',
      tone: 'enthusiastic',
      descriptors: { positive: ['popular', 'premium'], negative: [] },
    },
    openai: {
      averageScore: 0.65,
      label: 'positive',
      tone: 'positive',
      descriptors: { positive: ['highly rated', 'unique'], negative: ['limited parking'] },
    },
    copilot: {
      averageScore: 0.50,
      label: 'neutral',
      tone: 'matter_of_fact',
      descriptors: { positive: ['well-reviewed'], negative: [] },
    },
  },
  evaluationCount: 12,
};

/**
 * Sprint 82 — Canonical source mention extraction for OpenAI (no structured citations).
 */
export const MOCK_SOURCE_MENTION_EXTRACTION: import('@/lib/ai/schemas').SourceMentionExtraction = {
  sources: [
    {
      name: 'Yelp',
      type: 'review_site',
      inferredUrl: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta',
      context: '4.5 star rating with emphasis on atmosphere',
      isCompetitorContent: false,
    },
    {
      name: 'Google Maps',
      type: 'directory',
      inferredUrl: 'https://maps.google.com/charcoal-n-chill',
      context: 'Business hours and location information',
      isCompetitorContent: false,
    },
    {
      name: 'Cloud 9 Lounge Blog',
      type: 'blog',
      inferredUrl: null,
      context: 'Competitor comparison mentioning hookah selection',
      isCompetitorContent: true,
    },
  ],
  sourcingQuality: 'well_sourced',
};

/**
 * Sprint 82 — Canonical SourceIntelligenceInput for full analysis.
 */
export const MOCK_SOURCE_INTELLIGENCE_INPUT: import('@/lib/services/source-intelligence.service').SourceIntelligenceInput = {
  businessName: 'Charcoal N Chill',
  websiteUrl: 'https://charcoalnchill.com',
  evaluations: [
    {
      engine: 'google',
      citedSources: [
        { url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta', title: 'Charcoal N Chill - Yelp' },
        { url: 'https://charcoalnchill.com', title: 'Charcoal N Chill' },
      ],
      extractedMentions: null,
      queryText: 'best hookah bar Alpharetta',
    },
    {
      engine: 'perplexity',
      citedSources: [
        { url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta', title: 'Yelp' },
        { url: 'https://www.tripadvisor.com/Restaurant-charcoal-n-chill', title: 'TripAdvisor' },
      ],
      extractedMentions: null,
      queryText: 'best hookah bar Alpharetta',
    },
    {
      engine: 'openai',
      citedSources: null,
      extractedMentions: MOCK_SOURCE_MENTION_EXTRACTION,
      queryText: 'best hookah bar Alpharetta',
    },
  ],
};

/**
 * Sprint 83 — Canonical CalendarInput for Charcoal N Chill.
 * Mixed signals: 1 occasion, 2 SOV gaps, 1 stale page, 1 stale menu,
 * 1 competitor gap, 1 hallucination.
 */
export const MOCK_CALENDAR_INPUT: import('@/lib/services/content-calendar.service').CalendarInput =
  {
    businessName: 'Charcoal N Chill',
    locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    occasions: [
      {
        id: 'occ-valentines',
        name: "Valentine's Day",
        occasionType: 'holiday',
        annualDate: '02-14',
        triggerDaysBefore: 28,
        peakQueryPatterns: ['valentines hookah', 'romantic dinner Alpharetta'],
      },
    ],
    sovGaps: [
      {
        queryId: 'q-private-events',
        queryText: 'private event venue Alpharetta',
        queryCategory: 'discovery',
        missingEngineCount: 3,
        totalEngineCount: 3,
      },
      {
        queryId: 'q-late-night',
        queryText: 'late night hookah near me',
        queryCategory: 'near_me',
        missingEngineCount: 2,
        totalEngineCount: 3,
      },
    ],
    stalePages: [
      {
        pageUrl: 'https://charcoalnchill.com/about',
        pageType: 'about',
        lastAuditedAt: '2026-01-01T00:00:00Z',
        overallScore: 62,
        daysSinceAudit: 56,
      },
    ],
    staleMenu: {
      menuId: 'menu-001',
      lastUpdatedAt: '2026-01-10T00:00:00Z',
      daysSinceUpdate: 47,
      recentBotVisitCount: 5,
      previousBotVisitCount: 12,
    },
    competitorGaps: [
      {
        id: 'ci-001',
        competitorName: 'Cloud 9 Lounge',
        queryAsked: 'best hookah lounge Alpharetta',
        winningFactor: 'wider hookah selection',
        suggestedAction:
          'Create content highlighting your unique Indo-American fusion hookah menu',
        gapMagnitude: 'medium',
      },
    ],
    openHallucinations: [
      {
        id: 'hal-001',
        claimText: 'Charcoal N Chill closes at 10pm',
        severity: 'high',
        modelProvider: 'openai-gpt4o',
      },
    ],
    existingDraftTriggerIds: new Set(),
  };

export const MOCK_ENTITY_CHECK: import('@/lib/services/entity-health.service').EntityCheckRow = {
  google_knowledge_panel: 'confirmed',
  google_business_profile: 'confirmed',
  yelp: 'confirmed',
  tripadvisor: 'missing',
  apple_maps: 'missing',
  bing_places: 'incomplete',
  wikidata: 'unchecked',
  platform_metadata: {
    google_knowledge_panel: { place_id: 'ChIJtest123' },
    bing_places: { note: 'Missing hours' },
  },
};

/**
 * Sprint 84 — Canonical AgentReadinessInput for Charcoal N Chill.
 * Mixed status: hours + menu active, actions missing, CTAs partial.
 * Expected score: 15 + 15 + 0 + 0 + 5 + 5 = 40 (Partially Ready)
 */
/**
 * Sprint D — Charcoal N Chill default revenue configuration.
 * Matches DEFAULT_REVENUE_CONFIG in revenue-impact.service.ts.
 * $55 avg check (food + hookah premium), 60 covers/night × 30 days = 1800/month.
 */
export const CHARCOAL_N_CHILL_REVENUE_CONFIG = {
  avgCustomerValue: 55,
  monthlyCovers: 1800,
} as const;

/**
 * Sprint 85 / Sprint D — Canonical RevenueImpactInput for Charcoal N Chill.
 * $55 avg customer, 1800 covers. 3 SOV gaps, 2 hallucinations, competitor advantage.
 */
export const MOCK_REVENUE_IMPACT_INPUT: import('@/lib/services/revenue-impact.service').RevenueImpactInput = {
  config: {
    avgCustomerValue: 55,
    monthlyCovers: 1800,
  },
  sovGaps: [
    { queryText: 'hookah near me', queryCategory: 'near_me', missingEngineCount: 3, totalEngineCount: 3 },
    { queryText: 'private event venue Alpharetta', queryCategory: 'discovery', missingEngineCount: 3, totalEngineCount: 3 },
    { queryText: 'late night lounge Alpharetta', queryCategory: 'discovery', missingEngineCount: 2, totalEngineCount: 3 },
  ],
  openHallucinations: [
    { claimText: 'Charcoal N Chill closes at 10pm', severity: 'high' },
    { claimText: 'Charcoal N Chill is permanently closed', severity: 'critical' },
  ],
  competitorData: {
    yourSov: 0.19,
    topCompetitorSov: 0.24,
    topCompetitorName: 'Cloud 9 Lounge',
  },
};

export const MOCK_AGENT_READINESS_INPUT: import('@/lib/services/agent-readiness.service').AgentReadinessInput = {
  location: {
    businessName: 'Charcoal N Chill',
    websiteUrl: 'https://charcoalnchill.com',
    hoursData: {
      monday: { open: '16:00', close: '00:00' },
      tuesday: { open: '16:00', close: '00:00' },
      wednesday: { open: '16:00', close: '00:00' },
      thursday: { open: '16:00', close: '02:00' },
      friday: { open: '16:00', close: '02:00' },
      saturday: { open: '14:00', close: '02:00' },
      sunday: { open: '14:00', close: '00:00' },
    },
    phone: '(770) 555-1234',
  },
  hasPublishedMenu: true,
  hasMenuJsonLd: true,
  pageAudit: {
    schemaCompletenessScore: 55,
    faqSchemaPresent: false,
    entityClarityScore: 52,
    recommendations: [
      { title: 'Add FAQ Schema', dimensionKey: 'faqSchema', schemaType: 'FAQPage' },
    ],
  },
  hasBookingUrl: false,
  hasOrderingUrl: false,
  detectedSchemaTypes: ['OpeningHoursSpecification', 'LocalBusiness'],
};

/**
 * Sprint 86 — Canonical BriefStructureInput for "private event venue Alpharetta".
 */
export const MOCK_BRIEF_STRUCTURE_INPUT: import('@/lib/services/content-brief-builder.service').BriefStructureInput = {
  queryText: 'private event venue Alpharetta',
  queryCategory: 'discovery',
  businessName: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
};

/**
 * Sprint 86 — Mock AI-generated ContentBrief for testing.
 */
export const MOCK_CONTENT_BRIEF: import('@/lib/ai/schemas').ContentBrief = {
  answerCapsule: 'Charcoal N Chill in Alpharetta, GA offers private event hosting with premium hookah service, Indo-American fusion dining, and Versace lounge seating for groups of up to 80 guests in an upscale atmosphere.',
  outlineSections: [
    {
      heading: 'Private Event Packages',
      bullets: [
        'Full venue rental for exclusive events',
        'Customizable hookah and dining packages',
        'Capacity for groups from 20 to 80 guests',
        'AV equipment and music coordination available',
      ],
    },
    {
      heading: 'Why Choose Charcoal N Chill',
      bullets: [
        'Unique Indo-American fusion menu not available elsewhere in Alpharetta',
        'Premium Versace lounge seating creates memorable photo opportunities',
        'Experienced event coordination team',
      ],
    },
    {
      heading: 'Book Your Event',
      bullets: [
        'Contact us to discuss your event needs',
        'Flexible scheduling for weekday and weekend events',
        'Custom menu planning available',
      ],
    },
  ],
  faqQuestions: [
    {
      question: 'How many guests can Charcoal N Chill accommodate for private events?',
      answerHint: 'Charcoal N Chill can host private events for groups of 20 to 80 guests in Alpharetta, GA.',
    },
    {
      question: 'Does Charcoal N Chill offer hookah for private events?',
      answerHint: 'Yes, Charcoal N Chill offers premium hookah service as part of private event packages.',
    },
    {
      question: 'What type of food is available for private events?',
      answerHint: 'Charcoal N Chill serves Indo-American fusion cuisine for private events.',
    },
  ],
  metaDescription: 'Book a private event at Charcoal N Chill in Alpharetta, GA. Premium hookah, Indo-American fusion dining, and Versace lounge seating for 20-80 guests.',
};

// ---------------------------------------------------------------------------
// Sprint 89 — GBP API Fixtures for Charcoal N Chill
// ---------------------------------------------------------------------------

/**
 * Sprint 89 — Canonical GBP location fixture for Charcoal N Chill.
 * Mirrors the real GBP API response for the golden tenant.
 * Used by all GBP mapper, callback, and import action tests.
 */
export const MOCK_GBP_LOCATION: GBPLocation = {
  name: 'accounts/123456789/locations/987654321',
  title: 'Charcoal N Chill',
  storefrontAddress: {
    addressLines: ['11950 Jones Bridge Road', 'Ste 103'],
    locality: 'Alpharetta',
    administrativeArea: 'GA',
    postalCode: '30005',
    regionCode: 'US',
  },
  regularHours: {
    periods: [
      { openDay: 'TUESDAY',   openTime: { hours: 17, minutes: 0 }, closeDay: 'TUESDAY',   closeTime: { hours: 1, minutes: 0 } },
      { openDay: 'WEDNESDAY', openTime: { hours: 17, minutes: 0 }, closeDay: 'WEDNESDAY', closeTime: { hours: 1, minutes: 0 } },
      { openDay: 'THURSDAY',  openTime: { hours: 17, minutes: 0 }, closeDay: 'THURSDAY',  closeTime: { hours: 1, minutes: 0 } },
      { openDay: 'FRIDAY',    openTime: { hours: 17, minutes: 0 }, closeDay: 'FRIDAY',    closeTime: { hours: 2, minutes: 0 } },
      { openDay: 'SATURDAY',  openTime: { hours: 17, minutes: 0 }, closeDay: 'SATURDAY',  closeTime: { hours: 2, minutes: 0 } },
      { openDay: 'SUNDAY',    openTime: { hours: 17, minutes: 0 }, closeDay: 'SUNDAY',    closeTime: { hours: 1, minutes: 0 } },
    ],
  },
  primaryPhone: '(470) 546-4866',
  websiteUri: 'https://charcoalnchill.com',
  metadata: {
    placeId: 'ChIJi8-1ywdO9YgR9s5j-y0_1lI',
    mapsUri: 'https://maps.google.com/?cid=12345',
    newReviewUri: 'https://search.google.com/local/writereview?placeid=ChIJi8-1ywdO9YgR9s5j-y0_1lI',
  },
};

/**
 * Sprint 89 — GBP location with minimal data (no hours, no phone, no website).
 * Tests the mapper's null-handling paths.
 */
export const MOCK_GBP_LOCATION_MINIMAL: GBPLocation = {
  name: 'accounts/123456789/locations/111111111',
  title: 'Ghost Kitchen XYZ',
  storefrontAddress: {
    addressLines: ['456 Elm Street'],
    locality: 'Roswell',
    administrativeArea: 'GA',
    postalCode: '30075',
    regionCode: 'US',
  },
};

/**
 * Sprint 89 — GBP location with NO storefrontAddress (virtual business).
 */
export const MOCK_GBP_LOCATION_NO_ADDRESS: GBPLocation = {
  name: 'accounts/123456789/locations/222222222',
  title: 'Virtual Catering Co',
  primaryPhone: '(555) 000-1234',
  websiteUri: 'https://virtualcatering.example.com',
};

/**
 * Sprint 89 — GBP account fixture.
 */
export const MOCK_GBP_ACCOUNT: GBPAccount = {
  name: 'accounts/123456789',
  accountName: 'Aruna Surendera Babu',
  type: 'PERSONAL',
};

/**
 * Sprint 89 — Second GBP location for multi-location picker tests.
 */
export const MOCK_GBP_LOCATION_SECOND: GBPLocation = {
  name: 'accounts/123456789/locations/333333333',
  title: 'Charcoal N Chill - Downtown',
  storefrontAddress: {
    addressLines: ['200 Peachtree St NW'],
    locality: 'Atlanta',
    administrativeArea: 'GA',
    postalCode: '30303',
    regionCode: 'US',
  },
  regularHours: {
    periods: [
      { openDay: 'MONDAY',    openTime: { hours: 11, minutes: 30 }, closeDay: 'MONDAY',    closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'TUESDAY',   openTime: { hours: 11, minutes: 30 }, closeDay: 'TUESDAY',   closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'WEDNESDAY', openTime: { hours: 11, minutes: 30 }, closeDay: 'WEDNESDAY', closeTime: { hours: 22, minutes: 0 } },
      { openDay: 'THURSDAY',  openTime: { hours: 11, minutes: 30 }, closeDay: 'THURSDAY',  closeTime: { hours: 23, minutes: 0 } },
      { openDay: 'FRIDAY',    openTime: { hours: 11, minutes: 30 }, closeDay: 'FRIDAY',    closeTime: { hours: 0,  minutes: 0 } },
      { openDay: 'SATURDAY',  openTime: { hours: 10, minutes: 0 },  closeDay: 'SATURDAY',  closeTime: { hours: 0,  minutes: 0 } },
      { openDay: 'SUNDAY',    openTime: { hours: 10, minutes: 0 },  closeDay: 'SUNDAY',    closeTime: { hours: 21, minutes: 0 } },
    ],
  },
  primaryPhone: '(404) 555-9876',
  websiteUri: 'https://charcoalnchill.com/downtown',
  metadata: {
    placeId: 'ChIJtest_downtown_123',
  },
};

/**
 * Sprint 89 — Enhanced GBP location with openInfo, attributes, and categories.
 * Used by the /api/gbp/import re-sync endpoint tests.
 * Matches the extended GBPLocation interface in lib/types/gbp.ts.
 */
export const MOCK_GBP_LOCATION_ENRICHED: GBPLocation = {
  name: 'accounts/123456789/locations/987654321',
  title: 'Charcoal N Chill',
  storefrontAddress: {
    addressLines: ['11950 Jones Bridge Road', 'Ste 103'],
    locality: 'Alpharetta',
    administrativeArea: 'GA',
    postalCode: '30005',
    regionCode: 'US',
  },
  regularHours: {
    periods: [
      { openDay: 'TUESDAY',   openTime: { hours: 17, minutes: 0 }, closeDay: 'TUESDAY',   closeTime: { hours: 1, minutes: 0 } },
      { openDay: 'WEDNESDAY', openTime: { hours: 17, minutes: 0 }, closeDay: 'WEDNESDAY', closeTime: { hours: 1, minutes: 0 } },
      { openDay: 'THURSDAY',  openTime: { hours: 17, minutes: 0 }, closeDay: 'THURSDAY',  closeTime: { hours: 1, minutes: 0 } },
      { openDay: 'FRIDAY',    openTime: { hours: 17, minutes: 0 }, closeDay: 'FRIDAY',    closeTime: { hours: 2, minutes: 0 } },
      { openDay: 'SATURDAY',  openTime: { hours: 17, minutes: 0 }, closeDay: 'SATURDAY',  closeTime: { hours: 2, minutes: 0 } },
      { openDay: 'SUNDAY',    openTime: { hours: 17, minutes: 0 }, closeDay: 'SUNDAY',    closeTime: { hours: 1, minutes: 0 } },
    ],
  },
  primaryPhone: '(470) 546-4866',
  websiteUri: 'https://charcoalnchill.com',
  metadata: {
    placeId: 'ChIJi8-1ywdO9YgR9s5j-y0_1lI',
    mapsUri: 'https://maps.google.com/?cid=12345',
    newReviewUri: 'https://search.google.com/local/writereview?placeid=ChIJi8-1ywdO9YgR9s5j-y0_1lI',
  },
  openInfo: { status: 'OPEN' },
  attributes: [
    { attributeId: 'has_wifi',             values: [true] },
    { attributeId: 'has_outdoor_seating',  values: [true] },
    { attributeId: 'serves_alcohol',       values: [true] },
    { attributeId: 'has_live_music',       values: [true] },
    { attributeId: 'accepts_reservations', values: [true] },
    { attributeId: 'has_dine_in',          values: [true] },
  ],
  categories: {
    primaryCategory: { displayName: 'Hookah Bar' },
  },
};

/**
 * Sprint 89 — Expected MappedLocationData output for MOCK_GBP_LOCATION_ENRICHED.
 * Canonical expected output for enhanced mapper tests.
 */
export const MOCK_GBP_MAPPED: import('@/lib/gbp/gbp-data-mapper').MappedLocationData = {
  business_name: 'Charcoal N Chill',
  phone: '(470) 546-4866',
  website_url: 'https://charcoalnchill.com',
  address_line1: '11950 Jones Bridge Road, Ste 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  operational_status: 'open',
  hours_data: {
    monday:    'closed',
    tuesday:   { open: '17:00', close: '01:00' },
    wednesday: { open: '17:00', close: '01:00' },
    thursday:  { open: '17:00', close: '01:00' },
    friday:    { open: '17:00', close: '02:00' },
    saturday:  { open: '17:00', close: '02:00' },
    sunday:    { open: '17:00', close: '01:00' },
  },
  amenities: {
    wifi: true,
    outdoor_seating: true,
    alcohol: true,
    live_music: true,
    reservations: true,
    dine_in: true,
  },
  primary_category: 'Hookah Bar',
};

// ---------------------------------------------------------------------------
// Sprint 91: Onboarding Wizard Fixtures
// ---------------------------------------------------------------------------

/** Mock auto-seeded SOV queries (as returned from target_queries table) */
export const MOCK_WIZARD_QUERIES = [
  { id: 'q1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', query_text: 'best hookah bar in Alpharetta GA', query_category: 'discovery' },
  { id: 'q2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', query_text: 'hookah lounge near me Alpharetta', query_category: 'near_me' },
  { id: 'q3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', query_text: 'best place for date night Alpharetta', query_category: 'occasion' },
  { id: 'q4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', query_text: 'top hookah bar near Alpharetta', query_category: 'discovery' },
];

/** Mock competitor names for onboarding Step 3 */
export const MOCK_ONBOARDING_COMPETITORS = ['Cloud 9 Lounge', 'Krave Hookah Lounge'];

/** Mock org with onboarding NOT completed (for testing wizard flow) */
export const MOCK_ONBOARDING_ORG = {
  id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
  name: 'Incomplete Business',
  slug: 'incomplete-business',
  plan: 'trial' as const,
  plan_status: 'trialing' as const,
  onboarding_completed: false,
};

// ---------------------------------------------------------------------------
// Sprint 93 — Business Info Editor
// ---------------------------------------------------------------------------

/** Full location row shape as returned by fetchBusinessInfo for Settings page. */
export const MOCK_BUSINESS_INFO_LOCATION = {
  id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: GOLDEN_TENANT.location.name,
  business_name: GOLDEN_TENANT.location.business_name,
  phone: GOLDEN_TENANT.location.phone,
  website_url: GOLDEN_TENANT.location.website_url,
  address_line1: GOLDEN_TENANT.location.address_line1,
  city: GOLDEN_TENANT.location.city,
  state: GOLDEN_TENANT.location.state,
  zip: GOLDEN_TENANT.location.zip,
  hours_data: GOLDEN_TENANT.location.hours_data,
  amenities: GOLDEN_TENANT.location.amenities,
  categories: GOLDEN_TENANT.location.categories,
  operational_status: GOLDEN_TENANT.location.operational_status,
  gbp_synced_at: null,
  is_primary: true,
} as const;

// ---------------------------------------------------------------------------
// Sprint 94 — Publish Pipeline (WordPress + GBP Post)
// ---------------------------------------------------------------------------

import type { ContentDraftRow } from '@/lib/types/autopilot';
import type { WordPressConfig } from '@/lib/autopilot/publish-wordpress';

/** WordPress credentials as stored in location_integrations. */
export const MOCK_WP_CREDENTIALS: WordPressConfig = {
  siteUrl: 'https://charcoalnchill.com',
  username: 'admin',
  appPassword: 'AbCd EfGh IjKl MnOp QrSt',
};

/** Approved content draft targeting WordPress publish. */
export const MOCK_CONTENT_DRAFT_WP: ContentDraftRow = {
  id: 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  trigger_type: 'competitor_gap',
  trigger_id: null,
  draft_title: 'Why Charcoal N Chill is the Best Hookah Lounge in Alpharetta',
  draft_content:
    'Looking for the best hookah experience in Alpharetta? Charcoal N Chill offers premium hookah flavors, live entertainment, and an upscale atmosphere perfect for groups.\n\nOur signature charcoal-managed hookahs feature the finest imported tobaccos.',
  target_prompt: 'best hookah lounge alpharetta',
  content_type: 'blog_post',
  aeo_score: 78,
  status: 'approved',
  human_approved: true,
  published_url: null,
  published_at: null,
  approved_at: '2026-02-27T10:00:00Z',
  created_at: '2026-02-25T08:00:00Z',
  updated_at: '2026-02-27T10:00:00Z',
  target_keywords: [],
  rejection_reason: null,
  generation_notes: null,
};

/** Approved content draft targeting GBP Post publish. */
export const MOCK_CONTENT_DRAFT_GBP: ContentDraftRow = {
  id: 'f6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  trigger_type: 'occasion',
  trigger_id: null,
  draft_title: 'Friday Night Live: Belly Dancing & Afrobeats',
  draft_content:
    'Join us this Friday for live belly dancing performances and an Afrobeats DJ set. Open until 2 AM. Reservations recommended.',
  target_prompt: null,
  content_type: 'gbp_post',
  aeo_score: 65,
  status: 'approved',
  human_approved: true,
  published_url: null,
  published_at: null,
  approved_at: '2026-02-27T12:00:00Z',
  created_at: '2026-02-26T09:00:00Z',
  updated_at: '2026-02-27T12:00:00Z',
  target_keywords: [],
  rejection_reason: null,
  generation_notes: null,
};

// ---------------------------------------------------------------------------
// Sprint 95 — CSV Export + PDF Audit Report fixtures
// ---------------------------------------------------------------------------

/**
 * Sprint 95 — Canonical hallucination audit rows for CSV/PDF export tests.
 * Covers: high/medium/low/null risk, formula injection, null corrections,
 * multiple model providers.
 */
export const MOCK_HALLUCINATION_ROWS: HallucinationAuditRow[] = [
  {
    id: 'h0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    audit_id: null,
    model_provider: 'perplexity-sonar',
    claim_text: 'What time does Charcoal N Chill close on Friday?',
    expected_truth: 'Charcoal N Chill is open until 2 AM on Friday and Saturday.',
    severity: 'high',
    correction_status: 'open',
    category: 'hours',
    resolved_at: null,
    resolution_notes: null,
    first_detected_at: '2026-02-25T14:30:00Z',
    last_seen_at: '2026-02-25T14:30:00Z',
    occurrence_count: 3,
    propagation_events: null,
    detected_at: '2026-02-25T14:30:00Z',
    created_at: '2026-02-25T14:30:00Z',
    correction_query: null,
    verifying_since: null,
    follow_up_checked_at: null,
    follow_up_result: null,
  },
  {
    id: 'h1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    audit_id: null,
    model_provider: 'openai-gpt4o',
    claim_text: '=SUM(1,2)',
    expected_truth: null,
    severity: 'low',
    correction_status: 'fixed',
    category: null,
    resolved_at: '2026-02-24T12:00:00Z',
    resolution_notes: null,
    first_detected_at: '2026-02-24T10:00:00Z',
    last_seen_at: '2026-02-24T10:00:00Z',
    occurrence_count: 1,
    propagation_events: null,
    detected_at: '2026-02-24T10:00:00Z',
    created_at: '2026-02-24T10:00:00Z',
    correction_query: null,
    verifying_since: null,
    follow_up_checked_at: null,
    follow_up_result: null,
  },
  {
    id: 'h2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    audit_id: null,
    model_provider: 'google-gemini',
    claim_text: 'Charcoal N Chill serves sushi and ramen.',
    expected_truth: 'Charcoal N Chill serves Indian fusion cuisine, not sushi or ramen.',
    severity: 'medium',
    correction_status: 'open',
    category: 'menu',
    resolved_at: null,
    resolution_notes: null,
    first_detected_at: '2026-02-23T09:00:00Z',
    last_seen_at: '2026-02-23T09:00:00Z',
    occurrence_count: 2,
    propagation_events: null,
    detected_at: '2026-02-23T09:00:00Z',
    created_at: '2026-02-23T09:00:00Z',
    correction_query: null,
    verifying_since: null,
    follow_up_checked_at: null,
    follow_up_result: null,
  },
  {
    id: 'h3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    audit_id: null,
    model_provider: 'microsoft-copilot',
    claim_text: 'Charcoal N Chill does not take reservations.',
    expected_truth: null,
    severity: null,
    correction_status: 'dismissed',
    category: null,
    resolved_at: null,
    resolution_notes: null,
    first_detected_at: '2026-02-22T11:00:00Z',
    last_seen_at: '2026-02-22T11:00:00Z',
    occurrence_count: 1,
    propagation_events: null,
    detected_at: '2026-02-22T11:00:00Z',
    created_at: '2026-02-22T11:00:00Z',
    correction_query: null,
    verifying_since: null,
    follow_up_checked_at: null,
    follow_up_result: null,
  },
  {
    id: 'h4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    audit_id: null,
    model_provider: 'anthropic-claude',
    claim_text: 'Charcoal N Chill is located in downtown Atlanta.',
    expected_truth: 'Charcoal N Chill is located at 11950 Jones Bridge Road, Alpharetta, GA.',
    severity: 'high',
    correction_status: 'open',
    category: 'location',
    resolved_at: null,
    resolution_notes: null,
    first_detected_at: '2026-02-21T16:00:00Z',
    last_seen_at: '2026-02-21T16:00:00Z',
    occurrence_count: 5,
    propagation_events: null,
    detected_at: '2026-02-21T16:00:00Z',
    created_at: '2026-02-21T16:00:00Z',
    correction_query: null,
    verifying_since: null,
    follow_up_checked_at: null,
    follow_up_result: null,
  },
  {
    id: 'h5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    audit_id: null,
    model_provider: 'google-gemini',
    claim_text: 'Charcoal N Chill is open on Mondays.',
    expected_truth: 'Charcoal N Chill is closed on Mondays.',
    severity: 'low',
    correction_status: 'recurring',
    category: 'hours',
    resolved_at: null,
    resolution_notes: null,
    first_detected_at: '2026-02-20T08:00:00Z',
    last_seen_at: '2026-02-26T08:00:00Z',
    occurrence_count: 4,
    propagation_events: null,
    detected_at: '2026-02-20T08:00:00Z',
    created_at: '2026-02-20T08:00:00Z',
    correction_query: null,
    verifying_since: null,
    follow_up_checked_at: null,
    follow_up_result: null,
  },
];

/**
 * Sprint 95 — Pre-assembled audit report data for PDF template tests.
 */
export const MOCK_AUDIT_REPORT_DATA: AuditReportData = {
  org: { name: 'Charcoal N Chill', city: 'Alpharetta', state: 'GA', logoUrl: null },
  period: {
    start: '2025-12-01T00:00:00Z',
    end: '2026-02-28T23:59:59Z',
    generatedAt: '2026-02-28T12:00:00Z',
  },
  summary: {
    realityScore: 72,
    totalAudits: 247,
    hallucinationCount: 38,
    hallucinationRate: 15,
    byRisk: { high: 8, medium: 19, low: 11 },
    modelCount: 4,
  },
  modelBreakdown: [
    { model: 'ChatGPT (OpenAI)', audits: 62, hallucinations: 8, accuracy: 87 },
    { model: 'Perplexity', audits: 61, hallucinations: 12, accuracy: 80 },
    { model: 'Google Gemini', audits: 63, hallucinations: 10, accuracy: 84 },
    { model: 'Microsoft Copilot', audits: 61, hallucinations: 8, accuracy: 87 },
  ],
  topHallucinations: [
    {
      date: 'February 25, 2026',
      model: 'Perplexity',
      question: 'What time does Charcoal N Chill close on Friday?',
      aiResponse: 'Charcoal N Chill closes at 10 PM on Fridays.',
      correction: 'Charcoal N Chill is open until 2 AM on Friday and Saturday.',
      riskLevel: 'high',
    },
  ],
  sovRows: [
    {
      query: 'hookah lounge alpharetta',
      results: {
        'ChatGPT (OpenAI)': 'cited',
        'Perplexity': 'not_cited',
        'Google Gemini': 'cited',
        'Microsoft Copilot': 'cited',
      },
    },
  ],
  recommendations: [
    'Your Reality Score is 72/100. Address the 8 high-risk hallucinations to improve accuracy.',
    'Perplexity has not cited your business for any tracked queries. Allow PerplexityBot in your robots.txt and ensure your menu schema is published.',
    'Keep your business hours, menu, and amenities up to date to maintain high AI accuracy across all engines.',
  ],
};

// ---------------------------------------------------------------------------
// Sprint 100 — Multi-Location Management Fixtures
// ---------------------------------------------------------------------------

/**
 * Sprint 100 — Second location for multi-location testing (Agency tier).
 * Seed UUID: b1eebc99-... (b1 = second location under same org).
 */
export const MOCK_SECOND_LOCATION = {
  id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  business_name: 'Charcoal N Chill - Buckhead',
  display_name: 'Buckhead',
  address_line1: '3580 Piedmont Rd NE',
  city: 'Atlanta',
  state: 'GA',
  zip: '30305',
  phone: '(470) 555-1234',
  website_url: 'https://charcoalnchill.com/buckhead',
  operational_status: 'OPERATIONAL',
  is_primary: false,
  is_archived: false,
  timezone: 'America/New_York',
  location_order: 1,
  slug: 'buckhead',
} as const;

/**
 * Sprint 100 — Archived location for archive/filter tests.
 * Seed UUID: b2eebc99-... (b2 = archived location under same org).
 */
export const MOCK_ARCHIVED_LOCATION = {
  id: 'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  business_name: 'Charcoal N Chill - Midtown',
  display_name: 'Midtown (Closed)',
  address_line1: '1100 Peachtree St NE',
  city: 'Atlanta',
  state: 'GA',
  zip: '30309',
  phone: '(470) 555-5678',
  website_url: 'https://charcoalnchill.com/midtown',
  operational_status: 'CLOSED_PERMANENTLY',
  is_primary: false,
  is_archived: true,
  timezone: 'America/New_York',
  location_order: 2,
  slug: 'midtown',
} as const;

// ---------------------------------------------------------------------------
// Sprint E — Medical/Dental Golden Tenant
// Alpharetta Family Dental — a fictional but realistic dental practice
// Used for M5 vertical extension tests
// ---------------------------------------------------------------------------

/**
 * Sprint 103 — Benchmark row for Alpharetta (ready state: org_count >= 10).
 * Use this in tests that exercise the "ready" benchmark comparison state.
 */
export const MOCK_BENCHMARK_READY: import('@/lib/data/benchmarks').BenchmarkData = {
  city: 'Alpharetta',
  industry: 'Restaurant',
  org_count: 14,
  avg_score: 51.2,
  min_score: 22.5,
  max_score: 88.0,
  computed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

/**
 * Sprint 103 — Benchmark row for Alpharetta (collecting state: org_count < 10).
 * Use this in tests that exercise the "collecting" / not-enough-data state.
 */
export const MOCK_BENCHMARK_COLLECTING: import('@/lib/data/benchmarks').BenchmarkData = {
  city: 'Alpharetta',
  industry: 'Restaurant',
  org_count: 6,
  avg_score: 55.0,
  min_score: 30.0,
  max_score: 80.0,
  computed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
};

export const ALPHARETTA_FAMILY_DENTAL = {
  org: {
    id: 'fixture-org-dental-001',
    name: 'Alpharetta Family Dental',
    industry: 'medical_dental' as const,
    plan: 'growth' as const,
    created_at: '2026-01-15T00:00:00Z',
  },
  location: {
    name: 'Alpharetta Family Dental',
    specialty: 'General and Cosmetic Dentistry',
    phone: '+16785550199',
    website: 'https://alpharettafamilydental.example.com',
    address: {
      street: '1234 Windward Pkwy',
      city: 'Alpharetta',
      state: 'GA',
      zip: '30005',
    },
    lat: 34.0754,
    lng: -84.2941,
    hours: {
      monday: { open: '08:00', close: '17:00' },
      tuesday: { open: '08:00', close: '17:00' },
      wednesday: { open: '08:00', close: '17:00' },
      thursday: { open: '08:00', close: '17:00' },
      friday: { open: '08:00', close: '14:00' },
      saturday: { open: '09:00', close: '13:00' },
      sunday: { open: null, close: null },
    },
    services: [
      'Preventive Cleanings',
      'Teeth Whitening',
      'Porcelain Veneers',
      'Dental Implants',
      'Invisalign',
      'Emergency Dental Care',
    ],
    rating: { value: 4.8, count: 214 },
  },
  expectedSchema: {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: 'Alpharetta Family Dental',
    telephone: '+16785550199',
    url: 'https://alpharettafamilydental.example.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '1234 Windward Pkwy',
      addressLocality: 'Alpharetta',
      addressRegion: 'GA',
      postalCode: '30005',
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 34.0754,
      longitude: -84.2941,
    },
    medicalSpecialty: ['General and Cosmetic Dentistry'],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      reviewCount: 214,
      bestRating: 5,
      worstRating: 1,
    },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Sprint 105 — NAP Sync Engine fixtures
// ═══════════════════════════════════════════════════════════════════════════

/** Ground Truth — matches the golden tenant locations table seed data */
export const MOCK_GROUND_TRUTH: import('@/lib/nap-sync/types').GroundTruth = {
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Charcoal N Chill',
  address: '11950 Jones Bridge Road Ste 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  phone: '(470) 546-4866',
  website: 'https://charcoalnchill.com',
  operational_status: 'open',
};

/** GBP adapter result — no discrepancies (all fields match ground truth) */
export const MOCK_GBP_NAP_RESULT: import('@/lib/nap-sync/types').AdapterResult = {
  status: 'ok',
  platform: 'google',
  data: {
    name: 'Charcoal N Chill',
    address: '11950 Jones Bridge Road Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    phone: '(470) 546-4866',
    website: 'https://charcoalnchill.com',
    operational_status: 'open',
  },
  fetched_at: '2026-03-01T03:00:00.000Z',
};

/** Yelp adapter result — stale phone number (discrepancy) */
export const MOCK_YELP_NAP_RESULT: import('@/lib/nap-sync/types').AdapterResult = {
  status: 'ok',
  platform: 'yelp',
  data: {
    name: 'Charcoal N Chill',
    address: '11950 Jones Bridge Road Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    phone: '+14705559999',
    website: 'https://charcoalnchill.com',
  },
  fetched_at: '2026-03-01T03:00:00.000Z',
};

/** Apple Maps adapter result — unconfigured (no credentials in test env) */
export const MOCK_APPLE_MAPS_NAP_RESULT: import('@/lib/nap-sync/types').AdapterResult = {
  status: 'unconfigured',
  platform: 'apple_maps',
  reason: 'no_credentials',
};

/** Bing adapter result — not found (no confident address match) */
export const MOCK_BING_NAP_RESULT: import('@/lib/nap-sync/types').AdapterResult = {
  status: 'not_found',
  platform: 'bing',
};

// ═══════════════════════════════════════════════════════════════════════════
// Sprint 106 — Schema Expansion fixtures
// ═══════════════════════════════════════════════════════════════════════════

/** Ground Truth fixture for schema generators (reuses NAP Sync GroundTruth) */
export const MOCK_SCHEMA_GROUND_TRUTH: import('@/lib/nap-sync/types').GroundTruth = {
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Charcoal N Chill',
  address: '11950 Jones Bridge Road Ste 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  phone: '(470) 546-4866',
  website: 'https://charcoalnchill.com',
  hours_data: {
    monday: { open: '00:00', close: '00:00', closed: true },
    tuesday: { open: '17:00', close: '01:00', closed: false },
    wednesday: { open: '17:00', close: '01:00', closed: false },
    thursday: { open: '17:00', close: '01:00', closed: false },
    friday: { open: '17:00', close: '02:00', closed: false },
    saturday: { open: '17:00', close: '02:00', closed: false },
    sunday: { open: '17:00', close: '01:00', closed: false },
  },
};

/** Mock CrawledPage for homepage */
export const MOCK_CRAWLED_HOMEPAGE: import('@/lib/schema-expansion/types').CrawledPage = {
  url: 'https://charcoalnchill.com',
  page_type: 'homepage',
  title: 'Charcoal N Chill — Premium Hookah Lounge & Indo-American Restaurant | Alpharetta, GA',
  meta_description: 'Charcoal N Chill is Alpharetta\'s premier hookah lounge and Indo-American fusion restaurant.',
  h1: 'Alpharetta\'s #1 Hookah Lounge & Restaurant',
  body_excerpt: 'Welcome to Charcoal N Chill — the premier hookah lounge and Indo-American fusion restaurant in Alpharetta, Georgia. We offer premium shisha service with over 50 flavors, authentic Indian cuisine, and live entertainment including belly dancing shows every weekend.',
  detected_faqs: [],
  detected_events: [],
  crawled_at: '2026-03-01T04:00:00.000Z',
  http_status: 200,
};

/** Mock CrawledPage for FAQ page */
export const MOCK_CRAWLED_FAQ: import('@/lib/schema-expansion/types').CrawledPage = {
  url: 'https://charcoalnchill.com/faq',
  page_type: 'faq',
  title: 'Frequently Asked Questions | Charcoal N Chill',
  meta_description: 'Find answers to common questions about Charcoal N Chill hookah lounge.',
  h1: 'Frequently Asked Questions',
  body_excerpt: 'Q: What are your hookah flavors?\nA: We offer over 50 premium hookah flavors including fruit, mint, and specialty blends.\nQ: Do you take reservations?\nA: Yes, reservations are available via our website or by calling (470) 546-4866.',
  detected_faqs: [
    { question: 'What are your hookah flavors?', answer: 'We offer over 50 premium hookah flavors including fruit, mint, and specialty blends.' },
    { question: 'Do you take reservations?', answer: 'Yes, reservations are available via our website or by calling (470) 546-4866.' },
  ],
  detected_events: [],
  crawled_at: '2026-03-01T04:00:00.000Z',
  http_status: 200,
};

/** Mock CrawledPage for events page */
export const MOCK_CRAWLED_EVENTS: import('@/lib/schema-expansion/types').CrawledPage = {
  url: 'https://charcoalnchill.com/events',
  page_type: 'event',
  title: 'Events | Charcoal N Chill',
  meta_description: 'Live entertainment, themed nights, and belly dancing at Charcoal N Chill.',
  h1: 'Upcoming Events',
  body_excerpt: 'Every Friday: Belly Dancing Show at 9PM. Every Saturday: Afrobeats Night.',
  detected_faqs: [],
  detected_events: [
    { name: 'Belly Dancing Show', description: 'Live belly dancing performance every Friday at 9PM' },
    { name: 'Afrobeats Night', description: 'Saturday night Afrobeats themed DJ event' },
  ],
  crawled_at: '2026-03-01T04:00:00.000Z',
  http_status: 200,
};

/** Expected LocalBusiness schema output for homepage */
export const MOCK_EXPECTED_HOMEPAGE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BarOrPub',
  name: 'Charcoal N Chill',
  url: 'https://charcoalnchill.com',
  telephone: '(470) 546-4866',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '11950 Jones Bridge Road Ste 103',
    addressLocality: 'Alpharetta',
    addressRegion: 'GA',
    postalCode: '30005',
    addressCountry: 'US',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Sprint 107 — Review Intelligence Engine fixtures
// ═══════════════════════════════════════════════════════════════════════════

import type { Review, ReviewSentiment, BrandVoiceProfile } from '@/lib/review-engine/types';

export const MOCK_BRAND_VOICE: BrandVoiceProfile = {
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  tone: 'warm',
  formality: 'semi-formal',
  use_emojis: true,
  sign_off: '\u2014 The Charcoal N Chill Team',
  owner_name: 'Aruna',
  highlight_keywords: ['premium hookah', 'Indo-American fusion', 'live entertainment', 'belly dancing', 'Alpharetta'],
  avoid_phrases: ['unfortunately', 'sadly', 'we apologize for any inconvenience'],
  derived_from: 'hybrid',
  last_updated_at: '2026-03-01T00:00:00.000Z',
};

export const MOCK_POSITIVE_REVIEW: Review = {
  id: 'gbp_review_001',
  platform: 'google',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  reviewer_name: 'Marcus J.',
  rating: 5,
  text: 'Best hookah lounge in Alpharetta! The belly dancing show on Friday was incredible. Staff was super friendly and the Indo-American fusion food was delicious. Will definitely be back!',
  published_at: '2026-02-26T20:00:00.000Z',
};

export const MOCK_NEGATIVE_REVIEW: Review = {
  id: 'gbp_review_002',
  platform: 'google',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  reviewer_name: 'Priya K.',
  rating: 2,
  text: 'We waited 45 minutes for our hookah even though the place was not that busy. The hookah itself was okay but the service was really slow. Expected better for the price.',
  published_at: '2026-02-22T15:00:00.000Z',
};

export const MOCK_YELP_REVIEW: Review = {
  id: 'yelp_review_001',
  platform: 'yelp',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  reviewer_name: 'Sarah M.',
  rating: 4,
  text: 'Great atmosphere and the hookah flavors were amazing. Loved the Afrobeats night theme. Only complaint is parking can be tough on weekends.',
  published_at: '2026-02-19T18:00:00.000Z',
};

export const MOCK_POSITIVE_SENTIMENT: ReviewSentiment = {
  label: 'positive',
  score: 0.9,
  rating_band: 'high',
  keywords: ['best hookah', 'belly dancing', 'super friendly', 'delicious'],
  topics: [
    { category: 'hookah', sentiment: 'positive', mentions: ['best hookah'] },
    { category: 'events', sentiment: 'positive', mentions: ['belly dancing'] },
    { category: 'staff', sentiment: 'positive', mentions: ['super friendly'] },
    { category: 'food', sentiment: 'positive', mentions: ['delicious'] },
  ],
};

export const MOCK_NEGATIVE_SENTIMENT: ReviewSentiment = {
  label: 'negative',
  score: -0.6,
  rating_band: 'low',
  keywords: ['slow service', 'really slow'],
  topics: [
    { category: 'service', sentiment: 'negative', mentions: ['slow service', 'really slow'] },
  ],
};

// ---------------------------------------------------------------------------
// Sprint 86 — Autopilot Engine trigger fixtures
// ---------------------------------------------------------------------------

import type { DraftTrigger, AutopilotRunResult } from '@/lib/types/autopilot';

/** Competitor gap trigger — high-magnitude competitor intercept detected. */
export const MOCK_AUTOPILOT_TRIGGER_COMPETITOR_GAP: DraftTrigger = {
  triggerType: 'competitor_gap',
  triggerId: 'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  context: {
    targetQuery: 'Best hookah bar in Alpharetta GA',
    competitorName: 'Cloud 9 Lounge',
    winningFactor: '15 more review mentions of "late night" atmosphere',
  },
};

/** Prompt missing trigger — zero-citation cluster in "food" category. */
export const MOCK_AUTOPILOT_TRIGGER_PROMPT_MISSING: DraftTrigger = {
  triggerType: 'prompt_missing',
  triggerId: null,
  orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  context: {
    targetQuery: 'food — 3 zero-citation queries',
    zeroCitationQueries: [
      'best indian food alpharetta',
      'fusion restaurant near me alpharetta',
      'indian cuisine alpharetta ga',
    ],
    consecutiveZeroWeeks: 4,
  },
};

/** Review gap trigger — recurring negative keyword "slow service". */
export const MOCK_AUTOPILOT_TRIGGER_REVIEW_GAP: DraftTrigger = {
  triggerType: 'review_gap',
  triggerId: null,
  orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  context: {
    topNegativeKeywords: ['slow service', 'wait time', 'took forever'],
    negativeReviewCount: 5,
    unansweredNegativeCount: 3,
  },
};

/** Schema gap trigger — low schema health score with missing page types. */
export const MOCK_AUTOPILOT_TRIGGER_SCHEMA_GAP: DraftTrigger = {
  triggerType: 'schema_gap',
  triggerId: null,
  orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  context: {
    schemaHealthScore: 45,
    missingPageTypes: ['faq', 'about'],
    topMissingImpact: 'FAQ page missing — 30% of AI models check FAQ for business details',
  },
};

/** Successful autopilot run result fixture. */
export const MOCK_AUTOPILOT_RUN_RESULT: AutopilotRunResult = {
  orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  draftsCreated: 3,
  draftsSkippedDedup: 1,
  draftsSkippedLimit: 0,
  errors: [],
  runAt: '2026-02-28T02:00:00Z',
};

/** Content draft with review_gap trigger for autopilot tests. */
export const MOCK_CONTENT_DRAFT_REVIEW_GAP: ContentDraftRow = {
  id: 'f7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  trigger_type: 'review_gap',
  trigger_id: null,
  draft_title: 'Addressing Service Speed: Our Commitment to Better Dining Experience',
  draft_content:
    'We have heard your feedback about wait times and are taking action. Our team is now implementing a new table management system to reduce wait times during peak hours.',
  target_prompt: 'slow service restaurant response',
  content_type: 'blog_post',
  aeo_score: 72,
  status: 'draft',
  human_approved: false,
  published_url: null,
  published_at: null,
  approved_at: null,
  created_at: '2026-02-28T09:00:00Z',
  updated_at: '2026-02-28T09:00:00Z',
  target_keywords: ['slow service', 'wait time'],
  rejection_reason: null,
  generation_notes: null,
};

/** Content draft with schema_gap trigger for autopilot tests. */
export const MOCK_CONTENT_DRAFT_SCHEMA_GAP: ContentDraftRow = {
  id: 'f8eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  trigger_type: 'schema_gap',
  trigger_id: null,
  draft_title: 'Frequently Asked Questions — Charcoal N Chill',
  draft_content:
    'Find answers to common questions about Charcoal N Chill, including hours, reservations, menu options, and our hookah lounge experience.',
  target_prompt: 'charcoal n chill faq',
  content_type: 'faq_page',
  aeo_score: 85,
  status: 'draft',
  human_approved: false,
  published_url: null,
  published_at: null,
  approved_at: null,
  created_at: '2026-02-28T09:30:00Z',
  updated_at: '2026-02-28T09:30:00Z',
  target_keywords: ['faq', 'schema'],
  rejection_reason: null,
  generation_notes: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// Sprint 108 — Semantic Authority Mapping fixtures
// ═══════════════════════════════════════════════════════════════════════════

import type {
  CitationSource,
  SameAsGap,
  AuthorityDimensions,
  EntityAuthorityProfile,
  AuthoritySnapshot,
} from '@/lib/authority/types';

export const MOCK_CITATION_SOURCES: CitationSource[] = [
  {
    url: 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta',
    domain: 'yelp.com',
    tier: 'tier2',
    source_type: 'yelp',
    snippet: 'Charcoal N Chill: Premium hookah lounge in Alpharetta, GA. 163 reviews.',
    detected_at: '2026-03-01T05:00:00.000Z',
    sentiment: 'positive',
    is_sameas_candidate: true,
  },
  {
    url: 'https://www.reddit.com/r/atlanta/comments/hookah_alpharetta',
    domain: 'reddit.com',
    tier: 'tier2',
    source_type: 'reddit',
    snippet: 'Best hookah spots near Alpharetta? Charcoal N Chill mentioned 3 times.',
    detected_at: '2026-03-01T05:00:00.000Z',
    sentiment: 'positive',
    is_sameas_candidate: false,
  },
  {
    url: 'https://www.bestrestaurantsalpharetta.com/hookah',
    domain: 'bestrestaurantsalpharetta.com',
    tier: 'tier3',
    source_type: 'aggregator_blog',
    snippet: 'Top 5 Hookah Lounges in Alpharetta — #2: Charcoal N Chill.',
    detected_at: '2026-03-01T05:00:00.000Z',
    sentiment: 'positive',
    is_sameas_candidate: false,
  },
  {
    url: 'https://www.facebook.com/charcoalnchill',
    domain: 'facebook.com',
    tier: 'tier2',
    source_type: 'facebook',
    snippet: 'Charcoal N Chill hookah lounge and Indo-American fusion restaurant in Alpharetta',
    detected_at: '2026-03-01T05:00:00.000Z',
    sentiment: 'neutral',
    is_sameas_candidate: true,
  },
  {
    url: 'https://maps.google.com/?cid=527487414899304357',
    domain: 'google.com',
    tier: 'tier2',
    source_type: 'google_maps',
    snippet: 'Charcoal N Chill · Hookah bar · 11950 Jones Bridge Rd, Alpharetta',
    detected_at: '2026-03-01T05:00:00.000Z',
    sentiment: 'positive',
    is_sameas_candidate: true,
  },
];

export const MOCK_SAMEAS_GAPS: SameAsGap[] = [
  {
    url: '',
    platform: 'wikidata',
    tier: 'tier2',
    estimated_impact: 'high',
    action_label: 'Create a Wikidata entity for Charcoal N Chill',
    action_instructions: 'Go to wikidata.org and create a new item for Charcoal N Chill as a hookah lounge.',
    already_in_schema: false,
  },
  {
    url: '',
    platform: 'tripadvisor',
    tier: 'tier2',
    estimated_impact: 'high',
    action_label: 'Claim your TripAdvisor listing',
    action_instructions: 'Visit tripadvisor.com/owners and search for Charcoal N Chill to claim your listing.',
    already_in_schema: false,
  },
];

export const MOCK_AUTHORITY_DIMENSIONS: AuthorityDimensions = {
  tier1_citation_score: 0,
  tier2_coverage_score: 15,
  platform_breadth_score: 12,
  sameas_score: 9,
  velocity_score: 5,
};

export const MOCK_AUTHORITY_PROFILE: EntityAuthorityProfile = {
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  entity_authority_score: 58,
  dimensions: MOCK_AUTHORITY_DIMENSIONS,
  tier_breakdown: { tier1: 0, tier2: 3, tier3: 4, unknown: 0 },
  top_citations: MOCK_CITATION_SOURCES.slice(0, 3),
  sameas_gaps: MOCK_SAMEAS_GAPS,
  citation_velocity: null,
  velocity_label: 'unknown',
  recommendations: [],
  snapshot_at: '2026-03-01T05:00:00.000Z',
};

export const MOCK_AUTHORITY_SNAPSHOTS: AuthoritySnapshot[] = [
  {
    id: 'snap-001',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    entity_authority_score: 52,
    tier_breakdown: { tier1: 0, tier2: 2, tier3: 3 },
    total_citations: 5,
    sameas_count: 2,
    snapshot_month: '2026-01',
    created_at: '2026-01-01T05:00:00Z',
  },
  {
    id: 'snap-002',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    entity_authority_score: 55,
    tier_breakdown: { tier1: 0, tier2: 3, tier3: 3 },
    total_citations: 6,
    sameas_count: 3,
    snapshot_month: '2026-02',
    created_at: '2026-02-01T05:00:00Z',
  },
];

// ── Sprint 109: VAIO — Voice & Conversational AI Optimization ──────────────

import type {
  VoiceQuery,
  VoiceContentScore,
  SpokenAnswerPreview,
  LlmsTxtContent,
  AICrawlerAuditResult,
  VAIOProfile,
} from '@/lib/vaio/types';

export const MOCK_VOICE_QUERIES: VoiceQuery[] = [
  {
    id: 'vq-001',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query_text: 'Hey Google, where can I get hookah near me?',
    query_category: 'near_me',
    query_mode: 'voice',
    is_system_seeded: true,
    is_active: true,
    citation_rate: 0.45,
    last_run_at: '2026-03-01T06:00:00Z',
  },
  {
    id: 'vq-002',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query_text: 'What are the best hookah lounges in Alpharetta?',
    query_category: 'discovery',
    query_mode: 'voice',
    is_system_seeded: true,
    is_active: true,
    citation_rate: 0.6,
    last_run_at: '2026-03-01T06:00:00Z',
  },
  {
    id: 'vq-003',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query_text: 'Is Charcoal N Chill open right now?',
    query_category: 'action',
    query_mode: 'voice',
    is_system_seeded: true,
    is_active: true,
    citation_rate: 0.0,
    last_run_at: '2026-03-01T06:00:00Z',
  },
  {
    id: 'vq-004',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query_text: 'Book a table at Charcoal N Chill',
    query_category: 'action',
    query_mode: 'voice',
    is_system_seeded: true,
    is_active: true,
    citation_rate: 0.0,
    last_run_at: '2026-03-01T06:00:00Z',
  },
  {
    id: 'vq-005',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query_text: 'Compare hookah places in Alpharetta',
    query_category: 'comparison',
    query_mode: 'voice',
    is_system_seeded: true,
    is_active: true,
    citation_rate: 0.3,
    last_run_at: '2026-03-01T06:00:00Z',
  },
  {
    id: 'vq-006',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query_text: 'What flavors does Charcoal N Chill have?',
    query_category: 'information',
    query_mode: 'voice',
    is_system_seeded: true,
    is_active: true,
    citation_rate: 0.0,
    last_run_at: '2026-03-01T06:00:00Z',
  },
  {
    id: 'vq-007',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query_text: 'Does Charcoal N Chill have outdoor seating?',
    query_category: 'information',
    query_mode: 'voice',
    is_system_seeded: true,
    is_active: true,
    citation_rate: 0.0,
    last_run_at: '2026-03-01T06:00:00Z',
  },
  {
    id: 'vq-008',
    location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    query_text: 'How much is hookah at Charcoal N Chill?',
    query_category: 'information',
    query_mode: 'voice',
    is_system_seeded: true,
    is_active: true,
    citation_rate: 0.15,
    last_run_at: '2026-03-01T06:00:00Z',
  },
];

export const MOCK_VOICE_CONTENT_SCORE: VoiceContentScore = {
  total: 68,
  direct_answer: 22,
  local_specificity: 18,
  action_language: 15,
  spoken_length: 13,
  issues: [
    { type: 'low_action_language', severity: 'warning', message: 'Content lacks action verbs for voice commands' },
    { type: 'too_long', severity: 'info', message: 'Content exceeds ideal spoken length (150 words)' },
  ],
};

export const MOCK_SPOKEN_PREVIEW: SpokenAnswerPreview = {
  cleaned_text: 'Charcoal N Chill is a hookah lounge and Mediterranean restaurant located at 11950 Jones Bridge Road Suite 103 in Alpharetta Georgia. They offer specialty hookahs, Mediterranean small plates, and craft cocktails. Open Monday through Thursday from 4 PM to midnight, and Friday through Sunday from 2 PM to 2 AM. Call them at 678-555-0199 to reserve a table.',
  word_count: 55,
  estimated_seconds: 22,
  voice_ready: true,
  score: MOCK_VOICE_CONTENT_SCORE,
};

export const MOCK_LLMS_TXT: LlmsTxtContent = {
  standard: '# Charcoal N Chill\n> Hookah lounge and Mediterranean restaurant in Alpharetta, GA\n\n## Location\n11950 Jones Bridge Road Ste 103, Alpharetta, GA 30005\n\n## Hours\nMonday–Thursday: 4 PM – 12 AM\nFriday–Sunday: 2 PM – 2 AM\n\n## Contact\nPhone: (678) 555-0199',
  full: '# Charcoal N Chill\n> Hookah lounge and Mediterranean restaurant in Alpharetta, GA\n\n## Location\n11950 Jones Bridge Road Ste 103, Alpharetta, GA 30005\n\n## Hours\nMonday–Thursday: 4 PM – 12 AM\nFriday–Sunday: 2 PM – 2 AM\n\n## Contact\nPhone: (678) 555-0199\n\n## Menu Highlights\nSpecialty hookahs, Mediterranean small plates, craft cocktails\n\n## What Customers Say\nGreat atmosphere, excellent hookah selection, friendly staff',
  generated_at: '2026-03-01T06:00:00Z',
  version: '1.0',
};

export const MOCK_CRAWLER_AUDIT: AICrawlerAuditResult = {
  crawlers_checked: 10,
  allowed: 6,
  blocked: 2,
  not_specified: 2,
  health_pct: 60,
  details: [
    { name: 'GPTBot', user_agent: 'GPTBot', used_by: 'ChatGPT + SearchGPT', impact: 'critical', status: 'allowed' },
    { name: 'PerplexityBot', user_agent: 'PerplexityBot', used_by: 'Perplexity AI', impact: 'critical', status: 'allowed' },
    { name: 'Google-Extended', user_agent: 'Google-Extended', used_by: 'Gemini + AI Overviews', impact: 'critical', status: 'allowed' },
    { name: 'ClaudeBot', user_agent: 'ClaudeBot', used_by: 'Claude.ai', impact: 'high', status: 'allowed' },
    { name: 'anthropic-ai', user_agent: 'anthropic-ai', used_by: 'Claude API training', impact: 'medium', status: 'blocked' },
    { name: 'ChatGPT-User', user_agent: 'ChatGPT-User', used_by: 'ChatGPT live browsing', impact: 'high', status: 'allowed' },
    { name: 'OAI-SearchBot', user_agent: 'OAI-SearchBot', used_by: 'SearchGPT', impact: 'high', status: 'allowed' },
    { name: 'Applebot-Extended', user_agent: 'Applebot-Extended', used_by: 'Apple Intelligence + Siri', impact: 'high', status: 'not_specified' },
    { name: 'Amazonbot', user_agent: 'Amazonbot', used_by: 'Alexa Answers', impact: 'medium', status: 'not_specified' },
    { name: 'Bytespider', user_agent: 'Bytespider', used_by: 'TikTok AI features', impact: 'low', status: 'blocked' },
  ],
};

export const MOCK_VAIO_PROFILE: VAIOProfile = {
  id: 'vaio-001',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  voice_readiness_score: 48,
  llms_txt_standard: MOCK_LLMS_TXT.standard,
  llms_txt_full: MOCK_LLMS_TXT.full,
  llms_txt_generated_at: '2026-03-01T06:00:00Z',
  llms_txt_status: 'generated',
  crawler_audit: MOCK_CRAWLER_AUDIT,
  voice_query_stats: {
    total_voice_queries: 8,
    with_citation: 3,
    zero_citation: 5,
    avg_citation_rate: 0.375,
  },
  gaps: [
    { category: 'action', query_count: 2, zero_citation_count: 2, consecutive_zero_weeks: 3 },
  ],
  issues: [
    { type: 'low_action_language', severity: 'warning', message: 'Content lacks action verbs for voice commands' },
  ],
  last_run_at: '2026-03-01T06:00:00Z',
  created_at: '2026-03-01T06:00:00Z',
  updated_at: '2026-03-01T06:00:00Z',
};

// ── Sprint 110: AI Answer Simulation Sandbox ──────────────────────────────

import type {
  SandboxGroundTruth,
  SimulationRun,
  IngestionResult,
  QuerySimulationResult,
  GapAnalysisResult,
} from '@/lib/sandbox/types';

export const MOCK_SANDBOX_GROUND_TRUTH: SandboxGroundTruth = {
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Charcoal N Chill',
  phone: '(470) 546-4866',
  address: '11950 Jones Bridge Road Ste 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  website: 'https://charcoalnchill.com',
  category: 'hookah lounge',
  hours: 'tuesday: 17:00-01:00, wednesday: 17:00-01:00, thursday: 17:00-01:00, friday: 17:00-02:00, saturday: 17:00-02:00',
  hours_data: {
    tuesday: { open: '17:00', close: '01:00' },
    wednesday: { open: '17:00', close: '01:00' },
    thursday: { open: '17:00', close: '01:00' },
    friday: { open: '17:00', close: '02:00' },
    saturday: { open: '17:00', close: '02:00' },
  },
  description: null,
  amenities: ['outdoor seating', 'alcohol', 'hookah', 'live music', 'private rooms'],
};

export const MOCK_INGESTION_RESULT: IngestionResult = {
  extracted_facts: [
    { field: 'name', extracted_value: 'Charcoal N Chill', ground_truth_value: 'Charcoal N Chill', match_status: 'exact', confidence: 'high' },
    { field: 'phone', extracted_value: '(470) 546-4866', ground_truth_value: '(470) 546-4866', match_status: 'exact', confidence: 'high' },
    { field: 'address', extracted_value: '11950 Jones Bridge Road Ste 103', ground_truth_value: '11950 Jones Bridge Road Ste 103', match_status: 'exact', confidence: 'high' },
    { field: 'city', extracted_value: 'Alpharetta', ground_truth_value: 'Alpharetta', match_status: 'exact', confidence: 'high' },
    { field: 'category', extracted_value: 'hookah lounge', ground_truth_value: 'hookah lounge', match_status: 'exact', confidence: 'high' },
    { field: 'hours', extracted_value: 'Tue-Thu 5PM-1AM, Fri-Sat 5PM-2AM', ground_truth_value: 'Tue-Thu 5PM-1AM, Fri-Sat 5PM-2AM', match_status: 'exact', confidence: 'high' },
    { field: 'website', extracted_value: '', ground_truth_value: 'https://charcoalnchill.com', match_status: 'missing', confidence: 'low' },
  ],
  accuracy_score: 82,
  facts_correct: 6,
  facts_incorrect: 0,
  facts_missing: 1,
  critical_errors: [],
  warnings: [{ field: 'website', severity: 'warning', extracted: '', expected: 'https://charcoalnchill.com', message: 'website not found in content' }],
};

export const MOCK_QUERY_SIMULATION_RESULTS: QuerySimulationResult[] = [
  {
    query_id: 'q-001',
    query_text: 'Best hookah lounge in Alpharetta?',
    query_category: 'discovery',
    simulated_answer: 'Charcoal N Chill is a hookah lounge in Alpharetta offering premium hookah and Mediterranean cuisine.',
    answer_quality: 'complete',
    cites_business: true,
    facts_present: ['name', 'city', 'category'],
    facts_hallucinated: [],
    word_count: 17,
    ground_truth_alignment: 85,
  },
  {
    query_id: 'q-002',
    query_text: 'How to book a private event at CNC?',
    query_category: 'action',
    simulated_answer: 'The content does not provide information about private events.',
    answer_quality: 'no_answer',
    cites_business: false,
    facts_present: [],
    facts_hallucinated: [],
    word_count: 10,
    ground_truth_alignment: 0,
  },
];

export const MOCK_GAP_ANALYSIS: GapAnalysisResult = {
  total_queries_tested: 2,
  queries_with_no_answer: 1,
  queries_with_partial_answer: 0,
  queries_with_complete_answer: 1,
  gap_clusters: [
    { category: 'action', total_queries: 1, answered_queries: 0, unanswered_queries: 1, gap_severity: 'critical', example_unanswered: 'How to book a private event at CNC?' },
  ],
  highest_risk_queries: ['How to book a private event at CNC?'],
  recommended_additions: [
    { priority: 2, field: 'general', suggestion: 'Add booking or reservation instructions.', closes_queries: ['How to book a private event at CNC?'] },
  ],
};

export const MOCK_SIMULATION_RUN: SimulationRun = {
  id: 'sim-001',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  content_source: 'freeform',
  draft_id: null,
  content_text: 'Charcoal N Chill is a hookah lounge in Alpharetta, GA...',
  content_word_count: 52,
  modes_run: ['ingestion', 'query', 'gap_analysis'],
  ingestion_result: MOCK_INGESTION_RESULT,
  query_results: MOCK_QUERY_SIMULATION_RESULTS,
  gap_analysis: MOCK_GAP_ANALYSIS,
  simulation_score: 68,
  ingestion_accuracy: 82,
  query_coverage_rate: 0.5,
  hallucination_risk: 'medium',
  run_at: '2026-03-01T10:00:00Z',
  claude_model: 'claude-sonnet-4-20250514',
  input_tokens_used: 1250,
  output_tokens_used: 480,
  status: 'completed',
  errors: [],
};

// ---------------------------------------------------------------------------
// Sprint 111 — Membership Fixtures
// ---------------------------------------------------------------------------

import type { OrgMember, MembershipContext, MemberRole } from '@/lib/membership/types';
import { ROLE_PERMISSIONS } from '@/lib/membership/types';

export const GOLDEN_MEMBER_ID = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
export const GOLDEN_MEMBER_ROLE: MemberRole = 'owner';

export const MOCK_ORG_MEMBER_OWNER: OrgMember = {
  id: GOLDEN_MEMBER_ID,
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  user_id: '00000000-0000-0000-0000-000000000002',
  role: 'owner',
  joined_at: '2026-01-01T00:00:00.000Z',
  email: 'dev@localvector.ai',
  full_name: 'Dev User',
};

export const MOCK_ORG_MEMBER_ADMIN: OrgMember = {
  id: 'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  user_id: 'e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  role: 'admin',
  joined_at: '2026-02-01T00:00:00.000Z',
  email: 'admin@charcoalnchill.com',
  full_name: 'Test Admin',
};

export const MOCK_ORG_MEMBER_ANALYST: OrgMember = {
  id: 'e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  user_id: 'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  role: 'analyst',
  joined_at: '2026-02-15T00:00:00.000Z',
  email: 'analyst@charcoalnchill.com',
  full_name: 'Test Analyst',
};

export const MOCK_MEMBERSHIP_CONTEXT_OWNER: MembershipContext = {
  member_id: GOLDEN_MEMBER_ID,
  user_id: '00000000-0000-0000-0000-000000000002',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  role: 'owner',
  permissions: ROLE_PERMISSIONS.owner,
};

export const MOCK_MEMBERS_LIST: OrgMember[] = [
  MOCK_ORG_MEMBER_OWNER,
  MOCK_ORG_MEMBER_ADMIN,
  MOCK_ORG_MEMBER_ANALYST,
];

// ---------------------------------------------------------------------------
// Sprint 112 — Invitation Fixtures
// ---------------------------------------------------------------------------

import type {
  OrgInvitationSafe,
  OrgInvitationDisplay,
  InvitationValidation,
} from '@/lib/invitations/types';

export const MOCK_INVITATION_TOKEN =
  'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222';

export const MOCK_ORG_INVITATION_SAFE: OrgInvitationSafe = {
  id: 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  email: 'newmember@example.com',
  role: 'analyst',
  invited_by: '00000000-0000-0000-0000-000000000002',
  status: 'pending',
  expires_at: '2026-03-08T00:00:00.000Z',
  accepted_at: null,
  created_at: '2026-03-01T00:00:00.000Z',
};

export const MOCK_ORG_INVITATION_DISPLAY: OrgInvitationDisplay = {
  ...MOCK_ORG_INVITATION_SAFE,
  org_name: 'Charcoal N Chill',
  invited_by_name: 'Dev User',
};

export const MOCK_INVITATION_VALIDATION_NEW_USER: InvitationValidation = {
  valid: true,
  invitation: MOCK_ORG_INVITATION_DISPLAY,
  error: null,
  existing_user: false,
};

export const MOCK_INVITATION_VALIDATION_EXISTING_USER: InvitationValidation = {
  valid: true,
  invitation: MOCK_ORG_INVITATION_DISPLAY,
  error: null,
  existing_user: true,
};

export const MOCK_INVITATION_VALIDATION_EXPIRED: InvitationValidation = {
  valid: false,
  invitation: null,
  error: 'expired',
  existing_user: false,
};

// ---------------------------------------------------------------------------
// Sprint 113 — Billing + Audit Log Fixtures
// ---------------------------------------------------------------------------

import type { SeatState, ActivityLogEntry, ActivityLogPage } from '@/lib/billing/types';

export const MOCK_SEAT_STATE_AGENCY: SeatState = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  plan_tier: 'agency',
  current_seat_count: 3,
  max_seats: 10,
  usage_percent: 30,
  stripe_subscription_id: 'sub_mock_agency_001',
  stripe_quantity: 3,
  in_sync: true,
  monthly_seat_cost_cents: 3000,
  per_seat_price_cents: 1500,
};

export const MOCK_SEAT_STATE_OUT_OF_SYNC: SeatState = {
  ...MOCK_SEAT_STATE_AGENCY,
  stripe_quantity: 2,
  in_sync: false,
};

export const MOCK_SEAT_STATE_GROWTH: SeatState = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  plan_tier: 'growth',
  current_seat_count: 1,
  max_seats: 1,
  usage_percent: 100,
  stripe_subscription_id: null,
  stripe_quantity: null,
  in_sync: true,
  monthly_seat_cost_cents: 0,
  per_seat_price_cents: 0,
};

export const MOCK_ACTIVITY_LOG_ENTRIES: ActivityLogEntry[] = [
  {
    id: 'log-001',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    event_type: 'member_invited',
    actor_user_id: 'golden-user-id',
    actor_email: 'aruna@charcoalnchill.com',
    target_user_id: null,
    target_email: 'newmember@example.com',
    target_role: 'analyst',
    metadata: { invitation_id: 'inv-seed-001' },
    created_at: '2026-03-01T23:00:00.000Z',
  },
  {
    id: 'log-002',
    org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    event_type: 'seat_sync',
    actor_user_id: null,
    actor_email: null,
    target_user_id: null,
    target_email: 'system',
    target_role: null,
    metadata: { success: true, source: 'seed', previous_count: 0, new_count: 1 },
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

export const MOCK_ACTIVITY_LOG_PAGE: ActivityLogPage = {
  entries: MOCK_ACTIVITY_LOG_ENTRIES,
  total: 2,
  page: 1,
  per_page: 20,
  has_more: false,
};

// ---------------------------------------------------------------------------
// Sprint 114 — White-Label Domain Fixtures
// ---------------------------------------------------------------------------

import type { OrgDomain, DomainConfig, OrgContext as WhitelabelOrgContext } from '@/lib/whitelabel/types';

export const MOCK_ORG_DOMAIN_SUBDOMAIN: OrgDomain = {
  id: 'domain-sub-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  domain_type: 'subdomain',
  domain_value: 'charcoal-n-chill.localvector.ai',
  verification_token: 'localvector-verify=subdomain-auto-verified',
  verification_status: 'verified',
  verified_at: '2026-01-01T00:00:00.000Z',
  last_checked_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

export const MOCK_ORG_DOMAIN_CUSTOM_UNVERIFIED: OrgDomain = {
  id: 'domain-cust-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  domain_type: 'custom',
  domain_value: 'app.charcoalnchill.com',
  verification_token: 'localvector-verify=seed1234567890abcdef1234567890ab',
  verification_status: 'unverified',
  verified_at: null,
  last_checked_at: null,
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
};

export const MOCK_ORG_DOMAIN_CUSTOM_VERIFIED: OrgDomain = {
  ...MOCK_ORG_DOMAIN_CUSTOM_UNVERIFIED,
  verification_status: 'verified',
  verified_at: '2026-03-01T12:00:00.000Z',
  last_checked_at: '2026-03-01T12:00:00.000Z',
};

export const MOCK_DOMAIN_CONFIG_UNVERIFIED: DomainConfig = {
  effective_domain: 'charcoal-n-chill.localvector.ai',
  subdomain: 'charcoal-n-chill',
  custom_domain: MOCK_ORG_DOMAIN_CUSTOM_UNVERIFIED,
  subdomain_domain: MOCK_ORG_DOMAIN_SUBDOMAIN,
};

export const MOCK_DOMAIN_CONFIG_VERIFIED: DomainConfig = {
  effective_domain: 'app.charcoalnchill.com',
  subdomain: 'charcoal-n-chill',
  custom_domain: MOCK_ORG_DOMAIN_CUSTOM_VERIFIED,
  subdomain_domain: MOCK_ORG_DOMAIN_SUBDOMAIN,
};

export const MOCK_ORG_CONTEXT_SUBDOMAIN: WhitelabelOrgContext = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_name: 'Charcoal N Chill',
  plan_tier: 'agency',
  resolved_hostname: 'charcoal-n-chill.localvector.ai',
  is_custom_domain: false,
};

export const MOCK_ORG_CONTEXT_CUSTOM: WhitelabelOrgContext = {
  ...MOCK_ORG_CONTEXT_SUBDOMAIN,
  resolved_hostname: 'app.charcoalnchill.com',
  is_custom_domain: true,
};

// ---------------------------------------------------------------------------
// Sprint 115 — White-Label Theme Fixtures
// ---------------------------------------------------------------------------

import type { OrgTheme, ThemeCssProps } from '@/lib/whitelabel/types';

export const MOCK_ORG_THEME: OrgTheme = {
  id: 'theme-golden-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  primary_color: '#1a1a2e',
  accent_color: '#e94560',
  text_on_primary: '#ffffff',
  font_family: 'Poppins',
  logo_url: null,
  logo_storage_path: null,
  show_powered_by: true,
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
};

export const MOCK_ORG_THEME_WITH_LOGO: OrgTheme = {
  ...MOCK_ORG_THEME,
  logo_url: 'https://supabase.example.com/storage/v1/object/public/org-logos/a0eebc99/logo.png',
  logo_storage_path: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/logo.png',
};

export const MOCK_THEME_CSS_PROPS: ThemeCssProps = {
  '--brand-primary': '#1a1a2e',
  '--brand-accent': '#e94560',
  '--brand-text-on-primary': '#ffffff',
  '--brand-font-family': "'Poppins', Inter, system-ui, sans-serif",
};

export const MOCK_ORG_THEME_DEFAULT: OrgTheme = {
  id: 'default',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  primary_color: '#6366f1',
  accent_color: '#8b5cf6',
  text_on_primary: '#ffffff',
  font_family: 'Inter',
  logo_url: null,
  logo_storage_path: null,
  show_powered_by: true,
  created_at: '2026-03-01T00:00:00.000Z',
  updated_at: '2026-03-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Sprint 116 — Supabase Realtime Fixtures
// ---------------------------------------------------------------------------

import type { PresenceUser, DraftLock, RealtimeNotification } from '@/lib/realtime/types';

export const MOCK_PRESENCE_USER_OWNER: PresenceUser = {
  user_id: 'golden-user-id',
  email: 'aruna@charcoalnchill.com',
  full_name: 'Aruna Babu',
  role: 'owner',
  current_page: '/dashboard',
  online_at: '2026-03-01T10:00:00.000Z',
};

export const MOCK_PRESENCE_USER_ADMIN: PresenceUser = {
  user_id: 'mock-admin-user-id',
  email: 'admin@charcoalnchill.com',
  full_name: 'Test Admin',
  role: 'admin',
  current_page: '/dashboard/content',
  online_at: '2026-03-01T10:05:00.000Z',
};

export const MOCK_DRAFT_LOCK: DraftLock = {
  id: 'lock-001',
  draft_id: 'draft-golden-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  user_id: 'mock-admin-user-id',
  user_email: 'admin@charcoalnchill.com',
  user_name: 'Test Admin',
  locked_at: '2026-03-01T10:05:00.000Z',
  expires_at: '2026-03-01T10:06:30.000Z',
};

export const MOCK_NOTIFICATION_SOV_COMPLETE: RealtimeNotification = {
  id: 'notif-001',
  event: 'cron_sov_complete',
  message: 'AI visibility scan complete. Your scores have been updated.',
  refresh_keys: ['sov', 'visibility_analytics'],
  action_url: '/dashboard/visibility',
  action_label: 'View Scores',
  sent_at: '2026-03-01T10:10:00.000Z',
  received_at: '2026-03-01T10:10:01.000Z',
};

export const MOCK_NOTIFICATION_MEMBER_JOINED: RealtimeNotification = {
  id: 'notif-002',
  event: 'member_joined',
  message: 'newmember@example.com has joined your organization.',
  refresh_keys: ['team'],
  sent_at: '2026-03-01T09:00:00.000Z',
  received_at: '2026-03-01T09:00:01.000Z',
};

// ── Sprint 117: Onboarding + Digest ─────────────────────────────────────────

import type { OnboardingState, OnboardingStepState } from '@/lib/onboarding/types';
import type { WeeklyDigestPayload } from '@/lib/digest/types';

export const MOCK_ONBOARDING_STATE_IN_PROGRESS: OnboardingState = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  steps: [
    { step_id: 'business_profile', completed: true,  completed_at: '2026-01-01T00:00:00Z', completed_by_user_id: '00000000-0000-0000-0000-000000000002' },
    { step_id: 'first_scan',       completed: true,  completed_at: '2026-01-02T00:00:00Z', completed_by_user_id: null },
    { step_id: 'first_draft',      completed: true,  completed_at: '2026-01-03T00:00:00Z', completed_by_user_id: null },
    { step_id: 'invite_teammate',  completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'connect_domain',   completed: false, completed_at: null, completed_by_user_id: null },
  ] as OnboardingStepState[],
  total_steps: 5,
  completed_steps: 3,
  is_complete: false,
  show_interstitial: false,
  has_real_data: true,
};

export const MOCK_ONBOARDING_STATE_NEW_USER: OnboardingState = {
  org_id: 'new-org-id',
  steps: [
    { step_id: 'business_profile', completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'first_scan',       completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'first_draft',      completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'invite_teammate',  completed: false, completed_at: null, completed_by_user_id: null },
    { step_id: 'connect_domain',   completed: false, completed_at: null, completed_by_user_id: null },
  ] as OnboardingStepState[],
  total_steps: 5,
  completed_steps: 0,
  is_complete: false,
  show_interstitial: true,
  has_real_data: false,
};

export const MOCK_WEEKLY_DIGEST_PAYLOAD: WeeklyDigestPayload = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_name: 'Charcoal N Chill',
  recipient_email: 'aruna@charcoalnchill.com',
  recipient_name: 'Aruna Babu',
  unsubscribe_token: 'abc123def456abc123def456abc123def456abc123def456abc123def456ab12',
  week_of: '2026-03-02',
  sov_trend: {
    current_sov: 42,
    previous_sov: 37,
    delta: 5,
    trend: 'up',
    total_queries: 12,
    cited_count: 5,
  },
  citations: [
    { query_text: 'best hookah lounge near Alpharetta', cited_at: '2026-03-01T00:00:00Z' },
    { query_text: 'upscale hookah bar Atlanta', cited_at: '2026-03-01T00:00:00Z' },
  ],
  missed_queries: [
    { query_text: 'hookah bar with private events', competitor_cited: null },
    { query_text: 'Indian fusion restaurant Alpharetta', competitor_cited: 'Zyka Restaurant' },
  ],
  first_mover_alert: {
    query_text: 'hookah lounge open late night',
    detected_at: '2026-03-01T10:00:00Z',
    action_url: '/dashboard/content/new?query=hookah+lounge+open+late+night',
  },
  org_logo_url: null,
  org_primary_color: '#1a1a2e',
  org_text_on_primary: '#ffffff',
};

// ---------------------------------------------------------------------------
// Sprint 118 — Rate Limiting + Slack Alerts Fixtures
// ---------------------------------------------------------------------------

export const MOCK_RATE_LIMIT_ALLOWED: RateLimitResult = {
  allowed: true,
  remaining: 59,
  reset_at: Math.floor(Date.now() / 1000) + 60,
  limit: 60,
};

export const MOCK_RATE_LIMIT_BLOCKED: RateLimitResult = {
  allowed: false,
  remaining: 0,
  reset_at: Math.floor(Date.now() / 1000) + 45,
  limit: 60,
  retry_after: 45,
};

export const MOCK_SOV_DROP_ALERT_PARAMS: SOVDropAlertParams = {
  org_name: 'Charcoal N Chill',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  current_score: 30,
  previous_score: 42,
  delta: -12,
  week_of: '2026-03-01T00:00:00.000Z',
};
