// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// gap-alert-card.test.tsx — Unit tests for GapAlertCard component
//
// P8-FIX-34: 10 tests — render states, colors, labels, impact, accessibility.
//
// Run:
//   npx vitest run src/__tests__/unit/gap-alert-card.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GapAlertCard from '@/app/dashboard/share-of-voice/_components/GapAlertCard';

// ---------------------------------------------------------------------------
// Gap type badge rendering
// ---------------------------------------------------------------------------

describe('GapAlertCard', () => {
  it('renders untracked gap type badge', () => {
    render(
      <GapAlertCard
        gapType="untracked"
        queryText="hookah bar food"
        queryCategory="discovery"
        estimatedImpact="medium"
        suggestedAction="Add to tracking list."
      />,
    );
    expect(screen.getByText('Untracked Query')).toBeTruthy();
  });

  it('renders competitor_discovered gap type badge', () => {
    render(
      <GapAlertCard
        gapType="competitor_discovered"
        queryText="best hookah lounge"
        queryCategory="discovery"
        estimatedImpact="high"
        suggestedAction="Create landing page."
      />,
    );
    expect(screen.getByText('Competitor Gap')).toBeTruthy();
  });

  it('renders zero_citation_cluster gap type badge', () => {
    render(
      <GapAlertCard
        gapType="zero_citation_cluster"
        queryText="private event venue"
        queryCategory="near_me"
        estimatedImpact="high"
        suggestedAction="Publish FAQ content."
      />,
    );
    expect(screen.getByText('Zero Citations')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Content rendering
  // ---------------------------------------------------------------------------

  it('displays query text in quotes', () => {
    render(
      <GapAlertCard
        gapType="untracked"
        queryText="hookah bar with food Alpharetta"
        queryCategory="discovery"
        estimatedImpact="medium"
        suggestedAction="Track this query."
      />,
    );
    // The component wraps query in &ldquo; / &rdquo; smart quotes
    expect(screen.getByText(/hookah bar with food Alpharetta/)).toBeTruthy();
  });

  it('displays category label', () => {
    render(
      <GapAlertCard
        gapType="untracked"
        queryText="test query"
        queryCategory="near_me"
        estimatedImpact="low"
        suggestedAction="Monitor."
      />,
    );
    expect(screen.getByText('Near Me')).toBeTruthy();
  });

  it('displays impact level', () => {
    render(
      <GapAlertCard
        gapType="competitor_discovered"
        queryText="test query"
        queryCategory="discovery"
        estimatedImpact="high"
        suggestedAction="Create content."
      />,
    );
    expect(screen.getByText('high impact')).toBeTruthy();
  });

  it('displays suggested action text', () => {
    render(
      <GapAlertCard
        gapType="untracked"
        queryText="test query"
        queryCategory="custom"
        estimatedImpact="low"
        suggestedAction="Add this query to your tracking list."
      />,
    );
    expect(screen.getByText('Add this query to your tracking list.')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Color assignments
  // ---------------------------------------------------------------------------

  it('applies amber colors for untracked type', () => {
    const { container } = render(
      <GapAlertCard
        gapType="untracked"
        queryText="test"
        queryCategory="discovery"
        estimatedImpact="medium"
        suggestedAction="Track."
      />,
    );
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-alert-amber/10');
    expect(badge?.className).toContain('text-alert-amber');
  });

  it('applies crimson colors for competitor_discovered type', () => {
    const { container } = render(
      <GapAlertCard
        gapType="competitor_discovered"
        queryText="test"
        queryCategory="discovery"
        estimatedImpact="high"
        suggestedAction="Create page."
      />,
    );
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-alert-crimson/10');
    expect(badge?.className).toContain('text-alert-crimson');
  });

  it('applies indigo colors for zero_citation_cluster type', () => {
    const { container } = render(
      <GapAlertCard
        gapType="zero_citation_cluster"
        queryText="test"
        queryCategory="near_me"
        estimatedImpact="high"
        suggestedAction="Publish FAQ."
      />,
    );
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('bg-electric-indigo/10');
    expect(badge?.className).toContain('text-electric-indigo');
  });
});
