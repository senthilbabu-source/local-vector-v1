// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HallucinationRow } from '@/lib/data/dashboard';
import type { CrawlerSummary, BotActivity, BlindSpot } from '@/lib/data/crawler-analytics';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => <span data-testid="sparkles-icon">sparkles</span>,
}));

import TopIssuesPanel from '@/app/dashboard/_components/TopIssuesPanel';

function makeAlert(overrides: Partial<HallucinationRow> = {}): HallucinationRow {
  return {
    id: 'test-id',
    severity: 'critical',
    category: 'hours',
    model_provider: 'openai-gpt4o',
    claim_text: 'Closes at 10pm',
    expected_truth: 'Open until 2am',
    correction_status: 'open',
    first_detected_at: '2026-02-20T00:00:00Z',
    last_seen_at: '2026-02-25T00:00:00Z',
    occurrence_count: 1,
    follow_up_result: null,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<CrawlerSummary> = {}): CrawlerSummary {
  return {
    bots: [],
    totalVisits: 0,
    blindSpots: [],
    blindSpotCount: 0,
    ...overrides,
  };
}

describe('TopIssuesPanel', () => {
  // ── With issues ───────────────────────────────────────────────────────

  it('renders up to 5 issue rows', () => {
    const alerts = Array.from({ length: 3 }, (_, i) =>
      makeAlert({ id: `alert-${i}` }),
    );
    render(<TopIssuesPanel alerts={alerts} crawlerSummary={null} sampleMode={false} />);
    const rows = screen.getAllByTestId(/^top-issue-row-/);
    expect(rows.length).toBe(3);
  });

  it('never renders more than 5 rows even when more than 5 issues passed', () => {
    const alerts = Array.from({ length: 8 }, (_, i) =>
      makeAlert({ id: `alert-${i}` }),
    );
    render(<TopIssuesPanel alerts={alerts} crawlerSummary={null} sampleMode={false} />);
    const rows = screen.getAllByTestId(/^top-issue-row-/);
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it('critical issues appear before warning issues', () => {
    const alerts = [
      makeAlert({ id: 'warn', severity: 'medium', category: 'menu', claim_text: 'Wrong menu' }),
      makeAlert({ id: 'crit', severity: 'critical', category: 'hours', claim_text: 'Wrong hours' }),
    ];
    render(<TopIssuesPanel alerts={alerts} crawlerSummary={null} sampleMode={false} />);
    const rows = screen.getAllByTestId(/^top-issue-row-/);
    // Critical should be first
    expect(rows[0].textContent).toContain('Wrong hours');
  });

  it('each row has data-testid="top-issue-row-{index}"', () => {
    render(
      <TopIssuesPanel
        alerts={[makeAlert()]}
        crawlerSummary={null}
        sampleMode={false}
      />,
    );
    expect(screen.getByTestId('top-issue-row-0')).toBeDefined();
  });

  it('"Fix with AI" button present for issues with fixLabel=Fix with AI', () => {
    render(
      <TopIssuesPanel
        alerts={[makeAlert({ category: 'hours' })]}
        crawlerSummary={null}
        sampleMode={false}
      />,
    );
    expect(screen.getByTestId('top-issue-fix-0')).toBeDefined();
    expect(screen.getByTestId('top-issue-fix-0').textContent).toContain('Fix with AI');
  });

  it('"How to fix" link present for technical findings', () => {
    const blindSpot: BlindSpot = {
      botType: 'claudebot',
      label: 'ClaudeBot',
      engine: 'Claude',
      fixRecommendation: 'Allow ClaudeBot in robots.txt',
    };
    render(
      <TopIssuesPanel
        alerts={[]}
        crawlerSummary={makeSummary({ blindSpots: [blindSpot], blindSpotCount: 1 })}
        sampleMode={false}
      />,
    );
    expect(screen.getByTestId('top-issue-how-0')).toBeDefined();
    expect(screen.getByTestId('top-issue-how-0').textContent).toContain('How to fix');
  });

  it('"View all" link present when displayIssues.length > 0', () => {
    render(
      <TopIssuesPanel
        alerts={[makeAlert()]}
        crawlerSummary={null}
        sampleMode={false}
      />,
    );
    expect(screen.getByTestId('top-issues-view-all')).toBeDefined();
  });

  it('"View all" links to /dashboard/hallucinations', () => {
    render(
      <TopIssuesPanel
        alerts={[makeAlert()]}
        crawlerSummary={null}
        sampleMode={false}
      />,
    );
    expect(screen.getByTestId('top-issues-view-all').getAttribute('href')).toBe(
      '/dashboard/hallucinations',
    );
  });

  // ── Empty state ───────────────────────────────────────────────────────

  it('data-testid="top-issues-empty" visible when no issues', () => {
    render(<TopIssuesPanel alerts={[]} crawlerSummary={null} sampleMode={false} />);
    expect(screen.getByTestId('top-issues-empty')).toBeDefined();
  });

  it('empty state shows "No issues found" text', () => {
    render(<TopIssuesPanel alerts={[]} crawlerSummary={null} sampleMode={false} />);
    expect(screen.getByTestId('top-issues-empty').textContent).toContain('No issues found');
  });

  it('"View all" link hidden when no issues', () => {
    render(<TopIssuesPanel alerts={[]} crawlerSummary={null} sampleMode={false} />);
    expect(screen.queryByTestId('top-issues-view-all')).toBeNull();
  });

  // ── Sample mode ───────────────────────────────────────────────────────

  it('when sampleMode=true, shows sample issues (not the passed alerts)', () => {
    render(
      <TopIssuesPanel
        alerts={[]}
        crawlerSummary={null}
        sampleMode={true}
      />,
    );
    const rows = screen.getAllByTestId(/^top-issue-row-/);
    expect(rows.length).toBeGreaterThan(0);
    // First sample issue is about hours
    expect(rows[0].textContent).toContain('ChatGPT');
  });

  it('when sampleMode=true, renders sample disclaimer text at bottom', () => {
    render(
      <TopIssuesPanel
        alerts={[]}
        crawlerSummary={null}
        sampleMode={true}
      />,
    );
    expect(screen.getByText(/Sample issues shown/)).toBeDefined();
  });

  it('when sampleMode=false with empty alerts, shows empty state', () => {
    render(<TopIssuesPanel alerts={[]} crawlerSummary={null} sampleMode={false} />);
    expect(screen.getByTestId('top-issues-empty')).toBeDefined();
  });
});
