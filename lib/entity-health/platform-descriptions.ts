// ---------------------------------------------------------------------------
// lib/entity-health/platform-descriptions.ts — Sprint J
//
// Maps entity_checks platform column names to plain-English customer-consequence
// descriptions. Replaces jargon like "Knowledge Graph" and "Entity" with
// language a restaurant owner understands.
//
// AI_RULES §101: Entity Health jargon ban — these terms NEVER appear in UI:
// "knowledge graph", "ontological", "entity disambiguation", "semantic",
// "embedding", "NLP", "NER", "entity resolution", "canonical form".
//
// Replacement vocabulary:
// "knowledge graph" → "what AI models know about you"
// "entity" → "your business" or "you"
// "entity health" → "how accurately AI knows your business"
// ---------------------------------------------------------------------------

import type { EntityPlatform } from '@/lib/services/entity-health.service';

export interface PlatformDescription {
  /** Short customer-facing label (jargon-free) */
  label: string;
  /** What a CONFIRMED status means for the business */
  whenConfirmed: string;
  /** What a MISSING status means — the customer consequence */
  whenMissing: string;
  /** What an INCOMPLETE status means */
  whenIncomplete: string;
  /** What UNCHECKED means */
  whenUnchecked: string;
}

export const PLATFORM_DESCRIPTIONS: Record<EntityPlatform, PlatformDescription> = {
  google_knowledge_panel: {
    label: 'Google recognizes your business',
    whenConfirmed:
      'Google AI (Gemini, AI Overviews) has verified information about your business. Customers get accurate answers.',
    whenMissing:
      'Google AI doesn\'t recognize your business as a verified entity. Customers asking Google about you may get guesses instead of facts.',
    whenIncomplete:
      'Google has some information about your business, but it\'s incomplete. Customers may get partial or outdated answers.',
    whenUnchecked:
      'We haven\'t checked whether Google recognizes your business yet.',
  },

  google_business_profile: {
    label: 'Google has your full business details',
    whenConfirmed:
      'Your Google Business Profile is verified and complete. This is the #1 source for AI answers about your business.',
    whenMissing:
      'You don\'t have a Google Business Profile. This is the single highest-impact gap — Google AI products have no verified source for your hours, location, or contact info.',
    whenIncomplete:
      'Your Google Business Profile exists but is missing key information. AI models may give customers incomplete answers about your hours or services.',
    whenUnchecked:
      'We haven\'t checked your Google Business Profile status yet.',
  },

  yelp: {
    label: 'ChatGPT can find your reviews',
    whenConfirmed:
      'Your Yelp listing is claimed and verified. ChatGPT and Microsoft Copilot cite your Yelp reviews when customers ask about you.',
    whenMissing:
      'Your Yelp listing is unclaimed. ChatGPT and Copilot may cite unverified or outdated Yelp information when recommending businesses like yours.',
    whenIncomplete:
      'Your Yelp listing exists but is incomplete. AI models may show outdated information from your Yelp page.',
    whenUnchecked:
      'We haven\'t checked whether your Yelp listing is claimed.',
  },

  tripadvisor: {
    label: 'Perplexity can verify your quality',
    whenConfirmed:
      'Your TripAdvisor listing is claimed. Perplexity and Copilot use your TripAdvisor reviews when ranking restaurants.',
    whenMissing:
      'Your TripAdvisor listing is unclaimed. Perplexity can\'t verify your quality through TripAdvisor reviews, which may affect your AI ranking.',
    whenIncomplete:
      'Your TripAdvisor listing exists but is missing information like photos, hours, or menu.',
    whenUnchecked:
      'We haven\'t checked your TripAdvisor listing status.',
  },

  apple_maps: {
    label: 'Siri can recommend your business',
    whenConfirmed:
      'Your Apple Maps listing is claimed. Siri and Apple Intelligence recommend you to customers asking for nearby businesses.',
    whenMissing:
      'Your Apple Maps listing is unclaimed. Siri and Apple Intelligence won\'t recommend your business when customers ask for nearby options.',
    whenIncomplete:
      'Your Apple Maps listing exists but is missing key details. Siri may give customers incomplete information.',
    whenUnchecked:
      'We haven\'t checked your Apple Maps listing status.',
  },

  bing_places: {
    label: 'Microsoft Copilot has your info',
    whenConfirmed:
      'Your Bing Places listing is claimed. Microsoft Copilot uses verified information when customers ask about your business.',
    whenMissing:
      'Your Bing Places listing is unclaimed. Microsoft Copilot has to guess about your business instead of using verified facts.',
    whenIncomplete:
      'Your Bing Places listing exists but is incomplete. Copilot may give customers partial or outdated information.',
    whenUnchecked:
      'We haven\'t checked your Bing Places listing status.',
  },

  wikidata: {
    label: 'AI models can distinguish you from similar businesses',
    whenConfirmed:
      'Your business has a Wikidata entry. AI models can reliably tell your business apart from others with similar names.',
    whenMissing:
      'No Wikidata entry found. This is optional for most businesses — only notable establishments benefit from Wikidata.',
    whenIncomplete:
      'Your Wikidata entry exists but is incomplete.',
    whenUnchecked:
      'We haven\'t checked your Wikidata status. This is optional for most businesses.',
  },
};

/**
 * Get the customer-consequence description for a platform and status.
 */
export function getPlatformConsequence(
  platform: EntityPlatform,
  status: 'confirmed' | 'missing' | 'incomplete' | 'unchecked',
): string {
  const desc = PLATFORM_DESCRIPTIONS[platform];
  if (!desc) return '';

  switch (status) {
    case 'confirmed':
      return desc.whenConfirmed;
    case 'missing':
      return desc.whenMissing;
    case 'incomplete':
      return desc.whenIncomplete;
    case 'unchecked':
      return desc.whenUnchecked;
    default:
      return '';
  }
}
