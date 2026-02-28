// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// src/__tests__/unit/sentiment-interpretation-panel.test.tsx
// Sprint I: SentimentInterpretationPanel tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentimentInterpretationPanel } from '@/app/dashboard/sentiment/_components/SentimentInterpretationPanel';
import type { SentimentSummary } from '@/lib/services/sentiment.service';

function makeSummary(overrides: Partial<SentimentSummary> = {}): SentimentSummary {
  return {
    averageScore: 0.5,
    dominantLabel: 'positive',
    dominantTone: 'positive',
    topPositive: ['great food', 'friendly staff'],
    topNegative: [],
    byEngine: {
      openai: {
        averageScore: 0.6,
        label: 'positive',
        tone: 'positive',
        descriptors: { positive: ['great food'], negative: [] },
      },
      perplexity: {
        averageScore: 0.3,
        label: 'positive',
        tone: 'matter_of_fact',
        descriptors: { positive: ['decent'], negative: [] },
      },
    },
    evaluationCount: 10,
    ...overrides,
  };
}

describe('SentimentInterpretationPanel', () => {
  it('renders nothing when evaluationCount is 0', () => {
    const { container } = render(
      <SentimentInterpretationPanel summary={makeSummary({ evaluationCount: 0 })} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the panel when data exists', () => {
    render(<SentimentInterpretationPanel summary={makeSummary()} />);
    expect(screen.getByTestId('sentiment-interpretation-panel')).toBeDefined();
  });

  it('shows positive verdict for high average score', () => {
    render(<SentimentInterpretationPanel summary={makeSummary({ averageScore: 0.65 })} />);
    const verdict = screen.getByTestId('sentiment-overall-verdict');
    expect(verdict.textContent).toContain('positively');
  });

  it('shows mixed verdict for middling average score', () => {
    render(<SentimentInterpretationPanel summary={makeSummary({ averageScore: 0.1 })} />);
    const verdict = screen.getByTestId('sentiment-overall-verdict');
    expect(verdict.textContent).toContain('mixed sentiment');
  });

  it('shows negative verdict for low average score', () => {
    render(<SentimentInterpretationPanel summary={makeSummary({ averageScore: -0.5 })} />);
    const verdict = screen.getByTestId('sentiment-overall-verdict');
    expect(verdict.textContent).toContain('negatively');
  });

  it('renders model breakdown rows', () => {
    render(<SentimentInterpretationPanel summary={makeSummary()} />);
    expect(screen.getByTestId('sentiment-model-breakdown')).toBeDefined();
    expect(screen.getByTestId('sentiment-model-row-openai')).toBeDefined();
    expect(screen.getByTestId('sentiment-model-row-perplexity')).toBeDefined();
  });

  it('shows "Needs attention" badge for engines below -0.3', () => {
    const summary = makeSummary({
      averageScore: -0.1,
      byEngine: {
        openai: {
          averageScore: 0.4,
          label: 'positive',
          tone: 'positive',
          descriptors: { positive: ['good'], negative: [] },
        },
        perplexity: {
          averageScore: -0.5,
          label: 'negative',
          tone: 'negative',
          descriptors: { positive: [], negative: ['outdated'] },
        },
      },
    });
    render(<SentimentInterpretationPanel summary={summary} />);
    const row = screen.getByTestId('sentiment-model-row-perplexity');
    expect(row.textContent).toContain('Needs attention');
  });

  it('shows worst model callout when worst engine is below -0.3', () => {
    const summary = makeSummary({
      averageScore: -0.1,
      byEngine: {
        openai: {
          averageScore: 0.4,
          label: 'positive',
          tone: 'positive',
          descriptors: { positive: [], negative: [] },
        },
        perplexity: {
          averageScore: -0.5,
          label: 'negative',
          tone: 'negative',
          descriptors: { positive: [], negative: [] },
        },
      },
    });
    render(<SentimentInterpretationPanel summary={summary} />);
    expect(screen.getByTestId('sentiment-worst-model-callout')).toBeDefined();
    expect(screen.getByTestId('sentiment-fix-alerts-link')).toBeDefined();
  });

  it('does not show worst model callout when all engines are positive', () => {
    render(<SentimentInterpretationPanel summary={makeSummary()} />);
    expect(screen.queryByTestId('sentiment-worst-model-callout')).toBeNull();
  });

  it('renders nothing when byEngine is empty', () => {
    const { container } = render(
      <SentimentInterpretationPanel summary={makeSummary({ byEngine: {}, evaluationCount: 5 })} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('displays engine display names correctly', () => {
    render(<SentimentInterpretationPanel summary={makeSummary()} />);
    expect(screen.getByTestId('sentiment-model-row-openai').textContent).toContain('ChatGPT');
    expect(screen.getByTestId('sentiment-model-row-perplexity').textContent).toContain('Perplexity');
  });
});
