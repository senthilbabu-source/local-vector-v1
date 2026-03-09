// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/coaching-heroes-pages.test.tsx — Coaching Transformation
//
// Unit tests for the 12 page-level coaching hero components.
// Each is a pure server component (no hooks/state) — tested with jsdom render.
//
// Mocks:
//   • ConfettiTrigger  → null (client island, irrelevant to render logic)
//   • InfoTooltip      → null (UI decoration, not under test)
//   • next/link        → plain <a> tag for href assertions
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/components/ui/ConfettiTrigger', () => ({ default: () => null }));
vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: () => null,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ── Component imports ────────────────────────────────────────────────────────

import AIAccuracyHero from '@/app/dashboard/hallucinations/_components/AIAccuracyHero';
import LostSalesHero from '@/app/dashboard/revenue-impact/_components/LostSalesHero';
import AIVisibilityHero from '@/app/dashboard/share-of-voice/_components/AIVisibilityHero';
import CompeteCoachHero from '@/app/dashboard/compete/_components/CompeteCoachHero';
import ListingsCoachHero from '@/app/dashboard/integrations/_components/ListingsCoachHero';
import MenuCoachHero from '@/app/dashboard/magic-menus/_components/MenuCoachHero';
import ReviewsCoachHero from '@/app/dashboard/reviews/_components/ReviewsCoachHero';
import CustomerLoveHero from '@/app/dashboard/sentiment/_components/CustomerLoveHero';
import PostsCoachHero from '@/app/dashboard/content-drafts/_components/PostsCoachHero';
import PlatformsCoachHero from '@/app/dashboard/citations/_components/PlatformsCoachHero';
import WebsiteCheckupCoachHero from '@/app/dashboard/page-audits/_components/WebsiteCheckupCoachHero';
import QuestionsCoachHero from '@/app/dashboard/intent-discovery/_components/QuestionsCoachHero';

// ── Shared helpers ───────────────────────────────────────────────────────────

const EMPTY_ENGINE_SCORES = {
  openai: null,
  perplexity: null,
  gemini: null,
  anthropic: null,
} as const;

const BASE_MENU = {
  id: 'menu-1',
  location_id: 'loc-1',
  org_id: 'org-1',
  processing_status: 'completed' as const,
  is_published: false,
  extracted_data: { items: [{ name: 'Burger', price: 10 }] },
  propagation_events: [] as Array<{ event: string }>,
  content_hash: null,
  last_distributed_at: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const BASE_SENTIMENT = {
  averageScore: 0.5,
  dominantLabel: 'positive' as const,
  dominantTone: 'positive' as const,
  topPositive: ['cozy', 'friendly', 'fresh'],
  topNegative: [] as string[],
  byEngine: {
    perplexity: { averageScore: 0.6, label: 'positive' as const, tone: 'positive' as const, descriptors: { positive: ['cozy'], negative: [], neutral: [] } },
    openai:     { averageScore: 0.4, label: 'positive' as const, tone: 'matter_of_fact' as const, descriptors: { positive: ['fresh'], negative: [], neutral: [] } },
  },
  evaluationCount: 10,
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. AIAccuracyHero
// ═══════════════════════════════════════════════════════════════════════════

describe('AIAccuracyHero', () => {
  const baseProps = {
    score: null,
    enginesReporting: 0,
    engineScores: { ...EMPTY_ENGINE_SCORES },
    topIssue: null,
    openCount: 0,
    resolvedCount: 0,
  };

  it('renders data-testid="ai-accuracy-hero"', () => {
    render(<AIAccuracyHero {...baseProps} />);
    expect(screen.getByTestId('ai-accuracy-hero')).toBeDefined();
  });

  it('shows "Not checked yet" grade when score is null', () => {
    render(<AIAccuracyHero {...baseProps} />);
    expect(screen.getByText('Not checked yet')).toBeDefined();
  });

  it('shows "Spot On" grade for score=95', () => {
    render(<AIAccuracyHero {...baseProps} score={95} />);
    expect(screen.getByText('Spot On')).toBeDefined();
  });

  it('shows "Mostly Right" grade for score=75', () => {
    render(<AIAccuracyHero {...baseProps} score={75} />);
    expect(screen.getByText('Mostly Right')).toBeDefined();
  });

  it('shows "A Few Errors" grade for score=55', () => {
    render(<AIAccuracyHero {...baseProps} score={55} />);
    expect(screen.getByText('A Few Errors')).toBeDefined();
  });

  it('shows "Needs Fixing" grade for score=30', () => {
    render(<AIAccuracyHero {...baseProps} score={30} />);
    expect(screen.getByText('Needs Fixing')).toBeDefined();
  });

  it('renders top-issue coaching card when topIssue + openCount > 0', () => {
    render(
      <AIAccuracyHero
        {...baseProps}
        score={40}
        openCount={1}
        topIssue={{ claim_text: 'Wrong hours listed', severity: 'high', model_provider: 'openai' }}
      />
    );
    expect(screen.getByTestId('ai-accuracy-top-issue')).toBeDefined();
    expect(screen.getByText('Wrong hours listed')).toBeDefined();
  });

  it('does NOT render top-issue card when openCount is 0', () => {
    render(
      <AIAccuracyHero
        {...baseProps}
        score={40}
        openCount={0}
        topIssue={{ claim_text: 'Wrong hours listed', severity: 'high', model_provider: 'openai' }}
      />
    );
    expect(screen.queryByTestId('ai-accuracy-top-issue')).toBeNull();
  });

  it('shows open issues badge when openCount > 0', () => {
    render(<AIAccuracyHero {...baseProps} score={60} openCount={3} />);
    expect(screen.getByText('3 open issues')).toBeDefined();
  });

  it('shows "All Clear" badge for spot-on grade', () => {
    render(<AIAccuracyHero {...baseProps} score={92} />);
    expect(screen.getByText('All Clear')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. LostSalesHero
// ═══════════════════════════════════════════════════════════════════════════

describe('LostSalesHero', () => {
  const baseProps = {
    monthlyLoss: 0,
    annualLoss: 0,
    sovGapRevenue: 0,
    hallucinationRevenue: 0,
    competitorRevenue: 0,
    isDefaultConfig: false,
    avgCustomerValue: 55,
    monthlyCovers: 1800,
    industryLabel: 'Restaurant',
  };

  it('renders data-testid="lost-sales-hero"', () => {
    render(<LostSalesHero {...baseProps} />);
    expect(screen.getByTestId('lost-sales-hero')).toBeDefined();
  });

  it('shows "Covered" tier when monthlyLoss is 0', () => {
    render(<LostSalesHero {...baseProps} />);
    expect(screen.getByText("You're Covered")).toBeDefined();
  });

  it('shows "High Stakes" tier for monthlyLoss >= 5000', () => {
    render(<LostSalesHero {...baseProps} monthlyLoss={6000} annualLoss={72000} />);
    expect(screen.getByText('High Stakes')).toBeDefined();
  });

  it('shows "Worth Fixing" tier for monthlyLoss 1000-4999', () => {
    render(<LostSalesHero {...baseProps} monthlyLoss={2000} annualLoss={24000} />);
    expect(screen.getByText('Worth Fixing')).toBeDefined();
  });

  it('shows "Small Gap" tier for monthlyLoss < 1000', () => {
    render(<LostSalesHero {...baseProps} monthlyLoss={400} annualLoss={4800} />);
    expect(screen.getByText('Small Gap')).toBeDefined();
  });

  it('shows default config disclosure when isDefaultConfig=true', () => {
    const { container } = render(
      <LostSalesHero {...baseProps} monthlyLoss={1000} annualLoss={12000} isDefaultConfig={true} />
    );
    expect(container.textContent).toContain('Based on typical');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. AIVisibilityHero
// ═══════════════════════════════════════════════════════════════════════════

describe('AIVisibilityHero', () => {
  const baseProps = {
    shareOfVoice: null,
    weekOverWeekDeltaPct: null,
    totalQueries: 10,
    topCompetitor: null,
    engineStats: {},
    nextScanLabel: 'Sunday, Mar 8',
    scanStreak: 0,
  };

  it('renders data-testid="ai-visibility-hero"', () => {
    render(<AIVisibilityHero {...baseProps} />);
    expect(screen.getByTestId('ai-visibility-hero')).toBeDefined();
  });

  it('shows "Not Yet Scanned" when shareOfVoice is null', () => {
    render(<AIVisibilityHero {...baseProps} />);
    expect(screen.getByText('Not Yet Scanned')).toBeDefined();
  });

  it('shows "Leading" tier for shareOfVoice >= 40', () => {
    render(<AIVisibilityHero {...baseProps} shareOfVoice={50} />);
    expect(screen.getByText('Leading')).toBeDefined();
  });

  it('shows "In The Game" tier for shareOfVoice 20-39', () => {
    render(<AIVisibilityHero {...baseProps} shareOfVoice={25} />);
    expect(screen.getByText('In The Game')).toBeDefined();
  });

  it('shows "Being Missed" tier for shareOfVoice 5-19', () => {
    render(<AIVisibilityHero {...baseProps} shareOfVoice={10} />);
    expect(screen.getByText('Being Missed')).toBeDefined();
  });

  it('shows "Invisible" tier for shareOfVoice < 5', () => {
    render(<AIVisibilityHero {...baseProps} shareOfVoice={2} />);
    expect(screen.getByText('Invisible')).toBeDefined();
  });

  it('shows week-over-week delta when provided', () => {
    render(<AIVisibilityHero {...baseProps} shareOfVoice={30} weekOverWeekDeltaPct={5.2} />);
    const delta = screen.getByTestId('visibility-delta');
    expect(delta.textContent).toContain('+5.2');
  });

  it('shows competitor coaching card when topCompetitor provided', () => {
    render(
      <AIVisibilityHero
        {...baseProps}
        shareOfVoice={20}
        topCompetitor={{ name: 'Burger Palace', mentionCount: 7 }}
      />
    );
    expect(screen.getByText(/Burger Palace/)).toBeDefined();
  });

  it('shows streak badge when scanStreak >= 2', () => {
    render(<AIVisibilityHero {...baseProps} shareOfVoice={30} scanStreak={4} />);
    expect(screen.getByTestId('scan-streak-badge')).toBeDefined();
  });

  it('does NOT show streak badge when scanStreak < 2', () => {
    render(<AIVisibilityHero {...baseProps} shareOfVoice={30} scanStreak={1} />);
    expect(screen.queryByTestId('scan-streak-badge')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. CompeteCoachHero
// ═══════════════════════════════════════════════════════════════════════════

describe('CompeteCoachHero', () => {
  const baseProps = {
    winCount: 0,
    lossCount: 0,
    businessName: 'CNC Kitchen',
    topLosingCompetitor: null,
  };

  it('renders data-testid="compete-coach-hero"', () => {
    render(<CompeteCoachHero {...baseProps} />);
    expect(screen.getByTestId('compete-coach-hero')).toBeDefined();
  });

  it('shows "No Data Yet" when no intercepts', () => {
    render(<CompeteCoachHero {...baseProps} />);
    expect(screen.getByText('No Data Yet')).toBeDefined();
  });

  it('shows "Winning" tier for winRate >= 60%', () => {
    render(<CompeteCoachHero {...baseProps} winCount={7} lossCount={3} />);
    expect(screen.getByText('Winning')).toBeDefined();
  });

  it('shows "Competitive" tier for winRate 40-59%', () => {
    render(<CompeteCoachHero {...baseProps} winCount={5} lossCount={5} />);
    expect(screen.getByText('Competitive')).toBeDefined();
  });

  it('shows "Losing" tier for winRate < 40%', () => {
    render(<CompeteCoachHero {...baseProps} winCount={2} lossCount={8} />);
    expect(screen.getByText('Losing')).toBeDefined();
  });

  it('shows win/loss counts', () => {
    render(<CompeteCoachHero {...baseProps} winCount={4} lossCount={6} />);
    expect(screen.getByTestId('compete-win-count').textContent).toContain('4W');
    expect(screen.getByTestId('compete-loss-count').textContent).toContain('6L');
  });

  it('shows top losing competitor coaching card', () => {
    render(
      <CompeteCoachHero
        {...baseProps}
        winCount={3}
        lossCount={7}
        topLosingCompetitor={{ name: 'Rival Burgers', lossCount: 5 }}
      />
    );
    expect(screen.getByText(/Rival Burgers/)).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. ListingsCoachHero
// ═══════════════════════════════════════════════════════════════════════════

describe('ListingsCoachHero', () => {
  it('renders data-testid="listings-coach-hero"', () => {
    render(<ListingsCoachHero totalConnected={0} totalPossible={0} needsAttentionCount={0} hasLocations={false} />);
    expect(screen.getByTestId('listings-coach-hero')).toBeDefined();
  });

  it('shows "No Locations" tier when hasLocations is false', () => {
    render(<ListingsCoachHero totalConnected={0} totalPossible={6} needsAttentionCount={0} hasLocations={false} />);
    expect(screen.getByText('No Locations')).toBeDefined();
  });

  it('shows "Fully Listed" tier when coverage >= 67%', () => {
    render(<ListingsCoachHero totalConnected={5} totalPossible={6} needsAttentionCount={0} hasLocations={true} />);
    expect(screen.getByText('Fully Listed')).toBeDefined();
  });

  it('shows "Partially Listed" tier for mid coverage', () => {
    render(<ListingsCoachHero totalConnected={3} totalPossible={6} needsAttentionCount={0} hasLocations={true} />);
    expect(screen.getByText('Partially Listed')).toBeDefined();
  });

  it('shows "Barely Listed" tier for < 34% coverage', () => {
    render(<ListingsCoachHero totalConnected={1} totalPossible={6} needsAttentionCount={0} hasLocations={true} />);
    expect(screen.getByText('Barely Listed')).toBeDefined();
  });

  it('shows connected count stat', () => {
    render(<ListingsCoachHero totalConnected={4} totalPossible={6} needsAttentionCount={0} hasLocations={true} />);
    expect(screen.getByTestId('listings-connected-count').textContent).toContain('4/6');
  });

  it('shows needs-attention coaching card when needsAttentionCount > 0', () => {
    const { container } = render(
      <ListingsCoachHero totalConnected={4} totalPossible={6} needsAttentionCount={2} hasLocations={true} />
    );
    expect(container.textContent).toContain('platforms need attention');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. MenuCoachHero
// ═══════════════════════════════════════════════════════════════════════════

describe('MenuCoachHero', () => {
  it('renders data-testid="menu-coach-hero"', () => {
    render(<MenuCoachHero menu={null} locationName="CNC Kitchen" industryNoun="menu" />);
    expect(screen.getByTestId('menu-coach-hero')).toBeDefined();
  });

  it('shows "Not Uploaded" tier when menu is null', () => {
    render(<MenuCoachHero menu={null} locationName="CNC Kitchen" industryNoun="menu" />);
    expect(screen.getByText('Not Uploaded')).toBeDefined();
  });

  it('shows "In Review" tier for unpublished menu', () => {
    const menu = { ...BASE_MENU, is_published: false };
    render(<MenuCoachHero menu={menu as never} locationName="CNC Kitchen" industryNoun="menu" />);
    expect(screen.getByText('In Review')).toBeDefined();
  });

  it('shows "Published" tier for published menu with no distribution events', () => {
    const menu = { ...BASE_MENU, is_published: true, propagation_events: [] };
    render(<MenuCoachHero menu={menu as never} locationName="CNC Kitchen" industryNoun="menu" />);
    expect(screen.getByText('Published')).toBeDefined();
  });

  it('shows "Live & Distributed" tier when indexnow_pinged event present', () => {
    const menu = {
      ...BASE_MENU,
      is_published: true,
      propagation_events: [{ event: 'indexnow_pinged' }],
    };
    render(<MenuCoachHero menu={menu as never} locationName="CNC Kitchen" industryNoun="menu" />);
    expect(screen.getByText('Live & Distributed')).toBeDefined();
  });

  it('shows item count in orb when menu has items', () => {
    const menu = {
      ...BASE_MENU,
      is_published: true,
      extracted_data: { items: [1, 2, 3, 4, 5] },
      propagation_events: [],
    };
    render(<MenuCoachHero menu={menu as never} locationName="CNC Kitchen" industryNoun="menu" />);
    expect(screen.getByTestId('menu-item-count').textContent).toBe('5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. ReviewsCoachHero
// ═══════════════════════════════════════════════════════════════════════════

describe('ReviewsCoachHero', () => {
  it('renders data-testid="reviews-coach-hero"', () => {
    render(<ReviewsCoachHero avgRating={0} total={0} pending={0} published={0} />);
    expect(screen.getByTestId('reviews-coach-hero')).toBeDefined();
  });

  it('shows "No Reviews Yet" tier when total is 0', () => {
    render(<ReviewsCoachHero avgRating={0} total={0} pending={0} published={0} />);
    expect(screen.getByText('No Reviews Yet')).toBeDefined();
  });

  it('shows "Loved" tier for avgRating >= 4.5', () => {
    render(<ReviewsCoachHero avgRating={4.7} total={50} pending={0} published={10} />);
    expect(screen.getByText('Loved')).toBeDefined();
  });

  it('shows "Solid" tier for avgRating 4.0-4.4', () => {
    render(<ReviewsCoachHero avgRating={4.2} total={30} pending={2} published={5} />);
    expect(screen.getByText('Solid')).toBeDefined();
  });

  it('shows "Mixed" tier for avgRating 3.5-3.9', () => {
    render(<ReviewsCoachHero avgRating={3.7} total={20} pending={3} published={4} />);
    expect(screen.getByText('Mixed')).toBeDefined();
  });

  it('shows "Needs Attention" tier for avgRating < 3.5', () => {
    render(<ReviewsCoachHero avgRating={2.9} total={15} pending={5} published={2} />);
    expect(screen.getByText('Needs Attention')).toBeDefined();
  });

  it('shows pending review count coaching card', () => {
    render(<ReviewsCoachHero avgRating={4.0} total={20} pending={3} published={5} />);
    expect(screen.getByText(/3 reviews waiting for your reply/i)).toBeDefined();
  });

  it('shows all caught up message when pending=0 and published>0', () => {
    render(<ReviewsCoachHero avgRating={4.5} total={10} pending={0} published={8} />);
    expect(screen.getByText(/All caught up/i)).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. CustomerLoveHero
// ═══════════════════════════════════════════════════════════════════════════

describe('CustomerLoveHero', () => {
  it('renders data-testid="customer-love-hero"', () => {
    render(<CustomerLoveHero summary={BASE_SENTIMENT} trend={[]} />);
    expect(screen.getByTestId('customer-love-hero')).toBeDefined();
  });

  it('shows "Loved" grade for averageScore > 0.3', () => {
    render(<CustomerLoveHero summary={{ ...BASE_SENTIMENT, averageScore: 0.6 }} trend={[]} />);
    expect(screen.getByText('Loved')).toBeDefined();
  });

  it('shows "Getting There" grade for averageScore -0.3 to 0.3', () => {
    render(<CustomerLoveHero summary={{ ...BASE_SENTIMENT, averageScore: 0.1 }} trend={[]} />);
    expect(screen.getByText('Getting There')).toBeDefined();
  });

  it('shows "Needs Care" grade for averageScore < -0.3', () => {
    render(<CustomerLoveHero summary={{ ...BASE_SENTIMENT, averageScore: -0.5 }} trend={[]} />);
    expect(screen.getByText('Needs Care')).toBeDefined();
  });

  it('renders positive word chips', () => {
    render(<CustomerLoveHero summary={{ ...BASE_SENTIMENT, topPositive: ['cozy', 'friendly'] }} trend={[]} />);
    expect(screen.getByText('cozy')).toBeDefined();
    expect(screen.getByText('friendly')).toBeDefined();
  });

  it('shows "Fix now" CTA for non-Loved states', () => {
    render(<CustomerLoveHero summary={{ ...BASE_SENTIMENT, averageScore: 0.0 }} trend={[]} />);
    expect(screen.getByText(/Fix now/i)).toBeDefined();
  });

  it('does NOT show "Fix now" CTA for Loved state', () => {
    render(<CustomerLoveHero summary={{ ...BASE_SENTIMENT, averageScore: 0.8 }} trend={[]} />);
    expect(screen.queryByText(/Fix now/i)).toBeNull();
  });

  it('shows week-over-week delta badge from trend data', () => {
    const trend = [
      { weekStart: '2026-02-22', averageScore: 0.2, evaluationCount: 5 },
      { weekStart: '2026-03-01', averageScore: 0.5, evaluationCount: 8 },
    ];
    render(<CustomerLoveHero summary={BASE_SENTIMENT} trend={trend} />);
    expect(screen.getByText('▲ Improving this week')).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. PostsCoachHero
// ═══════════════════════════════════════════════════════════════════════════

describe('PostsCoachHero', () => {
  it('renders data-testid="posts-coach-hero"', () => {
    render(<PostsCoachHero total={0} draftCount={0} approvedCount={0} publishedCount={0} />);
    expect(screen.getByTestId('posts-coach-hero')).toBeDefined();
  });

  it('shows "Getting Started" tier when total=0', () => {
    render(<PostsCoachHero total={0} draftCount={0} approvedCount={0} publishedCount={0} />);
    expect(screen.getByText('Getting Started')).toBeDefined();
  });

  it('shows "All Reviewed" tier when draftCount=0 and total>0', () => {
    render(<PostsCoachHero total={5} draftCount={0} approvedCount={2} publishedCount={3} />);
    expect(screen.getByText('All Reviewed')).toBeDefined();
  });

  it('shows "Review Needed" tier for draftCount >= 5', () => {
    render(<PostsCoachHero total={8} draftCount={5} approvedCount={1} publishedCount={2} />);
    expect(screen.getByText('Review Needed')).toBeDefined();
  });

  it('shows "Ready to Review" tier for 1-4 drafts', () => {
    render(<PostsCoachHero total={6} draftCount={3} approvedCount={1} publishedCount={2} />);
    expect(screen.getByText('Ready to Review')).toBeDefined();
  });

  it('shows "to review" orb label when draftCount > 0', () => {
    render(<PostsCoachHero total={8} draftCount={3} approvedCount={2} publishedCount={3} />);
    expect(screen.getByText('to review')).toBeDefined();
  });

  it('shows "Review now" CTA when drafts pending', () => {
    render(<PostsCoachHero total={5} draftCount={2} approvedCount={1} publishedCount={2} />);
    expect(screen.getByText(/Review now/i)).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. PlatformsCoachHero
// ═══════════════════════════════════════════════════════════════════════════

describe('PlatformsCoachHero', () => {
  const baseProps = {
    gapScore: 0,
    platformsCovered: 0,
    platformsThatMatter: 0,
    topGapPlatform: null,
    topGapAction: null,
    topGapFrequency: null,
  };

  it('renders data-testid="platforms-coach-hero"', () => {
    render(<PlatformsCoachHero {...baseProps} />);
    expect(screen.getByTestId('platforms-coach-hero')).toBeDefined();
  });

  it('shows "Scanning" tier when platformsThatMatter=0', () => {
    render(<PlatformsCoachHero {...baseProps} />);
    expect(screen.getByText('Scanning')).toBeDefined();
  });

  it('shows "Well Covered" tier for gapScore >= 80', () => {
    render(<PlatformsCoachHero {...baseProps} gapScore={85} platformsCovered={5} platformsThatMatter={6} />);
    expect(screen.getByText('Well Covered')).toBeDefined();
  });

  it('shows "Good Coverage" tier for gapScore 60-79', () => {
    render(<PlatformsCoachHero {...baseProps} gapScore={65} platformsCovered={4} platformsThatMatter={6} />);
    expect(screen.getByText('Good Coverage')).toBeDefined();
  });

  it('shows "Gaps Found" tier for gapScore 30-59', () => {
    render(<PlatformsCoachHero {...baseProps} gapScore={45} platformsCovered={3} platformsThatMatter={6} />);
    expect(screen.getByText('Gaps Found')).toBeDefined();
  });

  it('shows "Nearly Invisible" tier for gapScore < 30', () => {
    render(<PlatformsCoachHero {...baseProps} gapScore={15} platformsCovered={1} platformsThatMatter={6} />);
    expect(screen.getByText('Nearly Invisible')).toBeDefined();
  });

  it('shows top gap coaching card when topGapPlatform provided', () => {
    render(
      <PlatformsCoachHero
        {...baseProps}
        gapScore={40}
        platformsCovered={2}
        platformsThatMatter={6}
        topGapPlatform="TripAdvisor"
        topGapAction="Claim your listing"
        topGapFrequency={0.45}
      />
    );
    expect(screen.getByText(/Biggest gap: TripAdvisor/)).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. WebsiteCheckupCoachHero
// ═══════════════════════════════════════════════════════════════════════════

describe('WebsiteCheckupCoachHero', () => {
  it('renders data-testid="website-checkup-coach-hero"', () => {
    render(<WebsiteCheckupCoachHero avgScore={0} total={0} lowestPage={null} />);
    expect(screen.getByTestId('website-checkup-coach-hero')).toBeDefined();
  });

  it('shows "Not Audited" tier when total=0', () => {
    render(<WebsiteCheckupCoachHero avgScore={0} total={0} lowestPage={null} />);
    expect(screen.getByText('Not Audited')).toBeDefined();
  });

  it('shows "AI-Ready" tier for avgScore >= 80', () => {
    render(<WebsiteCheckupCoachHero avgScore={88} total={3} lowestPage={null} />);
    expect(screen.getByText('AI-Ready')).toBeDefined();
  });

  it('shows "Good Structure" tier for avgScore 60-79', () => {
    render(<WebsiteCheckupCoachHero avgScore={70} total={3} lowestPage={null} />);
    expect(screen.getByText('Good Structure')).toBeDefined();
  });

  it('shows "Needs Improvement" tier for avgScore 40-59', () => {
    render(<WebsiteCheckupCoachHero avgScore={50} total={3} lowestPage={null} />);
    expect(screen.getByText('Needs Improvement')).toBeDefined();
  });

  it('shows "Not AI-Ready" tier for avgScore < 40', () => {
    render(<WebsiteCheckupCoachHero avgScore={25} total={3} lowestPage={null} />);
    expect(screen.getByText('Not AI-Ready')).toBeDefined();
  });

  it('shows weakest page coaching card when lowestPage provided and score < 80', () => {
    render(
      <WebsiteCheckupCoachHero
        avgScore={55}
        total={3}
        lowestPage={{ url: 'https://example.com/menu', score: 35, topRecommendation: 'Add FAQ section' }}
      />
    );
    expect(screen.getByText(/Weakest page:/)).toBeDefined();
    expect(screen.getByText('Add FAQ section')).toBeDefined();
  });

  it('shows start-auditing prompt when total=0', () => {
    render(<WebsiteCheckupCoachHero avgScore={0} total={0} lowestPage={null} />);
    expect(screen.getByText(/Start by auditing your homepage/i)).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. QuestionsCoachHero
// ═══════════════════════════════════════════════════════════════════════════

describe('QuestionsCoachHero', () => {
  it('renders data-testid="questions-coach-hero"', () => {
    render(<QuestionsCoachHero gapCount={0} coveredCount={0} topGapPrompt={null} />);
    expect(screen.getByTestId('questions-coach-hero')).toBeDefined();
  });

  it('shows "Scanning" tier when no data', () => {
    render(<QuestionsCoachHero gapCount={0} coveredCount={0} topGapPrompt={null} />);
    expect(screen.getByText('Scanning')).toBeDefined();
  });

  it('shows "Fully Covered" tier when gapCount=0 and coveredCount>0', () => {
    render(<QuestionsCoachHero gapCount={0} coveredCount={8} topGapPrompt={null} />);
    expect(screen.getByText('Fully Covered')).toBeDefined();
  });

  it('shows "Well Covered" tier for coverage >= 70%', () => {
    render(<QuestionsCoachHero gapCount={2} coveredCount={8} topGapPrompt={null} />);
    expect(screen.getByText('Well Covered')).toBeDefined();
  });

  it('shows "Gaps Found" tier for coverage 40-69%', () => {
    render(<QuestionsCoachHero gapCount={4} coveredCount={6} topGapPrompt={null} />);
    expect(screen.getByText('Gaps Found')).toBeDefined();
  });

  it('shows "Critical Gaps" tier for coverage < 40%', () => {
    render(<QuestionsCoachHero gapCount={8} coveredCount={2} topGapPrompt={null} />);
    expect(screen.getByText('Critical Gaps')).toBeDefined();
  });

  it('shows top gap prompt in coaching card', () => {
    render(
      <QuestionsCoachHero
        gapCount={3}
        coveredCount={2}
        topGapPrompt="Does your restaurant have outdoor seating?"
      />
    );
    expect(screen.getByText(/Does your restaurant have outdoor seating\?/i)).toBeDefined();
  });

  it('shows "unanswered" orb label when gapCount > 0', () => {
    render(<QuestionsCoachHero gapCount={5} coveredCount={3} topGapPrompt={null} />);
    expect(screen.getByText('unanswered')).toBeDefined();
  });
});
