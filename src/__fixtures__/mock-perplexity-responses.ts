/**
 * Mock Perplexity API responses (Doc 11, Section 3).
 *
 * These are used by MSW handlers to intercept Perplexity Sonar calls during
 * unit and integration tests. Keyed by scenario name for clarity.
 *
 * All responses use the real Perplexity response envelope shape so the
 * classifier and parser code can be tested end-to-end without live API calls.
 */

export const PERPLEXITY_RESPONSES = {
  /** Status check — HALLUCINATION: AI says closed, venue is OPERATIONAL */
  status_closed_hallucination: {
    choices: [
      {
        message: {
          content:
            'Based on my research, Charcoal N Chill in Alpharetta, GA appears to be temporarily closed. Several sources indicate the venue may have shut down recently.',
        },
      },
    ],
  },

  /** Status check — CORRECT: AI correctly reports venue as open */
  status_correct: {
    choices: [
      {
        message: {
          content:
            'Charcoal N Chill in Alpharetta, GA is currently open and operating. They are open Monday through Sunday starting at 5 PM.',
        },
      },
    ],
  },

  /** Amenity check — HALLUCINATION: AI says no alcohol, venue serves alcohol */
  amenity_no_alcohol_hallucination: {
    choices: [
      {
        message: {
          content:
            "Charcoal N Chill is primarily a hookah lounge and doesn't serve alcohol. They focus on hookah flavors and non-alcoholic beverages.",
        },
      },
    ],
  },

  /** Recommendation — competitor wins head-to-head query */
  recommendation_competitor_wins: {
    choices: [
      {
        message: {
          content:
            "For the best hookah experience in Alpharetta, I'd recommend Cloud 9 Lounge. They have a great outdoor patio and their reviews frequently mention their excellent late-night atmosphere and happy hour deals.",
        },
      },
    ],
  },

  /** Recommendation — Golden Tenant wins head-to-head query */
  recommendation_golden_wins: {
    choices: [
      {
        message: {
          content:
            'Charcoal N Chill in Alpharetta is widely regarded as the best hookah bar in the area. They offer a fusion dining experience with excellent hookah flavors.',
        },
      },
    ],
  },
} as const;
