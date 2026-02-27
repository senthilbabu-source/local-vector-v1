// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// occasion-alert-card.test.tsx — Component tests for OccasionAlertCard
//
// Sprint 101: 18 tests — rendering, interactions, plan gating, accessibility
//
// Run:
//   npx vitest run src/__tests__/unit/occasion-alert-card.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OccasionAlertCard from '@/app/dashboard/_components/OccasionAlertCard';
import type { DashboardOccasionAlert } from '@/lib/occasions/occasion-feed';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockSnooze = vi.fn().mockResolvedValue({ success: true });
const mockDismiss = vi.fn().mockResolvedValue({ success: true });
const mockCreateDraft = vi.fn().mockResolvedValue({ success: true, draftId: 'draft-1' });

vi.mock('@/app/actions/occasions', () => ({
  snoozeOccasion: (...args: unknown[]) => mockSnooze(...args),
  dismissOccasionPermanently: (...args: unknown[]) => mockDismiss(...args),
  createDraftFromOccasion: (...args: unknown[]) => mockCreateDraft(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseAlert: DashboardOccasionAlert = {
  id: 'occ-test-1',
  name: 'Independence Day',
  date: '2026-07-04',
  daysUntil: 3,
  category: 'holiday',
  description: null,
  isUrgent: true,
};

const normalAlert: DashboardOccasionAlert = {
  ...baseAlert,
  id: 'occ-test-2',
  name: 'Labor Day',
  daysUntil: 10,
  isUrgent: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OccasionAlertCard', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Rendering
  it('renders occasion name', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    expect(screen.getByTestId('occasion-alert-name-occ-test-1')).toBeTruthy();
    expect(screen.getByText('Independence Day')).toBeTruthy();
  });

  it('renders "Today" when daysUntil=0', () => {
    const today = { ...baseAlert, daysUntil: 0 };
    render(<OccasionAlertCard alert={today} canCreateDraft onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('renders "Tomorrow" when daysUntil=1', () => {
    const tomorrow = { ...baseAlert, daysUntil: 1 };
    render(<OccasionAlertCard alert={tomorrow} canCreateDraft onDismiss={mockOnDismiss} />);
    expect(screen.getByText('Tomorrow')).toBeTruthy();
  });

  it('renders "In N days" when daysUntil >= 2', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    expect(screen.getByText('In 3 days')).toBeTruthy();
  });

  it('applies urgent styling when isUrgent=true', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    const card = screen.getByTestId('occasion-alert-card-occ-test-1');
    expect(card.className).toContain('border-amber-500');
  });

  it('applies normal styling when isUrgent=false', () => {
    render(<OccasionAlertCard alert={normalAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    const card = screen.getByTestId('occasion-alert-card-occ-test-2');
    expect(card.className).not.toContain('border-amber-500');
  });

  // data-testid
  it('has correct data-testid attributes on all interactive elements', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    expect(screen.getByTestId('occasion-alert-card-occ-test-1')).toBeTruthy();
    expect(screen.getByTestId('occasion-alert-name-occ-test-1')).toBeTruthy();
    expect(screen.getByTestId('occasion-alert-days-until-occ-test-1')).toBeTruthy();
    expect(screen.getByTestId('occasion-alert-create-draft-btn-occ-test-1')).toBeTruthy();
    expect(screen.getByTestId('occasion-alert-snooze-trigger-occ-test-1')).toBeTruthy();
    expect(screen.getByTestId('occasion-alert-dismiss-btn-occ-test-1')).toBeTruthy();
  });

  // Create Draft CTA
  it('Create Draft button is enabled for Growth+ plan', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    const btn = screen.getByTestId('occasion-alert-create-draft-btn-occ-test-1') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('shows disabled Create Draft with tooltip for Starter plan', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft={false} onDismiss={mockOnDismiss} />);
    const btn = screen.getByTestId('occasion-alert-create-draft-btn-occ-test-1') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('title')).toMatch(/Upgrade/i);
  });

  // Dismiss
  it('calls onDismiss when × clicked (optimistic removal)', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('occasion-alert-dismiss-btn-occ-test-1'));
    expect(mockOnDismiss).toHaveBeenCalledWith('occ-test-1');
  });

  it('× button has correct aria-label', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    const btn = screen.getByTestId('occasion-alert-dismiss-btn-occ-test-1');
    expect(btn.getAttribute('aria-label')).toBe('Dismiss Independence Day alert');
  });

  // Snooze dropdown
  it('snooze menu opens on trigger click', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-trigger-occ-test-1'));
    expect(screen.getByTestId('occasion-alert-snooze-1day-occ-test-1')).toBeTruthy();
    expect(screen.getByTestId('occasion-alert-snooze-3days-occ-test-1')).toBeTruthy();
    expect(screen.getByTestId('occasion-alert-snooze-1week-occ-test-1')).toBeTruthy();
  });

  it('calls snoozeOccasion with 1_day when "Tomorrow" selected', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-trigger-occ-test-1'));
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-1day-occ-test-1'));
    expect(mockSnooze).toHaveBeenCalledWith({ occasionId: 'occ-test-1', duration: '1_day' });
  });

  it('calls snoozeOccasion with 3_days when "In 3 days" selected', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-trigger-occ-test-1'));
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-3days-occ-test-1'));
    expect(mockSnooze).toHaveBeenCalledWith({ occasionId: 'occ-test-1', duration: '3_days' });
  });

  it('calls snoozeOccasion with 1_week when "Next week" selected', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-trigger-occ-test-1'));
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-1week-occ-test-1'));
    expect(mockSnooze).toHaveBeenCalledWith({ occasionId: 'occ-test-1', duration: '1_week' });
  });

  it('snooze calls onDismiss for optimistic removal', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-trigger-occ-test-1'));
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-1day-occ-test-1'));
    expect(mockOnDismiss).toHaveBeenCalledWith('occ-test-1');
  });

  it('has accessible role=menu on snooze dropdown', () => {
    render(<OccasionAlertCard alert={baseAlert} canCreateDraft onDismiss={mockOnDismiss} />);
    fireEvent.click(screen.getByTestId('occasion-alert-snooze-trigger-occ-test-1'));
    const menu = screen.getByRole('menu');
    expect(menu).toBeTruthy();
  });
});
