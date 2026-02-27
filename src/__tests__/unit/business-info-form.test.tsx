// @vitest-environment jsdom
// ---------------------------------------------------------------------------
// business-info-form.test.tsx — Unit tests for Sprint 93 BusinessInfoForm
//
// Tests app/dashboard/settings/business-info/_components/BusinessInfoForm.tsx:
//   • Rendering all sections, pre-population, interactions, GBP card visibility,
//     validation, audit prompt banner behavior.
//
// Run:
//   npx vitest run src/__tests__/unit/business-info-form.test.tsx
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock server actions and next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/app/dashboard/settings/business-info/actions', () => ({
  saveBusinessInfo: vi.fn(),
}));

vi.mock('@/app/actions/gbp-import', () => ({
  triggerGBPImport: vi.fn(),
}));

vi.mock('@/app/onboarding/actions', () => ({
  triggerFirstAudit: vi.fn(),
}));

import BusinessInfoForm from '@/app/dashboard/settings/business-info/_components/BusinessInfoForm';
import { saveBusinessInfo } from '@/app/dashboard/settings/business-info/actions';
import { GOLDEN_TENANT } from '@/src/__fixtures__/golden-tenant';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';

// ── Shared fixtures ─────────────────────────────────────────────────────

const MOCK_LOCATION = {
  id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Charcoal N Chill - Alpharetta',
  business_name: 'Charcoal N Chill',
  phone: '(470) 546-4866',
  website_url: 'https://charcoalnchill.com',
  address_line1: '11950 Jones Bridge Road Ste 103',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30005',
  hours_data: GOLDEN_TENANT.location.hours_data as HoursData,
  amenities: GOLDEN_TENANT.location.amenities as Partial<Amenities>,
  categories: [...GOLDEN_TENANT.location.categories],
  operational_status: 'OPERATIONAL',
  gbp_synced_at: null,
};

// ── Tests ───────────────────────────────────────────────────────────────

describe('BusinessInfoForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all three sections: Basic Info, Amenities, Hours', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    expect(screen.getByText('Basic Information')).toBeDefined();
    expect(screen.getByText('Amenities')).toBeDefined();
    expect(screen.getByText('Business Hours')).toBeDefined();
  });

  it('pre-populates basic info fields from location props', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    expect(screen.getByTestId('basic-info-name')).toHaveProperty('value', 'Charcoal N Chill');
    expect(screen.getByTestId('basic-info-phone')).toHaveProperty('value', '(470) 546-4866');
    expect(screen.getByTestId('basic-info-website')).toHaveProperty('value', 'https://charcoalnchill.com');
    expect(screen.getByTestId('basic-info-address')).toHaveProperty('value', '11950 Jones Bridge Road Ste 103');
    expect(screen.getByTestId('basic-info-city')).toHaveProperty('value', 'Alpharetta');
    expect(screen.getByTestId('basic-info-state')).toHaveProperty('value', 'GA');
    expect(screen.getByTestId('basic-info-zip')).toHaveProperty('value', '30005');
    expect(screen.getByTestId('basic-info-category')).toHaveProperty('value', 'Hookah Bar');
    expect(screen.getByTestId('basic-info-status')).toHaveProperty('value', 'OPERATIONAL');
  });

  it('shows GBP sync card when hasGBPConnection is true', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={true} />);
    expect(screen.getByTestId('gbp-sync-card')).toBeDefined();
    expect(screen.getByTestId('gbp-sync-btn')).toBeDefined();
  });

  it('hides GBP sync card when hasGBPConnection is false', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    expect(screen.queryByTestId('gbp-sync-card')).toBeNull();
  });

  it('renders null location message when location is null', () => {
    render(<BusinessInfoForm location={null} hasGBPConnection={false} />);
    expect(screen.getByText(/No location data found/)).toBeDefined();
  });

  it('renders all 9 data-testid attributes for basic info fields', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    const testIds = [
      'basic-info-name', 'basic-info-phone', 'basic-info-website',
      'basic-info-address', 'basic-info-city', 'basic-info-state',
      'basic-info-zip', 'basic-info-category', 'basic-info-status',
    ];
    for (const id of testIds) {
      expect(screen.getByTestId(id)).toBeDefined();
    }
  });

  it('operational status select renders three options', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    const select = screen.getByTestId('basic-info-status');
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(3);
    expect(options[0]).toHaveProperty('value', 'OPERATIONAL');
    expect(options[1]).toHaveProperty('value', 'CLOSED_TEMPORARILY');
    expect(options[2]).toHaveProperty('value', 'CLOSED_PERMANENTLY');
  });

  it('null initial values render as empty strings (not "null")', () => {
    const locationWithNulls = {
      ...MOCK_LOCATION,
      phone: null,
      website_url: null,
      address_line1: null,
      city: null,
      state: null,
      zip: null,
      categories: null,
    };
    render(<BusinessInfoForm location={locationWithNulls} hasGBPConnection={false} />);
    expect(screen.getByTestId('basic-info-phone')).toHaveProperty('value', '');
    expect(screen.getByTestId('basic-info-website')).toHaveProperty('value', '');
    expect(screen.getByTestId('basic-info-city')).toHaveProperty('value', '');
    // Ensure no "null" text appears
    expect((screen.getByTestId('basic-info-phone') as HTMLInputElement).value).not.toBe('null');
  });

  it('state input uppercases on blur', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    const stateInput = screen.getByTestId('basic-info-state') as HTMLInputElement;
    fireEvent.change(stateInput, { target: { value: 'ca' } });
    fireEvent.blur(stateInput);
    expect(stateInput.value).toBe('CA');
  });

  it('website input prefixes https:// on blur when missing protocol', () => {
    render(<BusinessInfoForm location={{ ...MOCK_LOCATION, website_url: null }} hasGBPConnection={false} />);
    const websiteInput = screen.getByTestId('basic-info-website') as HTMLInputElement;
    fireEvent.change(websiteInput, { target: { value: 'example.com' } });
    fireEvent.blur(websiteInput);
    expect(websiteInput.value).toBe('https://example.com');
  });

  it('website input does NOT double-prefix when already has protocol', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    const websiteInput = screen.getByTestId('basic-info-website') as HTMLInputElement;
    fireEvent.change(websiteInput, { target: { value: 'https://charcoalnchill.com' } });
    fireEvent.blur(websiteInput);
    expect(websiteInput.value).toBe('https://charcoalnchill.com');
  });

  it('shows validation error when saving with empty business name', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    const nameInput = screen.getByTestId('basic-info-name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('business-info-save-btn'));
    expect(screen.getByText(/Business name is required/)).toBeDefined();
  });

  it('renders Save Changes button with correct testid', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    const saveBtn = screen.getByTestId('business-info-save-btn');
    expect(saveBtn).toBeDefined();
    expect(saveBtn.textContent).toBe('Save Changes');
  });

  it('renders 7 day rows in hours section', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const label of dayLabels) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('renders all 6 amenity checkboxes', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={false} />);
    const labels = ['Serves alcohol', 'Outdoor seating', 'Takes reservations', 'Live music', 'Hookah lounge', 'Kid friendly'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('GBP sync card shows "Never synced" when gbp_synced_at is null', () => {
    render(<BusinessInfoForm location={MOCK_LOCATION} hasGBPConnection={true} />);
    expect(screen.getByTestId('gbp-sync-status').textContent).toContain('Never synced');
  });

  it('GBP sync card shows relative time when gbp_synced_at is set', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    render(
      <BusinessInfoForm
        location={{ ...MOCK_LOCATION, gbp_synced_at: twoHoursAgo }}
        hasGBPConnection={true}
      />
    );
    expect(screen.getByTestId('gbp-sync-status').textContent).toContain('2 hours ago');
  });
});
