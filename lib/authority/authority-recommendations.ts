// ---------------------------------------------------------------------------
// lib/authority/authority-recommendations.ts — Authority Recommendations Engine
//
// Sprint 108: Generates prioritized, actionable steps to improve authority.
// Pure functions — no I/O.
// ---------------------------------------------------------------------------

import type {
  EntityAuthorityProfile,
  SameAsGap,
  AuthorityRecommendation,
  GroundTruth,
} from './types';

const MAX_RECOMMENDATIONS = 5;

/**
 * Generates a prioritized list of actionable recommendations for improving authority.
 * Returns up to 5 recommendations sorted by priority ASC, then estimated_score_gain DESC.
 */
export function generateRecommendations(
  profile: Omit<EntityAuthorityProfile, 'recommendations'>,
  sameAsGaps: SameAsGap[],
  groundTruth?: GroundTruth,
): AuthorityRecommendation[] {
  const recommendations: AuthorityRecommendation[] = [];

  // PRIORITY 1: No Tier 1 citations — biggest gap
  if (profile.tier_breakdown.tier1 === 0) {
    recommendations.push(
      buildTier1CitationRecommendation(groundTruth, 0),
    );
  }

  // PRIORITY 1: Citation velocity decline alert
  if (profile.citation_velocity !== null && profile.citation_velocity < -20) {
    recommendations.push(
      buildVelocityDecayRecommendation(profile.citation_velocity, 'tier1'),
    );
  }

  // PRIORITY 2: High-value sameAs gaps
  const highImpactGaps = sameAsGaps.filter(g => g.estimated_impact === 'high' && !g.already_in_schema);
  for (const gap of highImpactGaps.slice(0, 3)) {
    recommendations.push({
      priority: 2,
      category: 'sameas',
      title: gap.action_label,
      description: gap.action_instructions,
      estimated_score_gain: gap.platform === 'wikidata' || gap.platform === 'wikipedia' ? 8 : 5,
      effort: gap.url ? 'low' : 'medium',
      action_type: 'add_sameas',
      autopilot_trigger: false,
    });
  }

  // PRIORITY 2: Low platform breadth
  if (profile.dimensions.platform_breadth_score < 12) {
    recommendations.push({
      priority: 2,
      category: 'platform_breadth',
      title: 'Get listed on more major platforms',
      description: 'Your business is on fewer than 4 platforms. AI engines weight businesses cited across 4+ platforms 2.8x higher. Claim listings on Yelp, TripAdvisor, Foursquare, or OpenTable.',
      estimated_score_gain: 5,
      effort: 'medium',
      action_type: 'claim_listing',
      autopilot_trigger: false,
    });
  }

  // PRIORITY 3: Low Tier 2 coverage
  if (profile.tier_breakdown.tier2 < 3) {
    recommendations.push({
      priority: 3,
      category: 'tier2_listing',
      title: 'Increase review volume on major platforms',
      description: 'Fewer than 3 Tier 2 platform citations detected. Encourage satisfied customers to leave reviews on Google, Yelp, and TripAdvisor to increase your citation presence.',
      estimated_score_gain: 3,
      effort: 'low',
      action_type: 'review_request',
      autopilot_trigger: false,
    });
  }

  // PRIORITY 3: Low sameAs count
  if (profile.dimensions.sameas_score < 9) {
    const mediumGaps = sameAsGaps.filter(g => g.estimated_impact === 'medium' && !g.already_in_schema);
    if (mediumGaps.length > 0) {
      recommendations.push({
        priority: 3,
        category: 'sameas',
        title: 'Add more entity links to your homepage schema',
        description: `Your schema has fewer than 3 sameAs links. Add your ${mediumGaps.map(g => g.platform).join(', ')} URLs to strengthen your entity graph.`,
        estimated_score_gain: 5,
        effort: 'low',
        action_type: 'add_sameas',
        autopilot_trigger: false,
      });
    }
  }

  // Sort by priority ASC, then estimated_score_gain DESC
  recommendations.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.estimated_score_gain - a.estimated_score_gain;
  });

  return recommendations.slice(0, MAX_RECOMMENDATIONS);
}

/**
 * Generates the recommendation for Tier 1 citation gap.
 */
export function buildTier1CitationRecommendation(
  groundTruth?: GroundTruth,
  tier1Count?: number,
): AuthorityRecommendation {
  const city = groundTruth?.city ?? 'your city';
  return {
    priority: 1,
    category: 'tier1_citation',
    title: `Get featured in ${city} local press`,
    description: `No Tier 1 press citations found. A single mention in a local news site, food blog, or regional publication adds 15–30 points to your authority score. Consider reaching out to local journalists, submitting press releases, or pitching a unique story angle.`,
    estimated_score_gain: 22,
    effort: 'high',
    action_type: 'outreach',
    autopilot_trigger: true,
  };
}

/**
 * Generates the recommendation for citation velocity decline.
 */
export function buildVelocityDecayRecommendation(
  velocity: number,
  _topDeclinedTier: string,
): AuthorityRecommendation {
  return {
    priority: 1,
    category: 'velocity_recovery',
    title: 'Citation decline alert — publish new content immediately',
    description: `Your citations declined ${Math.abs(Math.round(velocity))}% month-over-month. This indicates your entity visibility is fading. Publish fresh content, request new reviews, and engage with platforms to reverse the trend.`,
    estimated_score_gain: 10,
    effort: 'medium',
    action_type: 'create_content',
    autopilot_trigger: true,
  };
}
