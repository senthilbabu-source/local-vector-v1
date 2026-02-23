// @vitest-environment jsdom
/**
 * TruthCalibrationForm — 3-Step Wizard Component Tests
 *
 * Tests the full wizard lifecycle:
 *   Step 1 — Business Name: pre-fill, validation
 *   Step 2 — Amenities: toggles map to JSON booleans; row highlight
 *   Step 3 — Hours: closed toggle emits "closed" string (Doc 03 §15.1)
 *   Submit  — calls saveGroundTruth with correct payload; navigates on success
 *
 * Project rules honoured:
 *   JSONB STRICTNESS  — sunday: "closed" string literal asserted in submit payload (rule 4)
 *   ZERO LIVE APIS    — saveGroundTruth is mocked (rule 1)
 *   RLS SHADOWBAN     — location_id comes from props, org_id from server context (rule 3)
 *   TAILWIND LITERALS — row highlight asserted with exact bg-electric-indigo/10 token (rule 5)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Hoisted mocks — evaluated at the same time as vi.mock() (before imports)
// ---------------------------------------------------------------------------

const mockSaveGroundTruth = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true }),
);
const mockPush = vi.hoisted(() => vi.fn());

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/app/onboarding/actions', () => ({
  saveGroundTruth: mockSaveGroundTruth,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import TruthCalibrationForm from '@/app/onboarding/_components/TruthCalibrationForm';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Fixtures — all UUIDs use hex chars only (UUID constraint, rule 2)
// ---------------------------------------------------------------------------

// PrimaryLocation shape from app/onboarding/page.tsx (only used fields)
const MOCK_LOCATION = {
  id:            'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  business_name: 'Charcoal N Chill',
  hours_data:    null as HoursData | null,
  amenities:     null as Partial<Amenities> | null,
};

// ---------------------------------------------------------------------------
// Helper — navigate into the form at the requested step number.
// ---------------------------------------------------------------------------

async function navigateTo(step: 2 | 3) {
  const user = userEvent.setup();
  render(<TruthCalibrationForm location={MOCK_LOCATION as never} />);
  // Click "Next" once → step 2
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  if (step === 3) {
    // Click "Next" again → step 3
    await user.click(screen.getByRole('button', { name: /^next$/i }));
  }
  return user;
}

// ---------------------------------------------------------------------------
// Step 1 — Business Name
// ---------------------------------------------------------------------------

describe('TruthCalibrationForm — Step 1: Business Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveGroundTruth.mockResolvedValue({ success: true });
  });

  it('renders business name input pre-filled from location.business_name', () => {
    render(<TruthCalibrationForm location={MOCK_LOCATION as never} />);
    const input = screen.getByDisplayValue('Charcoal N Chill');
    expect(input).toBeDefined();
  });

  it('shows the step 1 label "1. Business" as active', () => {
    render(<TruthCalibrationForm location={MOCK_LOCATION as never} />);
    // Step tab text is "1. Business" (the STEP_LABELS constant)
    expect(screen.getByText(/1\. Business/)).toBeDefined();
  });

  it('shows "Business Name" heading on step 1', () => {
    render(<TruthCalibrationForm location={MOCK_LOCATION as never} />);
    expect(screen.getByRole('heading', { name: 'Business Name' })).toBeDefined();
  });

  it('shows validation error when business name is cleared before Next', async () => {
    const user = userEvent.setup();
    render(<TruthCalibrationForm location={MOCK_LOCATION as never} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    expect(screen.getByText('Business name is required')).toBeDefined();
  });

  it('does NOT advance to step 2 when business name is empty', async () => {
    const user = userEvent.setup();
    render(<TruthCalibrationForm location={MOCK_LOCATION as never} />);

    await user.clear(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    // Still on step 1 — heading is still "Business Name"
    expect(screen.getByRole('heading', { name: 'Business Name' })).toBeDefined();
  });

  it('advances to step 2 when business name is valid', async () => {
    const user = userEvent.setup();
    render(<TruthCalibrationForm location={MOCK_LOCATION as never} />);

    await user.click(screen.getByRole('button', { name: /^next$/i }));

    expect(screen.getByRole('heading', { name: 'Amenities' })).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Step 2 — Amenities
// ---------------------------------------------------------------------------

describe('TruthCalibrationForm — Step 2: Amenities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveGroundTruth.mockResolvedValue({ success: true });
  });

  it('renders all 6 core amenity checkboxes (Doc 03 §15.2)', async () => {
    await navigateTo(2);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(6);
  });

  it('all 6 amenities start unchecked when location has no amenities', async () => {
    await navigateTo(2);
    screen.getAllByRole('checkbox').forEach((cb) => {
      expect((cb as HTMLInputElement).checked).toBe(false);
    });
  });

  it('clicking "Serves alcohol" label toggles its checkbox to checked', async () => {
    const user = await navigateTo(2);
    const alcoholLabel = screen.getByText('Serves alcohol').closest('label')!;
    await user.click(alcoholLabel);

    const checkbox = alcoholLabel.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('checked amenity row receives bg-electric-indigo/10 highlight (TAILWIND LITERAL)', async () => {
    const user = await navigateTo(2);
    const alcoholLabel = screen.getByText('Serves alcohol').closest('label')!;
    await user.click(alcoholLabel);

    // Rule 5: exact literal class token
    expect(alcoholLabel.className).toContain('bg-electric-indigo/10');
  });

  it('unchecked amenity row does NOT have bg-electric-indigo/10', async () => {
    await navigateTo(2);
    const hookahLabel = screen.getByText('Hookah lounge').closest('label')!;
    expect(hookahLabel.className).not.toContain('bg-electric-indigo/10');
  });

  it('toggling amenity twice returns it to unchecked', async () => {
    const user = await navigateTo(2);
    const alcoholLabel = screen.getByText('Serves alcohol').closest('label')!;
    await user.click(alcoholLabel); // → checked
    await user.click(alcoholLabel); // → unchecked again

    const checkbox = alcoholLabel.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('Back button returns to step 1 from step 2', async () => {
    const user = await navigateTo(2);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByDisplayValue('Charcoal N Chill')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Step 3 — Business Hours
// ---------------------------------------------------------------------------

describe('TruthCalibrationForm — Step 3: Business Hours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveGroundTruth.mockResolvedValue({ success: true });
  });

  it('renders "Business Hours" heading on step 3', async () => {
    await navigateTo(3);
    expect(screen.getByRole('heading', { name: 'Business Hours' })).toBeDefined();
  });

  it('renders all 7 day rows', async () => {
    await navigateTo(3);
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    dayLabels.forEach((day) => {
      expect(screen.getByText(day)).toBeDefined();
    });
  });

  it('Sunday starts as "Closed" by default (initHours default for hours_data=null)', async () => {
    await navigateTo(3);
    // Sunday's toggle button has title "Mark as open" when closed
    const sundayToggle = screen.getByTitle('Mark as open');
    expect(sundayToggle).toBeDefined();
    // And the day row shows the "Closed" text label
    const closedLabels = screen.getAllByText('Closed');
    expect(closedLabels.length).toBeGreaterThan(0);
  });

  it('Monday starts as "Open" (initHours default)', async () => {
    await navigateTo(3);
    // Several Mon-Sat toggles have title "Mark as closed" (they are open)
    const openToggles = screen.getAllByTitle('Mark as closed');
    expect(openToggles.length).toBe(6); // Mon–Sat open, Sunday closed
  });

  it('clicking a day toggle switches it from Open → Closed', async () => {
    const user = await navigateTo(3);
    // Monday starts open → toggle title is "Mark as closed"
    const mondayToggle = screen.getAllByTitle('Mark as closed')[0];
    await user.click(mondayToggle);

    // After click: the DOM node's title updates to "Mark as open" (closed)
    expect(mondayToggle.getAttribute('title')).toBe('Mark as open');
  });

  it('clicking a closed toggle switches it from Closed → Open', async () => {
    const user = await navigateTo(3);
    // Sunday starts closed → toggle title is "Mark as open"
    const sundayToggle = screen.getByTitle('Mark as open');
    await user.click(sundayToggle);

    expect(sundayToggle.getAttribute('title')).toBe('Mark as closed');
  });

  it('time inputs are hidden when a day is closed', async () => {
    await navigateTo(3);
    // Sunday is closed by default → its time inputs should not be present
    // All visible time inputs belong to Mon–Sat (6 days × 2 inputs = 12)
    const timeInputs = screen.getAllByDisplayValue(/^\d{2}:\d{2}$/);
    // Mon–Sat open: 6 days × 2 = 12 time inputs
    expect(timeInputs.length).toBe(12);
  });

  it('Back button returns to step 2 from step 3', async () => {
    const user = await navigateTo(3);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: 'Amenities' })).toBeDefined();
  });

  it('"Save & Continue" button is shown on step 3 (not "Next")', async () => {
    await navigateTo(3);
    expect(screen.getByRole('button', { name: /save & continue/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^next$/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Form Submission
// ---------------------------------------------------------------------------

describe('TruthCalibrationForm — Submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveGroundTruth.mockResolvedValue({ success: true });
  });

  async function submitForm() {
    const user = await navigateTo(3);
    await user.click(screen.getByRole('button', { name: /save & continue/i }));
    return user;
  }

  it('calls saveGroundTruth with the correct location_id', async () => {
    await submitForm();
    await waitFor(() => {
      expect(mockSaveGroundTruth).toHaveBeenCalledWith(
        expect.objectContaining({ location_id: MOCK_LOCATION.id }),
      );
    });
  });

  it('calls saveGroundTruth with the business_name from the input', async () => {
    await submitForm();
    await waitFor(() => {
      expect(mockSaveGroundTruth).toHaveBeenCalledWith(
        expect.objectContaining({ business_name: 'Charcoal N Chill' }),
      );
    });
  });

  it('encodes sunday as "closed" string in hours_data (Doc 03 §15.1 — JSONB STRICTNESS)', async () => {
    await submitForm();
    await waitFor(() => {
      expect(mockSaveGroundTruth).toHaveBeenCalledWith(
        expect.objectContaining({
          hours_data: expect.objectContaining({
            // Must be the literal string "closed", NOT a missing key (rule 4)
            sunday: 'closed',
          }),
        }),
      );
    });
  });

  it('encodes open days as { open, close } objects, not "closed"', async () => {
    await submitForm();
    await waitFor(() => {
      expect(mockSaveGroundTruth).toHaveBeenCalledWith(
        expect.objectContaining({
          hours_data: expect.objectContaining({
            monday:   { open: '09:00', close: '21:00' },
            saturday: { open: '09:00', close: '22:00' },
          }),
        }),
      );
    });
  });

  it('amenities are sent as boolean false by default (location has no amenities)', async () => {
    await submitForm();
    await waitFor(() => {
      expect(mockSaveGroundTruth).toHaveBeenCalledWith(
        expect.objectContaining({
          amenities: expect.objectContaining({
            serves_alcohol:      false,
            has_hookah:          false,
            is_kid_friendly:     false,
            has_outdoor_seating: false,
            takes_reservations:  false,
            has_live_music:      false,
          }),
        }),
      );
    });
  });

  it('checked amenity is sent as true in the submit payload', async () => {
    const user = userEvent.setup();
    render(<TruthCalibrationForm location={MOCK_LOCATION as never} />);

    // Step 1 → Next
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    // Step 2: check "Serves alcohol"
    const alcoholLabel = screen.getByText('Serves alcohol').closest('label')!;
    await user.click(alcoholLabel);

    // Step 2 → Next → step 3
    await user.click(screen.getByRole('button', { name: /^next$/i }));

    // Submit
    await user.click(screen.getByRole('button', { name: /save & continue/i }));

    await waitFor(() => {
      expect(mockSaveGroundTruth).toHaveBeenCalledWith(
        expect.objectContaining({
          amenities: expect.objectContaining({ serves_alcohol: true }),
        }),
      );
    });
  });

  it('navigates to /dashboard via router.push after successful submit', async () => {
    await submitForm();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error message when saveGroundTruth returns { success: false }', async () => {
    mockSaveGroundTruth.mockResolvedValue({
      success: false,
      error: 'Database connection failed',
    });

    await submitForm();

    await waitFor(() => {
      expect(screen.getByText('Database connection failed')).toBeDefined();
    });
  });

  it('does NOT navigate when saveGroundTruth returns failure', async () => {
    mockSaveGroundTruth.mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    await submitForm();

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('error message is styled with text-alert-crimson (TAILWIND LITERAL)', async () => {
    mockSaveGroundTruth.mockResolvedValue({
      success: false,
      error: 'Something went wrong',
    });

    await submitForm();

    await waitFor(() => {
      const errorEl = screen.getByText('Something went wrong');
      // Rule 5: exact literal class token
      expect(errorEl.className).toContain('text-alert-crimson');
    });
  });
});
