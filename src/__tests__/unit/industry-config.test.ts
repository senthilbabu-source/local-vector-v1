// ---------------------------------------------------------------------------
// industry-config.test.ts — Unit tests for industry configuration SSOT
//
// Sprint E (M5): Tests INDUSTRY_CONFIG registry and getIndustryConfig() helper.
//
// Run:
//   npx vitest run src/__tests__/unit/industry-config.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { Utensils } from 'lucide-react';
import {
  INDUSTRY_CONFIG,
  getIndustryConfig,
} from '@/lib/industries/industry-config';

// ── getIndustryConfig — known IDs ──────────────────────────────────────────

describe('getIndustryConfig — known industry IDs', () => {
  it('returns the restaurant config for "restaurant"', () => {
    const config = getIndustryConfig('restaurant');
    expect(config.id).toBe('restaurant');
    expect(config.label).toMatch(/restaurant/i);
  });

  it('returns the medical/dental config for "medical_dental"', () => {
    const config = getIndustryConfig('medical_dental');
    expect(config.id).toBe('medical_dental');
    expect(config.label).toMatch(/medical|dental/i);
  });
});

// ── getIndustryConfig — fallback behavior ─────────────────────────────────

describe('getIndustryConfig — fallback to restaurant', () => {
  it('returns the restaurant config when industryId is null', () => {
    const config = getIndustryConfig(null);
    expect(config.id).toBe('restaurant');
  });

  it('returns the restaurant config when industryId is undefined', () => {
    const config = getIndustryConfig(undefined);
    expect(config.id).toBe('restaurant');
  });

  it('returns the restaurant config for an unknown industry ID', () => {
    const config = getIndustryConfig('unknown_industry');
    expect(config.id).toBe('restaurant');
  });
});

// ── Per-config label assertions ────────────────────────────────────────────

describe('INDUSTRY_CONFIG — magicMenuLabel values', () => {
  it('restaurant config has magicMenuLabel === "Magic Menu"', () => {
    expect(INDUSTRY_CONFIG.restaurant.magicMenuLabel).toBe('Magic Menu');
  });

  it('medical_dental config has magicMenuLabel === "Magic Services"', () => {
    expect(INDUSTRY_CONFIG.medical_dental.magicMenuLabel).toBe('Magic Services');
  });
});

// ── Icon distinctness ──────────────────────────────────────────────────────

describe('INDUSTRY_CONFIG — icon values', () => {
  it('medical_dental config has a magicMenuIcon that is not the Utensils icon', () => {
    // Utensils is the restaurant-specific icon; medical should use Stethoscope
    expect(INDUSTRY_CONFIG.medical_dental.magicMenuIcon).not.toBe(Utensils);
  });
});

// ── Structural completeness across all entries ────────────────────────────

describe('INDUSTRY_CONFIG — structural completeness', () => {
  const entries = Object.values(INDUSTRY_CONFIG);

  it('all entries have a non-empty onboardingSearchPlaceholder', () => {
    for (const config of entries) {
      expect(config.onboardingSearchPlaceholder).toBeTruthy();
      expect(typeof config.onboardingSearchPlaceholder).toBe('string');
      expect(config.onboardingSearchPlaceholder.length).toBeGreaterThan(0);
    }
  });

  it('all entries have at least one schemaType', () => {
    for (const config of entries) {
      expect(Array.isArray(config.schemaTypes)).toBe(true);
      expect(config.schemaTypes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all entries have a non-empty hallucinationRiskDescription', () => {
    for (const config of entries) {
      expect(config.hallucinationRiskDescription).toBeTruthy();
      expect(typeof config.hallucinationRiskDescription).toBe('string');
      expect(config.hallucinationRiskDescription.length).toBeGreaterThan(0);
    }
  });
});

// ── schemaTypes content assertions ────────────────────────────────────────

describe('INDUSTRY_CONFIG — schemaTypes content', () => {
  it('restaurant config schemaTypes includes "Restaurant"', () => {
    expect(INDUSTRY_CONFIG.restaurant.schemaTypes).toContain('Restaurant');
  });

  it('medical_dental config schemaTypes includes "Physician" and "Dentist"', () => {
    expect(INDUSTRY_CONFIG.medical_dental.schemaTypes).toContain('Physician');
    expect(INDUSTRY_CONFIG.medical_dental.schemaTypes).toContain('Dentist');
  });
});
