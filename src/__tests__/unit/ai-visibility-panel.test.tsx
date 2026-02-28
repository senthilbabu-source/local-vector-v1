// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/components/ui/InfoTooltip', () => ({
  InfoTooltip: ({ content }: { content: string }) => (
    <button data-testid="info-tooltip-trigger" aria-label={content}>i</button>
  ),
}));

import AIVisibilityPanel from '@/app/dashboard/_components/panels/AIVisibilityPanel';

describe('AIVisibilityPanel', () => {
  it('renders score number when score is not null', () => {
    render(<AIVisibilityPanel score={72} previousScore={null} benchmark={null} orgCity={null} />);
    expect(screen.getByTestId('ai-visibility-score').textContent).toBe('72');
  });

  it('renders dash when score is null', () => {
    render(<AIVisibilityPanel score={null} previousScore={null} benchmark={null} orgCity={null} />);
    expect(screen.getByTestId('ai-visibility-score').textContent).toBe('—');
  });

  it('renders positive delta in emerald when score > previousScore', () => {
    render(<AIVisibilityPanel score={75} previousScore={71} benchmark={null} orgCity={null} />);
    const delta = screen.getByTestId('ai-visibility-delta');
    expect(delta.textContent).toContain('+4');
    expect(delta.className).toContain('emerald');
  });

  it('renders negative delta in crimson when score < previousScore', () => {
    render(<AIVisibilityPanel score={68} previousScore={72} benchmark={null} orgCity={null} />);
    const delta = screen.getByTestId('ai-visibility-delta');
    expect(delta.textContent).toContain('-4');
    expect(delta.className).toContain('crimson');
  });

  it('renders no delta when previousScore is null', () => {
    render(<AIVisibilityPanel score={75} previousScore={null} benchmark={null} orgCity={null} />);
    expect(screen.queryByTestId('ai-visibility-delta')).toBeNull();
  });

  it('renders "above avg" when benchmark ready and score > avg', () => {
    render(
      <AIVisibilityPanel
        score={80}
        previousScore={null}
        benchmark={{ org_count: 15, avg_score: 65, min_score: 40, max_score: 95 }}
        orgCity="Atlanta"
      />,
    );
    const el = screen.getByTestId('ai-visibility-benchmark');
    expect(el.textContent).toContain('15 above Atlanta avg');
  });

  it('renders "below avg" when benchmark ready and score < avg', () => {
    render(
      <AIVisibilityPanel
        score={50}
        previousScore={null}
        benchmark={{ org_count: 12, avg_score: 65, min_score: 40, max_score: 95 }}
        orgCity="Austin"
      />,
    );
    const el = screen.getByTestId('ai-visibility-benchmark');
    expect(el.textContent).toContain('15 below Austin avg');
  });

  it('renders "Building benchmark..." when benchmark is null', () => {
    render(<AIVisibilityPanel score={72} previousScore={null} benchmark={null} orgCity={null} />);
    const el = screen.getByTestId('ai-visibility-benchmark');
    expect(el.textContent).toContain('Building benchmark');
  });

  it('renders "Building benchmark..." when benchmark.org_count < 10', () => {
    render(
      <AIVisibilityPanel
        score={72}
        previousScore={null}
        benchmark={{ org_count: 5, avg_score: 60, min_score: 40, max_score: 80 }}
        orgCity="Denver"
      />,
    );
    const el = screen.getByTestId('ai-visibility-benchmark');
    expect(el.textContent).toContain('Building benchmark');
  });

  it('renders InfoTooltip trigger', () => {
    render(<AIVisibilityPanel score={72} previousScore={null} benchmark={null} orgCity={null} />);
    expect(screen.getByTestId('info-tooltip-trigger')).toBeDefined();
  });
});
