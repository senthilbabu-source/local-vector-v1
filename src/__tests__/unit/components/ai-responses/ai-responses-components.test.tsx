// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// ai-responses-components.test.tsx — Sprint 69: "AI Says" component tests
//
// Tests for EngineResponseBlock, ResponseCard, and ResponseLibrary.
//
// Run: npx vitest run src/__tests__/unit/components/ai-responses/ai-responses-components.test.tsx
// ---------------------------------------------------------------------------

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MOCK_SOV_RESPONSE } from '@/__fixtures__/golden-tenant';

import EngineResponseBlock from '@/app/dashboard/ai-responses/_components/EngineResponseBlock';
import ResponseCard from '@/app/dashboard/ai-responses/_components/ResponseCard';

// ---------------------------------------------------------------------------
// EngineResponseBlock tests
// ---------------------------------------------------------------------------

describe('EngineResponseBlock', () => {
  it('renders plain text raw_response', () => {
    render(
      <EngineResponseBlock
        engine="openai"
        rankPosition={2}
        rawResponse="Here are some great BBQ restaurants in Alpharetta."
        mentionedCompetitors={[]}
        createdAt="2026-02-26T12:00:00Z"
      />,
    );

    expect(screen.getByText(/Here are some great BBQ restaurants/)).toBeDefined();
    expect(screen.getByText('#2 Ranked')).toBeDefined();
    expect(screen.getByText('ChatGPT')).toBeDefined();
  });

  it('renders "No response recorded" when rawResponse is null and ranked', () => {
    render(
      <EngineResponseBlock
        engine="openai"
        rankPosition={1}
        rawResponse={null}
        mentionedCompetitors={[]}
        createdAt="2026-02-26T12:00:00Z"
      />,
    );

    expect(screen.getByText('No response recorded')).toBeDefined();
  });

  it('renders "Not mentioned" when rankPosition is null and no response', () => {
    render(
      <EngineResponseBlock
        engine="perplexity"
        rankPosition={null}
        rawResponse={null}
        mentionedCompetitors={[]}
        createdAt="2026-02-26T12:00:00Z"
      />,
    );

    expect(screen.getByText('Not mentioned')).toBeDefined();
    expect(screen.getByText('Not mentioned by this engine')).toBeDefined();
    expect(screen.getByText('Perplexity')).toBeDefined();
  });

  it('truncates long responses and shows expand button', () => {
    const longText = 'A'.repeat(300);
    render(
      <EngineResponseBlock
        engine="openai"
        rankPosition={1}
        rawResponse={longText}
        mentionedCompetitors={[]}
        createdAt="2026-02-26T12:00:00Z"
      />,
    );

    // Should show truncated text (200 chars + ellipsis)
    expect(screen.getByText(/A{10,}…/)).toBeDefined();
    expect(screen.getByText('Show full response')).toBeDefined();

    // Click expand
    fireEvent.click(screen.getByText('Show full response'));
    expect(screen.getByText(longText)).toBeDefined();
    expect(screen.getByText('Collapse')).toBeDefined();
  });

  it('renders competitor pills when mentionedCompetitors has entries', () => {
    render(
      <EngineResponseBlock
        engine="openai"
        rankPosition={2}
        rawResponse="Some response"
        mentionedCompetitors={['Dreamland BBQ', 'Cloud 9 Lounge']}
        createdAt="2026-02-26T12:00:00Z"
      />,
    );

    expect(screen.getByText('Dreamland BBQ')).toBeDefined();
    expect(screen.getByText('Cloud 9 Lounge')).toBeDefined();
    expect(screen.getByText('Competitors:')).toBeDefined();
  });

  it('handles JSON raw_response (structured format) with appropriate message', () => {
    const json = JSON.stringify({
      businesses: ['Dreamland BBQ', 'Charcoal N Chill'],
      cited_url: 'https://example.com',
    });

    render(
      <EngineResponseBlock
        engine="openai"
        rankPosition={2}
        rawResponse={json}
        mentionedCompetitors={[]}
        createdAt="2026-02-26T12:00:00Z"
      />,
    );

    expect(
      screen.getByText(/Structured data only/),
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ResponseCard tests
// ---------------------------------------------------------------------------

describe('ResponseCard', () => {
  const entry = {
    queryId: MOCK_SOV_RESPONSE.queryId,
    queryText: MOCK_SOV_RESPONSE.queryText,
    queryCategory: MOCK_SOV_RESPONSE.queryCategory,
    engines: MOCK_SOV_RESPONSE.engines.map((e) => ({
      engine: e.engine,
      rankPosition: e.rankPosition,
      rawResponse: e.rawResponse,
      mentionedCompetitors: [...e.mentionedCompetitors],
      createdAt: e.createdAt,
    })),
    latestDate: MOCK_SOV_RESPONSE.latestDate,
  };

  it('renders query text in quotes', () => {
    render(<ResponseCard entry={entry} />);

    expect(
      screen.getByText((content) => content.includes('Best BBQ restaurant in Alpharetta GA')),
    ).toBeDefined();
  });

  it('renders category badge', () => {
    render(<ResponseCard entry={entry} />);

    expect(screen.getByText('Discovery')).toBeDefined();
  });

  it('renders engine blocks for each engine in entry', () => {
    render(<ResponseCard entry={entry} />);

    expect(screen.getByText('ChatGPT')).toBeDefined();
    expect(screen.getByText('Perplexity')).toBeDefined();
  });

  it('renders last checked date', () => {
    render(<ResponseCard entry={entry} />);

    expect(screen.getByText(/Last checked:/)).toBeDefined();
  });

  it('renders response text from engines', () => {
    render(<ResponseCard entry={entry} />);

    expect(screen.getByText(/Dreamland BBQ — a beloved regional chain/)).toBeDefined();
    expect(screen.getByText(/Charcoal N Chill stands out/)).toBeDefined();
  });
});
