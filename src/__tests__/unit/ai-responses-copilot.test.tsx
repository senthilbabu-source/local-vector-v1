// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// ai-responses-copilot.test.tsx — Unit tests for Microsoft Copilot in AI Says
//
// Sprint 79: Tests EngineResponseBlock renders Copilot engine tab,
// insight box display, and hides insight for non-Copilot engines.
//
// Run:
//   npx vitest run src/__tests__/unit/ai-responses-copilot.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EngineResponseBlock from '@/app/dashboard/ai-responses/_components/EngineResponseBlock';
import { MOCK_SOV_RESPONSE } from '@/src/__fixtures__/golden-tenant';

// ── AI Says — Microsoft Copilot ─────────────────────────────────────────

describe('AI Says — Microsoft Copilot', () => {
  const copilotEngine = MOCK_SOV_RESPONSE.engines.find((e) => e.engine === 'copilot')!;

  it('renders "Microsoft Copilot" label when copilot engine data present', () => {
    render(
      <EngineResponseBlock
        engine="copilot"
        rankPosition={2}
        rawResponse="Based on Bing Places, Charcoal N Chill is a top hookah bar."
        mentionedCompetitors={[]}
        createdAt="2026-02-26T12:15:00.000Z"
      />,
    );

    expect(screen.getByText('Microsoft Copilot')).toBeTruthy();
  });

  it('shows response text for copilot engine', () => {
    render(
      <EngineResponseBlock
        engine="copilot"
        rankPosition={copilotEngine.rankPosition}
        rawResponse={copilotEngine.rawResponse}
        mentionedCompetitors={[...copilotEngine.mentionedCompetitors]}
        createdAt={copilotEngine.createdAt}
      />,
    );

    expect(screen.getByText(/Indo-American fusion cuisine/)).toBeTruthy();
  });

  it('shows Copilot insight box about Bing Places/Yelp', () => {
    render(
      <EngineResponseBlock
        engine="copilot"
        rankPosition={2}
        rawResponse="Charcoal N Chill is recommended based on Bing data."
        mentionedCompetitors={[]}
        createdAt="2026-02-26T12:15:00.000Z"
      />,
    );

    expect(screen.getByText('Copilot Insight:')).toBeTruthy();
    expect(screen.getByText(/Bing Places listing and Yelp profile/)).toBeTruthy();
  });

  it('does not show Copilot insight box for non-copilot engines', () => {
    render(
      <EngineResponseBlock
        engine="openai"
        rankPosition={2}
        rawResponse="Here are some BBQ restaurants."
        mentionedCompetitors={['Dreamland BBQ']}
        createdAt="2026-02-26T12:00:00.000Z"
      />,
    );

    expect(screen.queryByText('Copilot Insight:')).toBeNull();
  });

  it('does not show Copilot insight box for google engine', () => {
    render(
      <EngineResponseBlock
        engine="google"
        rankPosition={1}
        rawResponse="Charcoal N Chill is great."
        mentionedCompetitors={[]}
        citedSources={[]}
        createdAt="2026-02-26T12:10:00.000Z"
      />,
    );

    expect(screen.queryByText('Copilot Insight:')).toBeNull();
  });
});
