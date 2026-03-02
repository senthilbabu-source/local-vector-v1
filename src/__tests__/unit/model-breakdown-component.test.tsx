/**
 * Sprint 123 — ModelBreakdownPanel + ModelCitationBadge RTL tests
 * @vitest-environment jsdom
 * AI_RULES §154.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ModelBreakdownPanel from '@/app/dashboard/share-of-voice/_components/ModelBreakdownPanel';
import ModelCitationBadge from '@/app/dashboard/share-of-voice/_components/ModelCitationBadge';
import {
  MOCK_MODEL_BREAKDOWN_RESPONSE,
} from '@/src/__fixtures__/golden-tenant';

// ── Tests: ModelBreakdownPanel ───────────────────────────────────────────────

describe('ModelBreakdownPanel — RTL', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loading state shows skeleton', async () => {
    // fetch never resolves
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(
      <ModelBreakdownPanel
        queryId="query-001"
        queryText="best hookah lounge"
        orgName="Charcoal N Chill"
      />,
    );

    // Click to open
    fireEvent.click(screen.getByTestId('model-breakdown-toggle'));

    // Should show loading skeletons (pulse animation divs)
    await waitFor(() => {
      const panel = screen.getByTestId('model-breakdown-panel');
      expect(panel.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  it('no data state: "Run a scan to see per-model results"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        ...MOCK_MODEL_BREAKDOWN_RESPONSE,
        models: [],
        summary: { cited_by_count: 0, total_models_run: 0, all_models_agree: true },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));

    render(
      <ModelBreakdownPanel
        queryId="query-001"
        queryText="best hookah lounge"
        orgName="Charcoal N Chill"
      />,
    );

    fireEvent.click(screen.getByTestId('model-breakdown-toggle'));

    await waitFor(() => {
      expect(screen.getByText('Run a scan to see per-model results.')).toBeTruthy();
    });
  });

  it('renders one ModelCitationBadge per model in data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(MOCK_MODEL_BREAKDOWN_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));

    render(
      <ModelBreakdownPanel
        queryId="query-001"
        queryText="best hookah lounge"
        orgName="Charcoal N Chill"
      />,
    );

    fireEvent.click(screen.getByTestId('model-breakdown-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('model-badge-perplexity_sonar')).toBeTruthy();
      expect(screen.getByTestId('model-badge-openai_gpt4o_mini')).toBeTruthy();
      expect(screen.getByTestId('model-badge-gemini_flash')).toBeTruthy();
    });
  });

  it('summary text: "2 of 3 AI models mention {orgName}"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(MOCK_MODEL_BREAKDOWN_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));

    render(
      <ModelBreakdownPanel
        queryId="query-001"
        queryText="best hookah lounge"
        orgName="Charcoal N Chill"
      />,
    );

    fireEvent.click(screen.getByTestId('model-breakdown-toggle'));

    await waitFor(() => {
      const summary = screen.getByTestId('model-breakdown-summary');
      expect(summary.textContent).toContain('2 of 3');
      expect(summary.textContent).toContain('Charcoal N Chill');
    });
  });

  it('"View AI Response" toggle expands response excerpt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(MOCK_MODEL_BREAKDOWN_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ));

    render(
      <ModelBreakdownPanel
        queryId="query-001"
        queryText="best hookah lounge"
        orgName="Charcoal N Chill"
      />,
    );

    fireEvent.click(screen.getByTestId('model-breakdown-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('model-response-toggle-perplexity_sonar')).toBeTruthy();
    });

    // Click to expand
    fireEvent.click(screen.getByTestId('model-response-toggle-perplexity_sonar'));

    await waitFor(() => {
      expect(screen.getByTestId('model-response-text-perplexity_sonar')).toBeTruthy();
    });
  });
});

// ── Tests: ModelCitationBadge ────────────────────────────────────────────────

describe('ModelCitationBadge — RTL', () => {
  it('cited + high → green + "Mentioned {N}x"', () => {
    render(
      <ModelCitationBadge
        model_provider="perplexity_sonar"
        display_name="Perplexity"
        cited={true}
        citation_count={3}
        confidence="high"
      />,
    );

    const badge = screen.getByTestId('model-badge-perplexity_sonar');
    expect(badge.textContent).toContain('Mentioned 3x');
    expect(badge.textContent).toContain('Perplexity');
  });

  it('cited + medium → yellow + "Possibly mentioned"', () => {
    render(
      <ModelCitationBadge
        model_provider="openai_gpt4o_mini"
        display_name="ChatGPT"
        cited={true}
        citation_count={1}
        confidence="medium"
      />,
    );

    const badge = screen.getByTestId('model-badge-openai_gpt4o_mini');
    expect(badge.textContent).toContain('Possibly mentioned');
  });

  it('not cited → "Not mentioned"', () => {
    render(
      <ModelCitationBadge
        model_provider="gemini_flash"
        display_name="Gemini"
        cited={false}
        citation_count={0}
        confidence="high"
      />,
    );

    const badge = screen.getByTestId('model-badge-gemini_flash');
    expect(badge.textContent).toContain('Not mentioned');
  });
});
