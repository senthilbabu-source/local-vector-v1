// ---------------------------------------------------------------------------
// src/__tests__/unit/medical-scaffolding.test.ts — Sprint 127: Medical/Dental v2
//
// Tests: buildAvailableServices, getApplicableTemplates, renderFAQTemplate,
//        checkMedicalCopy, migration, schema alignment
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  buildAvailableServices,
  DENTAL_PROCEDURE_CATEGORIES,
  MEDICAL_SPECIALTY_CATEGORIES,
} from '@/lib/schema-generator/medical-procedure-types';

import {
  MEDICAL_FAQ_TEMPLATES,
  getApplicableTemplates,
  renderFAQTemplate,
} from '@/lib/services/medical-faq-templates';

import { checkMedicalCopy } from '@/lib/services/medical-copy-guard';

const ROOT = join(__dirname, '..', '..', '..');

// ---------------------------------------------------------------------------
// buildAvailableServices()
// ---------------------------------------------------------------------------

describe('buildAvailableServices()', () => {
  it('returns empty array for empty specialtyTags', () => {
    expect(buildAvailableServices([])).toEqual([]);
  });

  it('returns empty array for null-like input', () => {
    expect(buildAvailableServices(null as unknown as string[])).toEqual([]);
  });

  it('maps dental specialty tags to dental procedures', () => {
    const result = buildAvailableServices(['Preventive', 'Cosmetic']);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((s) => s['@type'] === 'MedicalProcedure')).toBe(true);
    const names = result.map((s) => s.name);
    expect(names).toContain('Dental Cleaning');
    expect(names).toContain('Teeth Whitening');
  });

  it('maps medical specialty tags to medical procedures', () => {
    const result = buildAvailableServices(['Primary Care', 'Cardiology']);
    expect(result.length).toBeGreaterThan(0);
    const names = result.map((s) => s.name);
    expect(names).toContain('Annual Physical');
    expect(names).toContain('EKG');
  });

  it('deduplicates procedures across multiple matching tags', () => {
    // Both "Preventive" and "dental" could match the same category
    const result = buildAvailableServices(['Preventive']);
    const names = result.map((s) => s.name);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });

  it('caps output at 20 services', () => {
    // Feed all categories to trigger many matches
    const allTags = Object.keys(DENTAL_PROCEDURE_CATEGORIES);
    const result = buildAvailableServices(allTags);
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('returns MedicalProcedure @type for all items', () => {
    const result = buildAvailableServices(['Orthodontics']);
    for (const service of result) {
      expect(service['@type']).toBe('MedicalProcedure');
    }
  });

  it('detects dental catalog when tag contains dental keyword', () => {
    const result = buildAvailableServices(['pediatric dentistry']);
    // Should map to Pediatric dental category
    const names = result.map((s) => s.name);
    expect(names).toContain("Children's Dentistry");
  });
});

// ---------------------------------------------------------------------------
// Catalogs structure
// ---------------------------------------------------------------------------

describe('Procedure catalogs', () => {
  it('has 8 dental categories', () => {
    expect(Object.keys(DENTAL_PROCEDURE_CATEGORIES)).toHaveLength(8);
  });

  it('has 7 medical categories', () => {
    expect(Object.keys(MEDICAL_SPECIALTY_CATEGORIES)).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// getApplicableTemplates()
// ---------------------------------------------------------------------------

describe('getApplicableTemplates()', () => {
  it('returns template when all required fields present', () => {
    const result = getApplicableTemplates(MEDICAL_FAQ_TEMPLATES, {
      phone: '555-1234',
      insurance_types: ['Aetna', 'Cigna'],
      accepting_new_patients: true,
      telehealth_available: true,
      hours_data: { monday: { open: '09:00', close: '17:00' } },
      specialty_tags: ['Primary Care'],
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('excludes template when required field is null', () => {
    const result = getApplicableTemplates(
      MEDICAL_FAQ_TEMPLATES.filter((t) => t.id === 'med-faq-001'),
      { insurance_types: null },
    );
    expect(result).toHaveLength(0);
  });

  it('excludes template when required field is empty array', () => {
    const result = getApplicableTemplates(
      MEDICAL_FAQ_TEMPLATES.filter((t) => t.id === 'med-faq-001'),
      { insurance_types: [] },
    );
    expect(result).toHaveLength(0);
  });

  it('handles insurance template with populated insurance_types', () => {
    const result = getApplicableTemplates(
      MEDICAL_FAQ_TEMPLATES.filter((t) => t.id === 'med-faq-001'),
      { insurance_types: ['Delta Dental', 'Cigna'] },
    );
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('insurance');
  });

  it('excludes accepting_new_patients template when value is false', () => {
    const result = getApplicableTemplates(
      MEDICAL_FAQ_TEMPLATES.filter((t) => t.id === 'med-faq-004'),
      { accepting_new_patients: false, phone: '555-1234' },
    );
    expect(result).toHaveLength(0);
  });

  it('excludes telehealth template when telehealth_available is null', () => {
    const result = getApplicableTemplates(
      MEDICAL_FAQ_TEMPLATES.filter((t) => t.id === 'med-faq-007'),
      { telehealth_available: null, phone: '555-1234' },
    );
    expect(result).toHaveLength(0);
  });

  it('includes templates with no required fields', () => {
    const noReqTemplates = MEDICAL_FAQ_TEMPLATES.filter(
      (t) => t.requiredFields.length === 0,
    );
    // med-faq-006 has no required fields
    expect(noReqTemplates.length).toBeGreaterThan(0);
    const result = getApplicableTemplates(noReqTemplates, {});
    expect(result.length).toBe(noReqTemplates.length);
  });
});

// ---------------------------------------------------------------------------
// renderFAQTemplate()
// ---------------------------------------------------------------------------

describe('renderFAQTemplate()', () => {
  const sampleTemplate = MEDICAL_FAQ_TEMPLATES[0]; // insurance template

  it('substitutes all {businessName} placeholders', () => {
    const result = renderFAQTemplate(sampleTemplate, {
      businessName: 'Bright Smiles Dental',
      city: 'Atlanta',
      insuranceList: 'Delta Dental, Cigna',
    });
    expect(result).not.toBeNull();
    expect(result!.question).toContain('Bright Smiles Dental');
    expect(result!.answer).toContain('Bright Smiles Dental');
  });

  it('substitutes {city}, {phone}, {insuranceList}', () => {
    const result = renderFAQTemplate(sampleTemplate, {
      businessName: 'Test Practice',
      city: 'Chicago',
      phone: '312-555-0100',
      insuranceList: 'Aetna, BlueCross',
    });
    expect(result!.answer).toContain('Chicago');
    expect(result!.answer).toContain('Aetna, BlueCross');
  });

  it('uses fallback for missing phone ("us")', () => {
    const phoneTemplate = MEDICAL_FAQ_TEMPLATES.find((t) => t.id === 'med-faq-005')!;
    const result = renderFAQTemplate(phoneTemplate, {
      businessName: 'Test',
      city: 'LA',
      phone: null,
    });
    expect(result!.answer).toContain('us');
  });

  it('uses fallback for missing insuranceList', () => {
    const result = renderFAQTemplate(sampleTemplate, {
      businessName: 'Test',
      city: 'LA',
    });
    expect(result!.answer).toContain('most major insurance plans');
  });

  it('uses fallback for missing hoursString', () => {
    const hoursTemplate = MEDICAL_FAQ_TEMPLATES.find((t) => t.id === 'med-faq-012')!;
    const result = renderFAQTemplate(hoursTemplate, {
      businessName: 'Test',
      city: 'LA',
    });
    expect(result!.answer).toContain('during regular business hours');
  });
});

// ---------------------------------------------------------------------------
// checkMedicalCopy()
// ---------------------------------------------------------------------------

describe('checkMedicalCopy()', () => {
  it('approves clean copy without forbidden patterns', () => {
    const result = checkMedicalCopy(
      'Our practice offers a warm, welcoming environment for all patients.',
    );
    expect(result.approved).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('flags "we diagnose" as violation', () => {
    const result = checkMedicalCopy('We diagnose and manage chronic conditions.');
    expect(result.approved).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('flags "we treat" as violation', () => {
    const result = checkMedicalCopy('We treat all types of dental issues.');
    expect(result.approved).toBe(false);
  });

  it('flags "100% success" as violation', () => {
    const result = checkMedicalCopy('Our procedures have a 100% success rate.');
    expect(result.approved).toBe(false);
  });

  it('flags "guaranteed" as violation', () => {
    const result = checkMedicalCopy('Results are guaranteed or your money back.');
    expect(result.approved).toBe(false);
  });

  it('flags "painless" as violation', () => {
    const result = checkMedicalCopy('Our painless procedures are state of the art.');
    expect(result.approved).toBe(false);
  });

  it('flags "best doctor in" as violation', () => {
    const result = checkMedicalCopy('The best doctor in Atlanta.');
    expect(result.approved).toBe(false);
  });

  it('requires disclaimer when copy mentions "treatment"', () => {
    const result = checkMedicalCopy('We offer various treatment options for our patients.');
    expect(result.requiresDisclaimer).toBe(true);
    expect(result.suggestionToAdd).toBeTruthy();
  });

  it('requires disclaimer when copy mentions "procedure"', () => {
    const result = checkMedicalCopy('Each procedure is tailored to the patient.');
    expect(result.requiresDisclaimer).toBe(true);
  });

  it('does not require disclaimer for general business copy', () => {
    const result = checkMedicalCopy('Visit us in downtown Atlanta for quality care.');
    expect(result.requiresDisclaimer).toBe(false);
    expect(result.suggestionToAdd).toBeUndefined();
  });

  it('returns all violations when multiple patterns match', () => {
    const result = checkMedicalCopy('We guarantee painless procedures with no side effects.');
    expect(result.approved).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Templates count
// ---------------------------------------------------------------------------

describe('MEDICAL_FAQ_TEMPLATES', () => {
  it('has 15 templates', () => {
    expect(MEDICAL_FAQ_TEMPLATES).toHaveLength(15);
  });

  it('has unique IDs', () => {
    const ids = MEDICAL_FAQ_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all 5 categories', () => {
    const categories = new Set(MEDICAL_FAQ_TEMPLATES.map((t) => t.category));
    expect(categories).toContain('insurance');
    expect(categories).toContain('appointments');
    expect(categories).toContain('procedures');
    expect(categories).toContain('telehealth');
    expect(categories).toContain('practice');
  });
});

// ---------------------------------------------------------------------------
// Migration file
// ---------------------------------------------------------------------------

describe('Sprint 127 — Migration', () => {
  const migration = readFileSync(
    join(ROOT, 'supabase/migrations/20260322000005_medical_fields.sql'),
    'utf-8',
  );

  it('adds accepting_new_patients column', () => {
    expect(migration).toContain('"accepting_new_patients" boolean');
  });

  it('adds telehealth_available column', () => {
    expect(migration).toContain('"telehealth_available" boolean');
  });

  it('adds insurance_types column', () => {
    expect(migration).toContain('"insurance_types" jsonb');
  });

  it('adds specialty_tags column', () => {
    expect(migration).toContain('"specialty_tags" text[]');
  });
});

// ---------------------------------------------------------------------------
// Schema columns in prod_schema.sql
// ---------------------------------------------------------------------------

describe('Sprint 127 — Schema columns', () => {
  const schema = readFileSync(join(ROOT, 'supabase/prod_schema.sql'), 'utf-8');

  it('has accepting_new_patients on locations', () => {
    expect(schema).toContain('"accepting_new_patients" boolean');
  });

  it('has telehealth_available on locations', () => {
    expect(schema).toContain('"telehealth_available" boolean');
  });

  it('has insurance_types on locations', () => {
    expect(schema).toContain('"insurance_types" "jsonb"');
  });

  it('has specialty_tags on locations', () => {
    expect(schema).toContain('"specialty_tags" "text"[]');
  });
});

// ---------------------------------------------------------------------------
// Database types alignment
// ---------------------------------------------------------------------------

describe('Sprint 127 — Database types', () => {
  const types = readFileSync(
    join(ROOT, 'lib/supabase/database.types.ts'),
    'utf-8',
  );

  it('has accepting_new_patients in Row type', () => {
    expect(types).toContain('accepting_new_patients: boolean | null');
  });

  it('has telehealth_available in Row type', () => {
    expect(types).toContain('telehealth_available: boolean | null');
  });

  it('has insurance_types in Row type', () => {
    expect(types).toContain('insurance_types: Json | null');
  });

  it('has specialty_tags in Row type', () => {
    expect(types).toContain('specialty_tags: string[] | null');
  });
});
