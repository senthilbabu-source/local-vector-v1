// ---------------------------------------------------------------------------
// lib/playbooks/engine-signal-library.ts — Engine Signal Knowledge (Sprint 134)
//
// Hardcoded engine signal knowledge based on known LLM behavior patterns.
// AI_RULES §167: Signal weights are heuristics, not ML outputs. Always label
// recommendations as "evidence suggests" not "guaranteed to improve".
//
// This is never dynamically updated — it reflects the best known signal
// patterns as of Sprint 134. Update manually as engine behavior changes.
// ---------------------------------------------------------------------------

import type { SignalDefinition, LocationSignalInput, SignalStatus } from './playbook-types';

// ── Engine display names ───────────────────────────────────────────────────

export const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  perplexity_sonar: 'Perplexity',
  openai_gpt4o_mini: 'ChatGPT',
  gemini_flash: 'Gemini',
  copilot: 'Copilot',
};

// ── Signal definitions per engine ──────────────────────────────────────────

export const ENGINE_SIGNAL_LIBRARIES: Record<string, SignalDefinition[]> = {
  perplexity_sonar: [
    {
      id: 'citation_domain_authority',
      label: 'Cited Source Quality',
      description:
        'Perplexity weights domain authority and freshness of sources it cites about your business.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        d.websiteUrl ? 'present' : 'missing',
      fixGuide:
        'Ensure your website URL is set and consistent across all listings. A website that Perplexity can crawl and cite is the #1 Perplexity signal.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/settings/business-info',
    },
    {
      id: 'canonical_url',
      label: 'Consistent Business URL',
      description:
        'Perplexity detects inconsistent URLs across GBP, website, and directories as a low-authority signal.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        d.canonicalUrlConsistent ? 'present' : 'missing',
      fixGuide:
        'Ensure your website URL in GBP, Yelp, and your Magic Menu all use the same canonical URL.',
      estimatedImpact: 'medium',
      linkedLocalVectorFeature: '/dashboard/settings/connections',
    },
    {
      id: 'menu_schema',
      label: 'Menu Data in Schema',
      description:
        'Perplexity cites structured menu data when answering food/service queries.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        d.hasMenuSchema ? 'present' : d.menuItemCount > 0 ? 'partial' : 'missing',
      fixGuide:
        'Publish your Magic Menu with JSON-LD schema enabled. This makes your menu directly readable by Perplexity.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/magic-menus',
    },
  ],

  openai_gpt4o_mini: [
    {
      id: 'factual_consistency',
      label: 'Consistent Business Facts Across Web',
      description:
        'ChatGPT Browse weights consistency of business name, address, and phone across multiple sources.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        d.gbpVerified && d.canonicalUrlConsistent ? 'present' : 'partial',
      fixGuide:
        'Ensure your NAP (Name, Address, Phone) is identical across GBP, your website, Yelp, and all directory listings.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/settings/connections',
    },
    {
      id: 'structured_data',
      label: 'Restaurant/LocalBusiness Schema',
      description:
        'ChatGPT Browse uses structured data to verify business category and attributes.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        d.hasRestaurantSchema ? 'present' : 'missing',
      fixGuide:
        'Add complete LocalBusiness or Restaurant JSON-LD schema to your homepage.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/agent-readiness',
    },
    {
      id: 'review_recency',
      label: 'Recent Review Activity',
      description:
        'ChatGPT incorporates review recency as a freshness signal for local business recommendations.',
      checkFn: (d: LocationSignalInput): SignalStatus => {
        if (!d.lastReviewDate) return 'missing';
        const daysSince =
          (Date.now() - new Date(d.lastReviewDate).getTime()) / 86400000;
        return daysSince < 30 ? 'present' : daysSince < 90 ? 'partial' : 'missing';
      },
      fixGuide:
        'Respond to reviews regularly. A review in the last 30 days significantly improves ChatGPT citation frequency.',
      estimatedImpact: 'medium',
    },
  ],

  gemini_flash: [
    {
      id: 'gbp_completeness',
      label: 'Google Business Profile Completeness',
      description:
        'Gemini heavily weights GBP completeness — it is the primary data source for Google AI.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        d.gbpCompleteness >= 80
          ? 'present'
          : d.gbpCompleteness >= 50
            ? 'partial'
            : 'missing',
      fixGuide:
        "Complete all GBP fields: description, categories, attributes, photos, services, and product catalog. Use LocalVector's data health score to identify gaps.",
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/settings/connections',
    },
    {
      id: 'reserve_action_schema',
      label: 'Reservation Booking Markup',
      description:
        'Gemini surfaces ReserveAction schema in AI Overviews for local service queries.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        d.hasReserveActionSchema ? 'present' : 'missing',
      fixGuide:
        'Add ReserveAction JSON-LD to your website and Magic Menu.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/agent-readiness',
    },
    {
      id: 'review_rating',
      label: 'Review Rating Quality',
      description:
        'Gemini uses average rating as a quality signal for local business recommendations.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        (d.avgRating ?? 0) >= 4.0
          ? 'present'
          : (d.avgRating ?? 0) >= 3.5
            ? 'partial'
            : 'missing',
      fixGuide:
        'Use entity-optimized review responses to improve engagement and encourage follow-up visits.',
      estimatedImpact: 'medium',
    },
  ],

  copilot: [
    {
      id: 'bing_places_accuracy',
      label: 'Bing Places Accuracy',
      description:
        'Microsoft Copilot uses Bing Places as its primary local business data source.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        d.hasBingPlacesEntry ? 'present' : 'missing',
      fixGuide:
        'Connect and sync your Bing Places listing via LocalVector Connections.',
      estimatedImpact: 'high',
      linkedLocalVectorFeature: '/dashboard/settings/connections',
    },
    {
      id: 'entity_graph',
      label: 'Microsoft Entity Graph Presence',
      description:
        'Copilot checks the Microsoft Knowledge Graph for entity verification.',
      checkFn: (d: LocationSignalInput): SignalStatus =>
        d.hasBingPlacesEntry && d.canonicalUrlConsistent ? 'present' : 'partial',
      fixGuide:
        "Ensure Bing Places name, address, and phone exactly match your website and GBP.",
      estimatedImpact: 'medium',
      linkedLocalVectorFeature: '/dashboard/entity-health',
    },
  ],
};
