// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// ai-responses-google.test.tsx — Unit tests for Google AI Overview in AI Says
//
// Sprint 74: Tests EngineResponseBlock renders Google engine tab, citation
// sources display, and hides citations appropriately.
//
// Run:
//   npx vitest run src/__tests__/unit/ai-responses-google.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EngineResponseBlock from '@/app/dashboard/ai-responses/_components/EngineResponseBlock';
import { MOCK_SOV_RESPONSE } from '@/src/__fixtures__/golden-tenant';

// ── AI Says — Google AI Overview ────────────────────────────────────────

describe('AI Says — Google AI Overview', () => {
  const googleEngine = MOCK_SOV_RESPONSE.engines.find((e) => e.engine === 'google')!;

  it('renders "Google AI Overview" label when google engine data present', () => {
    render(
      <EngineResponseBlock
        engine="google"
        rankPosition={1}
        rawResponse="Charcoal N Chill is a top hookah bar."
        mentionedCompetitors={[]}
        citedSources={[
          { url: 'https://yelp.com', title: 'Yelp' },
        ]}
        createdAt="2026-02-26T12:00:00.000Z"
      />,
    );

    expect(screen.getByText('Google AI Overview')).toBeTruthy();
  });

  it('shows response text for google engine', () => {
    render(
      <EngineResponseBlock
        engine="google"
        rankPosition={1}
        rawResponse={googleEngine.rawResponse}
        mentionedCompetitors={[...googleEngine.mentionedCompetitors]}
        citedSources={[...googleEngine.citedSources]}
        createdAt={googleEngine.createdAt}
      />,
    );

    expect(screen.getByText(/Indo-American fusion cuisine/)).toBeTruthy();
  });

  it('shows "Sources Google Cited" section when citedSources is non-empty', () => {
    render(
      <EngineResponseBlock
        engine="google"
        rankPosition={1}
        rawResponse="Charcoal N Chill is great."
        mentionedCompetitors={[]}
        citedSources={[
          { url: 'https://yelp.com/biz/cnc', title: 'Yelp' },
          { url: 'https://g.co/cnc', title: 'Google Maps' },
        ]}
        createdAt="2026-02-26T12:00:00.000Z"
      />,
    );

    expect(screen.getByText('Sources Google Cited')).toBeTruthy();
  });

  it('renders source URLs as clickable links', () => {
    render(
      <EngineResponseBlock
        engine="google"
        rankPosition={1}
        rawResponse="Charcoal N Chill is great."
        mentionedCompetitors={[]}
        citedSources={[
          { url: 'https://yelp.com/biz/cnc', title: 'Yelp Review' },
        ]}
        createdAt="2026-02-26T12:00:00.000Z"
      />,
    );

    const link = screen.getByRole('link', { name: 'Yelp Review' });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://yelp.com/biz/cnc');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('hides citation section when citedSources is null', () => {
    render(
      <EngineResponseBlock
        engine="google"
        rankPosition={1}
        rawResponse="Charcoal N Chill is great."
        mentionedCompetitors={[]}
        citedSources={null}
        createdAt="2026-02-26T12:00:00.000Z"
      />,
    );

    expect(screen.queryByText('Sources Google Cited')).toBeNull();
  });

  it('hides citation section when citedSources is empty array', () => {
    render(
      <EngineResponseBlock
        engine="google"
        rankPosition={1}
        rawResponse="Charcoal N Chill is great."
        mentionedCompetitors={[]}
        citedSources={[]}
        createdAt="2026-02-26T12:00:00.000Z"
      />,
    );

    expect(screen.queryByText('Sources Google Cited')).toBeNull();
  });

  it('does not show citation section for non-Google engines', () => {
    render(
      <EngineResponseBlock
        engine="openai"
        rankPosition={2}
        rawResponse="Here are some BBQ restaurants."
        mentionedCompetitors={['Dreamland BBQ']}
        createdAt="2026-02-26T12:00:00.000Z"
      />,
    );

    expect(screen.queryByText('Sources Google Cited')).toBeNull();
  });
});
