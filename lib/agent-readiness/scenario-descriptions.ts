// ---------------------------------------------------------------------------
// lib/agent-readiness/scenario-descriptions.ts — Sprint J
//
// Maps agent readiness capability IDs to customer-interaction scenario
// descriptions. Every capability is expressed as a customer question,
// not a technical requirement.
//
// AI_RULES §102: Agent Readiness jargon ban — these terms NEVER appear in UI:
// "JSON-LD", "schema.org", "structured data", "action schema",
// "reservation schema", "microdata", "RDF", "ontology", "agentic",
// "OpeningHoursSpecification", "ReserveAction", "OrderAction".
//
// Replacement vocabulary:
// "JSON-LD valid" → "AI can read your business information"
// "structured data" → "your business information is formatted for AI"
// "action schema" → "AI can take actions for customers"
// "ReserveAction schema" → "AI can book a reservation"
// "OrderAction schema" → "AI can place an order"
// ---------------------------------------------------------------------------

export type CapabilityId =
  | 'structured_hours'
  | 'menu_schema'
  | 'reserve_action'
  | 'order_action'
  | 'accessible_ctas'
  | 'captcha_free';

export interface ScenarioDescription {
  /** Customer-facing scenario (a question a customer would ask) */
  scenario: string;
  /** What it means when this capability is ACTIVE */
  whenActive: string;
  /** What it means when PARTIAL */
  whenPartial: string;
  /** What it means when MISSING — the customer consequence */
  whenMissing: string;
}

export const SCENARIO_DESCRIPTIONS: Record<CapabilityId, ScenarioDescription> = {
  structured_hours: {
    scenario: 'Can AI answer "Are you open right now?"',
    whenActive:
      'AI assistants can accurately tell customers your current hours. Fewer wasted trips.',
    whenPartial:
      'Your hours are stored but not in a format AI can reliably read. Some AI models may give customers wrong hours.',
    whenMissing:
      'AI assistants don\'t know your hours. Customers asking "Are you open?" may get wrong answers or no answer at all.',
  },

  menu_schema: {
    scenario: 'Can AI show customers your menu?',
    whenActive:
      'AI assistants can show customers your current menu and prices when they ask.',
    whenPartial:
      'Your menu exists but isn\'t in a format AI can easily read. Some AI models may show outdated or incomplete menu information.',
    whenMissing:
      'AI assistants can\'t show your menu. Customers asking "What\'s on the menu?" get no answer or outdated information from third-party sites.',
  },

  reserve_action: {
    scenario: 'Can AI book a reservation for a customer?',
    whenActive:
      'AI agents like ChatGPT and Gemini can book a table at your business directly on behalf of customers.',
    whenPartial:
      'You have a booking system, but AI agents can\'t find it automatically. Customers have to leave the AI and book separately — many won\'t.',
    whenMissing:
      'AI agents can\'t book reservations for customers. When a customer asks an AI to "book a table," your business won\'t be an option.',
  },

  order_action: {
    scenario: 'Can AI place an order for a customer?',
    whenActive:
      'AI agents can place food orders at your business directly on behalf of customers.',
    whenPartial:
      'You have an ordering system, but AI agents can\'t find it automatically. Customers have to leave the AI and order separately.',
    whenMissing:
      'AI agents can\'t place orders for customers. When someone asks AI to "order food," your business won\'t come up.',
  },

  accessible_ctas: {
    scenario: 'Can AI find your "Book" and "Order" buttons?',
    whenActive:
      'Your website\'s action buttons have clear labels that AI can read and act on.',
    whenPartial:
      'Some buttons on your website may be hard for AI to parse — icon-only buttons or unclear labels.',
    whenMissing:
      'AI can\'t find your action buttons. Even if you have online booking or ordering, AI assistants may not be able to direct customers to them.',
  },

  captcha_free: {
    scenario: 'Can AI complete a booking without getting blocked?',
    whenActive:
      'Your booking and ordering flows don\'t block AI agents with verification challenges.',
    whenPartial:
      'We can\'t verify this remotely — check that your booking and ordering flows don\'t use CAPTCHAs that would block AI agents.',
    whenMissing:
      'Your booking or ordering flow may block AI agents with CAPTCHAs. AI can\'t solve these challenges, so customers\' AI assistants will give up.',
  },
};

/**
 * Get the scenario description text for a capability and its status.
 */
export function getScenarioText(
  capabilityId: string,
  status: 'active' | 'partial' | 'missing',
): string {
  const desc = SCENARIO_DESCRIPTIONS[capabilityId as CapabilityId];
  if (!desc) return '';

  switch (status) {
    case 'active':
      return desc.whenActive;
    case 'partial':
      return desc.whenPartial;
    case 'missing':
      return desc.whenMissing;
    default:
      return '';
  }
}
