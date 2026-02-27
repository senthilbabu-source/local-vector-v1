// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// generate-brief-button.test.tsx — Unit tests for GenerateBriefButton component
//
// Sprint 86: 4 tests — render states, loading, test-id.
//
// Run:
//   npx vitest run src/__tests__/unit/generate-brief-button.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GenerateBriefButton from '@/app/dashboard/share-of-voice/_components/GenerateBriefButton';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/app/dashboard/share-of-voice/brief-actions', () => ({
  generateContentBrief: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GenerateBriefButton', () => {
  const QUERY_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const QUERY_TEXT = 'private event venue Alpharetta';

  it('renders "Generate Brief →" button when no draft', () => {
    render(
      <GenerateBriefButton queryId={QUERY_ID} queryText={QUERY_TEXT} hasDraft={false} />,
    );
    expect(screen.getByText('Generate Brief →')).toBeTruthy();
  });

  it('renders "View Draft →" link when draft exists', () => {
    render(
      <GenerateBriefButton queryId={QUERY_ID} queryText={QUERY_TEXT} hasDraft={true} />,
    );
    const link = screen.getByText('View Draft →');
    expect(link).toBeTruthy();
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/dashboard/content-drafts');
  });

  it('has correct test-id when no draft', () => {
    render(
      <GenerateBriefButton queryId={QUERY_ID} queryText={QUERY_TEXT} hasDraft={false} />,
    );
    expect(screen.getByTestId(`generate-brief-${QUERY_ID}`)).toBeTruthy();
  });

  it('has correct test-id when draft exists', () => {
    render(
      <GenerateBriefButton queryId={QUERY_ID} queryText={QUERY_TEXT} hasDraft={true} />,
    );
    expect(screen.getByTestId(`view-draft-${QUERY_ID}`)).toBeTruthy();
  });
});
