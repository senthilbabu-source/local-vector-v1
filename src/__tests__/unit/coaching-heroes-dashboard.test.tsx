// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/coaching-heroes-dashboard.test.tsx — Coaching Transformation
//
// Unit tests for the 3 new main-dashboard coaching components:
//   • AIQuoteTicker  — scrolling marquee of AI claim text
//   • WeeklyKPIChips — 3 status chips (AI Accuracy, Visibility, Crawlers)
//   • CoachBriefCard — weekly mission card with deriveMissions logic
//
// All are pure server components (no hooks). Tested with jsdom render.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ── Component imports ────────────────────────────────────────────────────────

import AIQuoteTicker from '@/app/dashboard/_components/AIQuoteTicker';
import WeeklyKPIChips from '@/app/dashboard/_components/WeeklyKPIChips';
import CoachBriefCard from '@/app/dashboard/_components/CoachBriefCard';

// ── Type helpers ─────────────────────────────────────────────────────────────

type HallucinationRow = {
  id: string;
  claim_text: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  model_provider: string;
  status: string;
};

function makeAlert(overrides: Partial<HallucinationRow> = {}): HallucinationRow {
  return {
    id: 'alert-1',
    claim_text: 'We open at 6am on Mondays',
    severity: 'high',
    model_provider: 'openai-gpt4o',
    status: 'open',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AIQuoteTicker
// ═══════════════════════════════════════════════════════════════════════════

describe('AIQuoteTicker', () => {
  it('renders without crashing', () => {
    render(<AIQuoteTicker alerts={[]} orgName="CNC Kitchen" />);
    // The ticker renders a region — no strict testid, check role
    expect(screen.getByRole('region')).toBeDefined();
  });

  it('shows "✓ AI Says" label when there are no alerts', () => {
    render(<AIQuoteTicker alerts={[]} orgName="CNC Kitchen" />);
    // aria-label on the region reflects accuracy state
    const region = screen.getByRole('region');
    expect(region.getAttribute('aria-label')).toContain('accurately');
  });

  it('shows "⚠ AI Says" label when there are open alerts', () => {
    render(<AIQuoteTicker alerts={[makeAlert()]} orgName="CNC Kitchen" />);
    const region = screen.getByRole('region');
    expect(region.getAttribute('aria-label')).toContain('inaccurate');
  });

  it('shows positive copy when no alerts', () => {
    const { container } = render(<AIQuoteTicker alerts={[]} orgName="CNC Kitchen" />);
    // Text is inside aria-hidden scrolling track — check container text directly
    expect(container.textContent).toContain('accurate hours');
  });

  it('renders alert claim_text when alerts are present', () => {
    render(<AIQuoteTicker alerts={[makeAlert({ claim_text: 'Closed on Sundays' })]} orgName="CNC Kitchen" />);
    // Claim text is duplicated (for seamless scroll) — findAllByText to handle both
    const matches = screen.getAllByText(/Closed on Sundays/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('truncates long claim text to 90 chars + ellipsis', () => {
    const longText = 'A'.repeat(100);
    render(<AIQuoteTicker alerts={[makeAlert({ claim_text: longText })]} orgName="CNC Kitchen" />);
    const matches = screen.getAllByText(/A{90}…/);
    expect(matches.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WeeklyKPIChips
// ═══════════════════════════════════════════════════════════════════════════

describe('WeeklyKPIChips', () => {
  it('renders a list with 3 chip items', () => {
    render(<WeeklyKPIChips openAlertCount={0} visibilityScore={null} crawlerSummary={null} />);
    const chips = screen.getAllByRole('listitem');
    expect(chips).toHaveLength(3);
  });

  // ── AI Accuracy chip ──────────────────────────────────────────────────────

  it('shows "All Clear" accuracy chip when openAlertCount=0', () => {
    render(<WeeklyKPIChips openAlertCount={0} visibilityScore={null} crawlerSummary={null} />);
    expect(screen.getByText('All Clear')).toBeDefined();
  });

  it('shows issue count in accuracy chip for 1-2 alerts', () => {
    render(<WeeklyKPIChips openAlertCount={2} visibilityScore={null} crawlerSummary={null} />);
    expect(screen.getByText('2 issues')).toBeDefined();
  });

  it('shows multi-issue label for 3+ alerts', () => {
    render(<WeeklyKPIChips openAlertCount={5} visibilityScore={null} crawlerSummary={null} />);
    expect(screen.getByText('5 issues')).toBeDefined();
  });

  // ── AI Visibility chip ────────────────────────────────────────────────────

  it('shows "Pending" visibility chip when visibilityScore=null', () => {
    render(<WeeklyKPIChips openAlertCount={0} visibilityScore={null} crawlerSummary={null} />);
    expect(screen.getByText('Pending')).toBeDefined();
  });

  it('shows score percentage for visibility chip when score provided', () => {
    render(<WeeklyKPIChips openAlertCount={0} visibilityScore={45} crawlerSummary={null} />);
    expect(screen.getByText('45%')).toBeDefined();
  });

  // ── AI Crawlers chip ──────────────────────────────────────────────────────

  it('shows "No data yet" crawlers chip when crawlerSummary=null', () => {
    render(<WeeklyKPIChips openAlertCount={0} visibilityScore={null} crawlerSummary={null} />);
    expect(screen.getByText('No data yet')).toBeDefined();
  });

  it('shows blocked count when crawlerSummary has blind spots', () => {
    const crawlerSummary = {
      blindSpotCount: 2,
      bots: [{ name: 'GPTBot', status: 'active' }],
    } as never;
    render(<WeeklyKPIChips openAlertCount={0} visibilityScore={null} crawlerSummary={crawlerSummary} />);
    expect(screen.getByText('2 blocked')).toBeDefined();
  });

  it('links each chip to correct dashboard page', () => {
    render(<WeeklyKPIChips openAlertCount={0} visibilityScore={60} crawlerSummary={null} />);
    // Chips render as <a> with role="listitem" (not "link") — query by listitem
    const items = screen.getAllByRole('listitem');
    const hrefs = items.map((el) => el.getAttribute('href'));
    expect(hrefs).toContain('/dashboard/hallucinations');
    expect(hrefs).toContain('/dashboard/share-of-voice');
    expect(hrefs).toContain('/dashboard/crawler-analytics');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CoachBriefCard
// ═══════════════════════════════════════════════════════════════════════════

describe('CoachBriefCard', () => {
  it('renders data-testid="coach-brief-card"', () => {
    render(<CoachBriefCard alerts={[]} draftsPending={0} score={80} firstName="Alex" />);
    expect(screen.getByTestId('coach-brief-card')).toBeDefined();
  });

  it('shows the owner first name in the header', () => {
    render(<CoachBriefCard alerts={[]} draftsPending={0} score={80} firstName="Jordan" />);
    expect(screen.getByText(/Jordan/)).toBeDefined();
  });

  it('shows urgent header when there is a critical/high alert', () => {
    const alert = makeAlert({ severity: 'critical' });
    render(<CoachBriefCard alerts={[alert]} draftsPending={0} score={80} firstName="Alex" />);
    expect(screen.getByText(/Heads up, Alex/i)).toBeDefined();
  });

  it('shows weekly focus header when no urgent alerts', () => {
    render(<CoachBriefCard alerts={[]} draftsPending={3} score={80} firstName="Sam" />);
    expect(screen.getByText(/Here's your focus this week, Sam/i)).toBeDefined();
  });

  it('derives "Fix [model] wrong info" mission for critical/high alerts', () => {
    const alert = makeAlert({ severity: 'high', model_provider: 'openai-gpt4o' });
    render(<CoachBriefCard alerts={[alert]} draftsPending={0} score={80} firstName="Alex" />);
    expect(screen.getByText(/Fix ChatGPT's wrong info/i)).toBeDefined();
  });

  it('derives "Review N accuracy issues" mission for medium/low alerts only', () => {
    const alert = makeAlert({ severity: 'low', model_provider: 'perplexity-sonar' });
    render(<CoachBriefCard alerts={[alert]} draftsPending={0} score={80} firstName="Alex" />);
    expect(screen.getByText(/Review 1 AI accuracy issue/i)).toBeDefined();
  });

  it('derives "Publish N posts" mission when draftsPending > 0 and no critical alerts', () => {
    render(<CoachBriefCard alerts={[]} draftsPending={4} score={80} firstName="Alex" />);
    expect(screen.getByText(/Publish 4 AI-written posts/i)).toBeDefined();
  });

  it('shows default menu update mission when all clear', () => {
    render(<CoachBriefCard alerts={[]} draftsPending={0} score={90} firstName="Alex" />);
    expect(screen.getByText(/Add this season's specials/i)).toBeDefined();
  });

  it('shows "Run a fresh scan" mission when score < 60 and nothing else', () => {
    render(<CoachBriefCard alerts={[]} draftsPending={0} score={45} firstName="Alex" />);
    expect(screen.getByText(/Run a fresh AI visibility scan/i)).toBeDefined();
  });

  it('renders coaching mission list with aria-label', () => {
    render(<CoachBriefCard alerts={[]} draftsPending={0} score={80} firstName="Alex" />);
    expect(screen.getByRole('list', { name: /Weekly coaching missions/i })).toBeDefined();
  });
});
