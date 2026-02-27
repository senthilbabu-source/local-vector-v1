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
