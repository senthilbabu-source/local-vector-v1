// ---------------------------------------------------------------------------
// Sprint O (L3): Content Flow Clarity — unit tests
// @vitest-environment jsdom
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftSourceTag } from '@/app/dashboard/content-drafts/_components/DraftSourceTag';
import ContentDraftCard, {
  type ContentDraftRow,
} from '@/app/dashboard/content-drafts/_components/ContentDraftCard';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock server actions
vi.mock(
  '@/app/dashboard/content-drafts/actions',
  () => ({
    approveDraft: vi.fn(),
    rejectDraft: vi.fn(),
    archiveDraft: vi.fn(),
    publishDraft: vi.fn(),
  }),
);

// ---------------------------------------------------------------------------
// DraftSourceTag
// ---------------------------------------------------------------------------

describe('DraftSourceTag', () => {
  it('renders with occasion name', () => {
    render(<DraftSourceTag sourceOccasion="Cinco de Mayo" />);
    expect(
      screen.getByText(/Generated from calendar/),
    ).toBeDefined();
    expect(screen.getByText(/Cinco de Mayo/)).toBeDefined();
  });

  it('has data-testid="draft-source-tag"', () => {
    render(<DraftSourceTag sourceOccasion="Valentine's Day" />);
    expect(screen.getByTestId('draft-source-tag')).toBeDefined();
  });

  it('links to /dashboard/content-calendar', () => {
    render(<DraftSourceTag sourceOccasion="Fourth of July" />);
    const link = screen.getByTestId('draft-source-tag');
    expect(link.getAttribute('href')).toBe('/dashboard/content-calendar');
  });
});

// ---------------------------------------------------------------------------
// ContentDraftCard with occasionName
// ---------------------------------------------------------------------------

function makeDraft(overrides?: Partial<ContentDraftRow>): ContentDraftRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    trigger_type: 'manual',
    trigger_id: null,
    draft_title: 'Test Draft',
    draft_content: 'Lorem ipsum dolor sit amet',
    target_prompt: null,
    content_type: 'blog_post',
    aeo_score: 75,
    status: 'draft',
    human_approved: false,
    created_at: '2026-02-28T12:00:00Z',
    ...overrides,
  };
}

describe('ContentDraftCard — occasion source tag', () => {
  it('renders DraftSourceTag when trigger_type=occasion and occasionName provided', () => {
    const draft = makeDraft({
      trigger_type: 'occasion',
      trigger_id: '00000000-0000-0000-0000-000000000099',
    });
    render(<ContentDraftCard draft={draft} occasionName="Mother's Day" />);
    expect(screen.getByTestId('draft-source-tag')).toBeDefined();
    expect(screen.getByText(/Mother's Day/)).toBeDefined();
  });

  it('does NOT render DraftSourceTag when trigger_type=manual', () => {
    const draft = makeDraft({ trigger_type: 'manual' });
    render(<ContentDraftCard draft={draft} occasionName={null} />);
    expect(screen.queryByTestId('draft-source-tag')).toBeNull();
  });

  it('does NOT render DraftSourceTag when trigger_type=occasion but no occasionName', () => {
    const draft = makeDraft({ trigger_type: 'occasion', trigger_id: 'some-id' });
    render(<ContentDraftCard draft={draft} occasionName={null} />);
    expect(screen.queryByTestId('draft-source-tag')).toBeNull();
  });

  it('does NOT render DraftSourceTag when occasionName is undefined (no prop)', () => {
    const draft = makeDraft({ trigger_type: 'occasion', trigger_id: 'some-id' });
    render(<ContentDraftCard draft={draft} />);
    expect(screen.queryByTestId('draft-source-tag')).toBeNull();
  });

  it('renders Occasion Engine badge alongside DraftSourceTag', () => {
    const draft = makeDraft({
      trigger_type: 'occasion',
      trigger_id: '00000000-0000-0000-0000-000000000099',
    });
    render(<ContentDraftCard draft={draft} occasionName="St. Patrick's Day" />);
    // Both the existing trigger badge AND the source tag should be present
    expect(screen.getByTestId('draft-origin-tag')).toBeDefined();
    expect(screen.getByTestId('draft-source-tag')).toBeDefined();
  });
});
