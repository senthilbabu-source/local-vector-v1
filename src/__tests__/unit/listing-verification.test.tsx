// ---------------------------------------------------------------------------
// src/__tests__/unit/listing-verification.test.tsx — Sprint L (C2 Phase 2)
//
// Tests for:
//   1. detectDiscrepancies() — pure function (6 tests)
//   2. ListingVerificationRow — component rendering (10 tests)
//
// @vitest-environment jsdom
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { detectDiscrepancies, type VerificationResult } from '@/lib/integrations/detect-discrepancies';
import { ListingVerificationRow } from '@/app/dashboard/integrations/_components/ListingVerificationRow';

// ---------------------------------------------------------------------------
// detectDiscrepancies()
// ---------------------------------------------------------------------------

describe('detectDiscrepancies()', () => {
  const baseLocation = {
    business_name: 'Charcoal N Chill',
    address_line1: '123 Main Street',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30009',
    phone: '(555) 123-4567',
  };

  it('returns empty array when all data matches', () => {
    const result = detectDiscrepancies(
      {
        name: 'Charcoal N Chill',
        address: '123 Main Street',
        phone: '+15551234567',
      },
      baseLocation,
    );
    expect(result).toEqual([]);
  });

  it('detects mismatched business name', () => {
    const result = detectDiscrepancies(
      {
        name: 'Totally Different Restaurant',
        address: '123 Main Street',
        phone: '+15551234567',
      },
      baseLocation,
    );
    expect(result.length).toBe(1);
    expect(result[0].field).toBe('Business name');
    expect(result[0].severity).toBe('high');
  });

  it('detects mismatched street address', () => {
    const result = detectDiscrepancies(
      {
        name: 'Charcoal N Chill',
        address: '999 Other Ave',
        phone: '+15551234567',
      },
      baseLocation,
    );
    expect(result.length).toBe(1);
    expect(result[0].field).toBe('Street address');
  });

  it('detects mismatched phone number', () => {
    const result = detectDiscrepancies(
      {
        name: 'Charcoal N Chill',
        address: '123 Main Street',
        phone: '+15559999999',
      },
      baseLocation,
    );
    expect(result.length).toBe(1);
    expect(result[0].field).toBe('Phone number');
  });

  it('fuzzy name match: "N" vs "and" is not a discrepancy', () => {
    const result = detectDiscrepancies(
      {
        name: 'Charcoal and Chill',
        address: '123 Main Street',
        phone: '+15551234567',
      },
      { ...baseLocation, business_name: 'Charcoal N Chill' },
    );
    // "charcoalnchill" does not include "charcoalandchill" and vice versa
    // but "charcoalnchill" is a substring of "charcoalandchill" → no discrepancy
    // Actually let's check: normalize("Charcoal N Chill") = "charcoalnchill"
    // normalize("Charcoal and Chill") = "charcoalandchill"
    // "charcoalandchill".includes("charcoalnchill") → true!
    expect(result.filter((d) => d.field === 'Business name')).toEqual([]);
  });

  it('phone normalization: "+1 (555) 123-4567" vs "5551234567" is a match', () => {
    const result = detectDiscrepancies(
      {
        name: 'Charcoal N Chill',
        address: '123 Main Street',
        phone: '+1 (555) 123-4567',
      },
      { ...baseLocation, phone: '5551234567' },
    );
    expect(result.filter((d) => d.field === 'Phone number')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ListingVerificationRow component
// ---------------------------------------------------------------------------

describe('ListingVerificationRow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultProps = {
    platform: 'yelp',
    platformLabel: 'Yelp',
    claimUrl: 'https://biz.yelp.com',
    locationId: 'loc-123',
  };

  it('shows "Not yet verified" when cachedResult is null', () => {
    const { container } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={null} />,
    );
    expect(container.textContent).toContain('Not yet verified');
  });

  it('shows "Not found on this platform" when found=false', () => {
    const result: VerificationResult = {
      found: false,
      discrepancies: [],
      verifiedAt: new Date().toISOString(),
    };
    const { container } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={result} />,
    );
    expect(container.textContent).toContain('Not found on this platform');
  });

  it('shows "data matches" when found=true and no discrepancies', () => {
    const result: VerificationResult = {
      found: true,
      platformName: 'Charcoal N Chill',
      discrepancies: [],
      verifiedAt: new Date().toISOString(),
    };
    const { container } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={result} />,
    );
    expect(container.textContent).toContain('data matches');
  });

  it('shows discrepancy list when discrepancies exist', () => {
    const result: VerificationResult = {
      found: true,
      platformName: 'Wrong Name',
      discrepancies: [
        {
          field: 'Business name',
          platformValue: 'Wrong Name',
          localValue: 'Charcoal N Chill',
          severity: 'high',
        },
      ],
      verifiedAt: new Date().toISOString(),
    };
    const { container } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={result} />,
    );
    expect(container.textContent).toContain('1 discrepancy found');
    expect(container.textContent).toContain('Business name');
    expect(container.textContent).toContain('Wrong Name');
  });

  it('renders verify button with correct data-testid', () => {
    const { getByTestId } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={null} />,
    );
    expect(getByTestId('yelp-verify-btn')).toBeDefined();
  });

  it('shows loading state when verify button is clicked', async () => {
    // Mock fetch to never resolve (keep loading)
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    const { getByTestId } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={null} />,
    );
    fireEvent.click(getByTestId('yelp-verify-btn'));

    await waitFor(() => {
      expect(getByTestId('yelp-verify-btn').textContent).toContain('Checking');
    });

    vi.unstubAllGlobals();
  });

  it('renders status-ok testid when verified clean', () => {
    const result: VerificationResult = {
      found: true,
      platformName: 'Charcoal N Chill',
      discrepancies: [],
      verifiedAt: new Date().toISOString(),
    };
    const { getByTestId } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={result} />,
    );
    expect(getByTestId('yelp-status-ok')).toBeDefined();
  });

  it('renders status-discrepancy testid when discrepancies found', () => {
    const result: VerificationResult = {
      found: true,
      discrepancies: [
        { field: 'Phone number', platformValue: '555-0000', localValue: '555-1234', severity: 'high' },
      ],
      verifiedAt: new Date().toISOString(),
    };
    const { getByTestId } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={result} />,
    );
    expect(getByTestId('yelp-status-discrepancy')).toBeDefined();
  });

  it('renders status-not-found testid when not found', () => {
    const result: VerificationResult = {
      found: false,
      discrepancies: [],
      verifiedAt: new Date().toISOString(),
    };
    const { getByTestId } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={result} />,
    );
    expect(getByTestId('yelp-status-not-found')).toBeDefined();
  });

  it('renders claim link with testid when discrepancies exist', () => {
    const result: VerificationResult = {
      found: true,
      discrepancies: [
        { field: 'Business name', platformValue: 'X', localValue: 'Y', severity: 'high' },
      ],
      verifiedAt: new Date().toISOString(),
    };
    const { getByTestId } = render(
      <ListingVerificationRow {...defaultProps} cachedResult={result} />,
    );
    const link = getByTestId('yelp-claim-link');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('https://biz.yelp.com');
  });
});
