// ---------------------------------------------------------------------------
// lib/ai-shopper/shopper-scenarios.ts — S25: AI Shopper Scenarios
//
// 4 scenario templates for multi-turn AI conversation simulation.
// Each scenario has 4 turns that test different aspects of business accuracy.
// ---------------------------------------------------------------------------

export interface ShopperScenario {
  type: string;
  label: string;
  turns: string[];
}

export interface GroundTruthContext {
  business_name: string;
  city: string;
  cuisine: string;
  hours?: string;
  address?: string;
  phone?: string;
}

export const SHOPPER_SCENARIOS: Record<string, ShopperScenario> = {
  discovery: {
    type: 'discovery',
    label: 'Restaurant Discovery',
    turns: [
      "What's a good {cuisine} restaurant near {city}?",
      'Is {business_name} good? What are their hours?',
      'Can I make a reservation for 8 people this Friday?',
      'What should I order at {business_name}?',
    ],
  },
  reservation: {
    type: 'reservation',
    label: 'Reservation Planning',
    turns: [
      "I'm looking for a {cuisine} place in {city} for a special dinner",
      'Tell me about {business_name} - are they open on weekends?',
      "What's the address? I want to check how far it is",
      'Do they take reservations? What about parking?',
    ],
  },
  menu: {
    type: 'menu',
    label: 'Menu Research',
    turns: [
      'What kind of food does {business_name} in {city} serve?',
      'What are their most popular dishes?',
      "Do they have options for vegetarians or people with allergies?",
      "What's the average price range?",
    ],
  },
  hours: {
    type: 'hours',
    label: 'Hours & Logistics',
    turns: [
      'Is {business_name} in {city} open right now?',
      'What are their hours for the rest of the week?',
      'Can I call ahead? What is their phone number?',
      "Do they offer takeout or delivery?",
    ],
  },
};

/**
 * Interpolates scenario turn templates with business ground truth context.
 */
export function buildTurnPrompts(
  scenarioType: string,
  context: GroundTruthContext,
): string[] {
  const scenario = SHOPPER_SCENARIOS[scenarioType];
  if (!scenario) return [];

  return scenario.turns.map((template) =>
    template
      .replace(/{business_name}/g, context.business_name)
      .replace(/{city}/g, context.city)
      .replace(/{cuisine}/g, context.cuisine),
  );
}
