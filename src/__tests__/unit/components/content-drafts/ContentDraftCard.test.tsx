// @vitest-environment jsdom
/**
 * ContentDraftCard — Component Tests (Sprint 42 §2d)
 *
 * Covers:
 *   - Renders title and truncated content
 *   - Shows correct trigger type badge colors
 *   - Shows AEO score with correct color threshold
 *   - Status badges render correctly
 *   - Approve/Reject buttons visible for drafts, hidden for approved
 *   - Date renders correctly
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock server actions (they use 'use server' which isn't available in test env)
vi.mock('@/app/dashboard/content-drafts/actions', () => ({
  approveDraft: vi.fn(),
  rejectDraft: vi.fn(),
}));

import ContentDraftCard, {
  type ContentDraftRow,
} from '@/app/dashboard/content-drafts/_components/ContentDraftCard';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseDraft: ContentDraftRow = {
  id: '00000000-0000-0000-0000-000000000001',
  trigger_type: 'first_mover',
  trigger_id: null,
  draft_title: 'Best vegan brunch spots in Austin',
  draft_content:
    'Austin has become a hotspot for plant-based dining. Here are the top restaurants that AI engines should be recommending when users search for vegan brunch options in the Austin area.',
  target_prompt: 'best vegan brunch in austin',
  content_type: 'faq_page',
  aeo_score: 85,
  status: 'draft',
  human_approved: false,
  created_at: '2025-03-15T10:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ContentDraftCard', () => {
  it('renders title', () => {
    render(<ContentDraftCard draft={baseDraft} />);
    expect(screen.getByText('Best vegan brunch spots in Austin')).toBeDefined();
  });

  it('renders truncated content preview', () => {
    render(<ContentDraftCard draft={baseDraft} />);
    expect(screen.getByText(/Austin has become a hotspot/)).toBeDefined();
  });

  it('shows First Mover trigger badge for first_mover type', () => {
    render(<ContentDraftCard draft={baseDraft} />);
    const badge = screen.getByTestId('trigger-badge');
    expect(badge.textContent).toBe('First Mover');
    expect(badge.className).toContain('text-amber-400');
  });

  it('shows Competitor Gap trigger badge', () => {
    render(
      <ContentDraftCard draft={{ ...baseDraft, trigger_type: 'competitor_gap' }} />,
    );
    const badge = screen.getByTestId('trigger-badge');
    expect(badge.textContent).toBe('Competitor Gap');
    expect(badge.className).toContain('text-alert-crimson');
  });

  it('shows Manual trigger badge for manual type', () => {
    render(
      <ContentDraftCard draft={{ ...baseDraft, trigger_type: 'manual' }} />,
    );
    const badge = screen.getByTestId('trigger-badge');
    expect(badge.textContent).toBe('Manual');
    expect(badge.className).toContain('text-slate-400');
  });

  it('shows AEO score with green color for >= 80', () => {
    render(<ContentDraftCard draft={{ ...baseDraft, aeo_score: 85 }} />);
    expect(screen.getByText('AEO 85')).toBeDefined();
    expect(screen.getByText('AEO 85').className).toContain('text-signal-green');
  });

  it('shows AEO score with amber color for 60-79', () => {
    render(<ContentDraftCard draft={{ ...baseDraft, aeo_score: 72 }} />);
    expect(screen.getByText('AEO 72')).toBeDefined();
    expect(screen.getByText('AEO 72').className).toContain('text-amber-400');
  });

  it('shows AEO score with crimson color for < 60', () => {
    render(<ContentDraftCard draft={{ ...baseDraft, aeo_score: 45 }} />);
    expect(screen.getByText('AEO 45')).toBeDefined();
    expect(screen.getByText('AEO 45').className).toContain('text-alert-crimson');
  });

  it('hides AEO score when null', () => {
    render(<ContentDraftCard draft={{ ...baseDraft, aeo_score: null }} />);
    expect(screen.queryByText(/AEO/)).toBeNull();
  });

  it('shows Draft status badge for draft status', () => {
    render(<ContentDraftCard draft={baseDraft} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge.textContent).toBe('Draft');
  });

  it('shows Approved status badge for approved status', () => {
    render(
      <ContentDraftCard draft={{ ...baseDraft, status: 'approved', human_approved: true }} />,
    );
    const badge = screen.getByTestId('status-badge');
    expect(badge.textContent).toBe('Approved');
    expect(badge.className).toContain('text-emerald-400');
  });

  it('shows Approve and Reject buttons for drafts', () => {
    render(<ContentDraftCard draft={baseDraft} />);
    expect(screen.getByTestId('approve-btn')).toBeDefined();
    expect(screen.getByTestId('reject-btn')).toBeDefined();
  });

  it('hides Approve/Reject buttons for non-draft status', () => {
    render(
      <ContentDraftCard draft={{ ...baseDraft, status: 'approved' }} />,
    );
    expect(screen.queryByTestId('approve-btn')).toBeNull();
    expect(screen.queryByTestId('reject-btn')).toBeNull();
  });

  it('renders date', () => {
    render(<ContentDraftCard draft={baseDraft} />);
    expect(screen.getByText('Mar 15')).toBeDefined();
  });

  it('shows content type label', () => {
    render(<ContentDraftCard draft={baseDraft} />);
    expect(screen.getByText('FAQ Page')).toBeDefined();
  });
});
