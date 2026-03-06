// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// wave1-components.test.tsx — S14/S15/S16 component unit tests (Wave 1)
// AI_RULES §214 §215 §216
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { HallucinationRow, ScoreSnapshot } from '@/lib/data/dashboard';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/app/dashboard/actions', () => ({
  updateHallucinationStatus: vi.fn(),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeAlert(overrides: Partial<HallucinationRow> = {}): HallucinationRow {
  return {
    id: 'alert-1',
    severity: 'high',
    category: 'hours',
    model_provider: 'openai-gpt4o',
    claim_text: 'Open until 2 AM',
    expected_truth: 'Open until midnight',
    correction_status: 'open',
    first_detected_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    last_seen_at: new Date().toISOString(),
    occurrence_count: 2,
    follow_up_result: null,
    fixed_at: null,
    verified_at: null,
    revenue_recovered_monthly: null,
    fix_guidance_category: null,
    ...overrides,
  };
}

// ── FixGuidancePanel ──────────────────────────────────────────────────────

describe('FixGuidancePanel', () => {
  // Lazy import to avoid hoisting issues
  let FixGuidancePanel: typeof import('@/app/dashboard/hallucinations/_components/FixGuidancePanel').default;

  beforeEach(async () => {
    const mod = await import('@/app/dashboard/hallucinations/_components/FixGuidancePanel');
    FixGuidancePanel = mod.default;
  });

  it('returns null when category is null', () => {
    const { container } = render(<FixGuidancePanel category={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when category is unknown', () => {
    const { container } = render(<FixGuidancePanel category="unknown_cat" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders data-testid="fix-guidance-panel" for known category', () => {
    render(<FixGuidancePanel category="hours" />);
    expect(screen.getByTestId('fix-guidance-panel')).toBeDefined();
  });

  it('collapsed by default — steps list not visible', () => {
    render(<FixGuidancePanel category="hours" />);
    expect(screen.queryByTestId('fix-guidance-steps')).toBeNull();
  });

  it('toggle button shows "Show fix steps"', () => {
    render(<FixGuidancePanel category="hours" />);
    expect(screen.getByTestId('fix-guidance-toggle')).toBeDefined();
    expect(screen.getByText('Show fix steps')).toBeDefined();
  });

  it('clicking toggle expands the panel', () => {
    render(<FixGuidancePanel category="hours" />);
    fireEvent.click(screen.getByTestId('fix-guidance-toggle'));
    expect(screen.getByTestId('fix-guidance-steps')).toBeDefined();
  });

  it('platform links rendered with target="_blank" after expand', () => {
    render(<FixGuidancePanel category="address" />);
    fireEvent.click(screen.getByTestId('fix-guidance-toggle'));
    const links = screen.getAllByTestId('fix-guidance-platform-link');
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('clicking toggle again collapses the panel', () => {
    render(<FixGuidancePanel category="hours" />);
    fireEvent.click(screen.getByTestId('fix-guidance-toggle'));
    expect(screen.getByTestId('fix-guidance-steps')).toBeDefined();
    fireEvent.click(screen.getByTestId('fix-guidance-toggle'));
    expect(screen.queryByTestId('fix-guidance-steps')).toBeNull();
  });

  it('aria-expanded reflects open state', () => {
    render(<FixGuidancePanel category="hours" />);
    const btn = screen.getByTestId('fix-guidance-toggle');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('works for all 6 supported categories', () => {
    for (const cat of ['hours', 'closed', 'address', 'phone', 'menu', 'cuisine']) {
      const { container, unmount } = render(<FixGuidancePanel category={cat} />);
      expect(container.querySelector('[data-testid="fix-guidance-panel"]')).not.toBeNull();
      unmount();
    }
  });
});

// ── BeforeAfterCard ───────────────────────────────────────────────────────

describe('BeforeAfterCard', () => {
  let BeforeAfterCard: typeof import('@/app/dashboard/hallucinations/_components/BeforeAfterCard').default;

  beforeEach(async () => {
    const mod = await import('@/app/dashboard/hallucinations/_components/BeforeAfterCard');
    BeforeAfterCard = mod.default;
  });

  it('renders data-testid="before-after-card-{id}"', () => {
    render(<BeforeAfterCard alert={makeAlert({ id: 'ba-1', correction_status: 'fixed' })} />);
    expect(screen.getByTestId('before-after-card-ba-1')).toBeDefined();
  });

  it('shows "What AI was saying" with claim_text', () => {
    render(<BeforeAfterCard alert={makeAlert({ correction_status: 'fixed', claim_text: 'Wrong address' })} />);
    expect(screen.getByText('What AI was saying')).toBeDefined();
    expect(screen.getByText('Wrong address')).toBeDefined();
  });

  it('shows "Correct information" section when expected_truth is set', () => {
    render(<BeforeAfterCard alert={makeAlert({ correction_status: 'fixed', expected_truth: 'Correct address' })} />);
    expect(screen.getByText('Correct information')).toBeDefined();
    expect(screen.getByText('Correct address')).toBeDefined();
  });

  it('does not show "Correct information" when expected_truth is null', () => {
    render(<BeforeAfterCard alert={makeAlert({ correction_status: 'fixed', expected_truth: null })} />);
    expect(screen.queryByText('Correct information')).toBeNull();
  });

  it('shows revenue recovered badge when revenue_recovered_monthly > 0', () => {
    render(<BeforeAfterCard alert={makeAlert({ correction_status: 'fixed', revenue_recovered_monthly: 100 })} />);
    expect(screen.getByTestId('revenue-recovered-badge')).toBeDefined();
    expect(screen.getByText('~$100/mo recovered')).toBeDefined();
  });

  it('does not show revenue badge when revenue_recovered_monthly is null', () => {
    render(<BeforeAfterCard alert={makeAlert({ correction_status: 'fixed', revenue_recovered_monthly: null })} />);
    expect(screen.queryByTestId('revenue-recovered-badge')).toBeNull();
  });

  it('does not show revenue badge when revenue_recovered_monthly is 0', () => {
    render(<BeforeAfterCard alert={makeAlert({ correction_status: 'fixed', revenue_recovered_monthly: 0 })} />);
    expect(screen.queryByTestId('revenue-recovered-badge')).toBeNull();
  });

  it('shows "Fixed" status label', () => {
    render(<BeforeAfterCard alert={makeAlert({ correction_status: 'fixed' })} />);
    expect(screen.getByText('Fixed')).toBeDefined();
  });

  it('uses fixed_at for timestamp when available', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    render(<BeforeAfterCard alert={makeAlert({ correction_status: 'fixed', fixed_at: twoDaysAgo, first_detected_at: new Date(Date.now() - 10 * 86_400_000).toISOString() })} />);
    expect(screen.getByText('2 days ago')).toBeDefined();
  });

  it('falls back to first_detected_at when fixed_at is null', () => {
    const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
    render(<BeforeAfterCard alert={makeAlert({ correction_status: 'fixed', fixed_at: null, verified_at: null, first_detected_at: oneDayAgo })} />);
    expect(screen.getByText('yesterday')).toBeDefined();
  });
});

// ── WeeklyKPIChips S15: 4th chip ──────────────────────────────────────────

describe('WeeklyKPIChips — Revenue Recovered chip (S15)', () => {
  let WeeklyKPIChips: typeof import('@/app/dashboard/_components/WeeklyKPIChips').default;

  beforeEach(async () => {
    const mod = await import('@/app/dashboard/_components/WeeklyKPIChips');
    WeeklyKPIChips = mod.default;
  });

  it('renders 4 chips total', () => {
    const { container } = render(
      <WeeklyKPIChips openAlertCount={0} visibilityScore={75} crawlerSummary={null} revenueRecoveredMonthly={100} />,
    );
    const links = container.querySelectorAll('a[role="listitem"]');
    expect(links.length).toBe(4);
  });

  it('4th chip shows Revenue Recovered label', () => {
    render(
      <WeeklyKPIChips openAlertCount={0} visibilityScore={75} crawlerSummary={null} revenueRecoveredMonthly={200} />,
    );
    expect(screen.getByText('Revenue Recovered')).toBeDefined();
  });

  it('shows "$200/mo" when revenueRecoveredMonthly=200', () => {
    render(
      <WeeklyKPIChips openAlertCount={0} visibilityScore={75} crawlerSummary={null} revenueRecoveredMonthly={200} />,
    );
    expect(screen.getByText('$200/mo')).toBeDefined();
  });

  it('shows "None yet" when revenueRecoveredMonthly=0', () => {
    render(
      <WeeklyKPIChips openAlertCount={0} visibilityScore={75} crawlerSummary={null} revenueRecoveredMonthly={0} />,
    );
    expect(screen.getByText('None yet')).toBeDefined();
  });

  it('defaults revenueRecoveredMonthly to 0 when prop omitted', () => {
    render(<WeeklyKPIChips openAlertCount={0} visibilityScore={75} crawlerSummary={null} />);
    expect(screen.getByText('None yet')).toBeDefined();
  });

  it('4th chip links to /dashboard/revenue-impact', () => {
    render(
      <WeeklyKPIChips openAlertCount={0} visibilityScore={75} crawlerSummary={null} revenueRecoveredMonthly={50} />,
    );
    const links = screen.getAllByRole('listitem');
    const revenueLink = links[3] as HTMLAnchorElement;
    expect(revenueLink.getAttribute('href')).toBe('/dashboard/revenue-impact');
  });
});

// ── ScoreAttributionPopover ───────────────────────────────────────────────

describe('ScoreAttributionPopover', () => {
  let ScoreAttributionPopover: typeof import('@/app/dashboard/_components/ScoreAttributionPopover').default;

  beforeEach(async () => {
    const mod = await import('@/app/dashboard/_components/ScoreAttributionPopover');
    ScoreAttributionPopover = mod.default;
  });

  const current = { accuracy_score: 80, visibility_score: 60, data_health_score: 70, reality_score: 72 };
  const previous: ScoreSnapshot = { accuracy_score: 70, visibility_score: 55, data_health_score: 65, reality_score: 63, snapshot_date: '2026-02-28' };

  it('renders data-testid="score-attribution-popover"', () => {
    render(<ScoreAttributionPopover current={current} previous={previous} />);
    expect(screen.getByTestId('score-attribution-popover')).toBeDefined();
  });

  it('trigger shows overall delta +9 (72-63)', () => {
    render(<ScoreAttributionPopover current={current} previous={previous} />);
    expect(screen.getByText('+9')).toBeDefined();
  });

  it('clicking trigger opens the panel', () => {
    render(<ScoreAttributionPopover current={current} previous={previous} />);
    expect(screen.queryByTestId('score-attribution-panel')).toBeNull();
    fireEvent.click(screen.getByTestId('score-attribution-trigger'));
    expect(screen.getByTestId('score-attribution-panel')).toBeDefined();
  });

  it('panel shows component labels', () => {
    render(<ScoreAttributionPopover current={current} previous={previous} />);
    fireEvent.click(screen.getByTestId('score-attribution-trigger'));
    expect(screen.getByText('AI Accuracy')).toBeDefined();
    expect(screen.getByText('AI Visibility')).toBeDefined();
    expect(screen.getByText('Data Health')).toBeDefined();
  });

  it('shows negative delta when score decreased', () => {
    const decreasedCurrent = { ...current, reality_score: 55 };
    render(<ScoreAttributionPopover current={decreasedCurrent} previous={previous} />);
    expect(screen.getByText('-8')).toBeDefined(); // 55-63=-8
  });
});

// ── IntentDiscoverySection ────────────────────────────────────────────────

describe('IntentDiscoverySection', () => {
  let IntentDiscoverySection: typeof import('@/app/dashboard/share-of-voice/_components/IntentDiscoverySection').default;

  beforeEach(async () => {
    const mod = await import('@/app/dashboard/share-of-voice/_components/IntentDiscoverySection');
    IntentDiscoverySection = mod.default;
  });

  const items = [
    { id: '1', prompt: 'Best Italian restaurant near me', opportunity_score: 90, theme: 'local search' },
    { id: '2', prompt: 'Restaurants open on Sunday', opportunity_score: 70, theme: 'hours' },
    { id: '3', prompt: 'Family friendly dining', opportunity_score: 55, theme: 'amenities' },
    { id: '4', prompt: 'Happy hour deals', opportunity_score: 30, theme: 'promotions' },
  ];

  it('returns null when items is empty', () => {
    const { container } = render(<IntentDiscoverySection items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders data-testid="intent-discovery-section"', () => {
    render(<IntentDiscoverySection items={items} />);
    expect(screen.getByTestId('intent-discovery-section')).toBeDefined();
  });

  it('shows at most 3 items even when more are provided', () => {
    render(<IntentDiscoverySection items={items} />);
    const list = screen.getByTestId('intent-discovery-list');
    expect(list.children.length).toBe(3);
  });

  it('renders first item prompt text', () => {
    render(<IntentDiscoverySection items={items} />);
    expect(screen.getByText('Best Italian restaurant near me')).toBeDefined();
  });

  it('"See all" link points to /dashboard/intent-discovery', () => {
    render(<IntentDiscoverySection items={items} />);
    const link = screen.getByTestId('intent-discovery-see-all') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/dashboard/intent-discovery');
  });

  it('shows section heading', () => {
    render(<IntentDiscoverySection items={items} />);
    expect(screen.getByText(/Questions Customers Ask/)).toBeDefined();
  });

  it('renders each visible item with testid', () => {
    render(<IntentDiscoverySection items={items} />);
    expect(screen.getByTestId('intent-discovery-item-1')).toBeDefined();
    expect(screen.getByTestId('intent-discovery-item-2')).toBeDefined();
    expect(screen.getByTestId('intent-discovery-item-3')).toBeDefined();
    // 4th item should NOT render
    expect(screen.queryByTestId('intent-discovery-item-4')).toBeNull();
  });
});
