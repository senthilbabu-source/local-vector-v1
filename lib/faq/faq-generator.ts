// ---------------------------------------------------------------------------
// lib/faq/faq-generator.ts — Sprint 128: Dynamic FAQ Generator
//
// Generates FAQ Q&A pairs from location ground truth.
// PURE FUNCTION — no I/O, no DB, no side effects.
// AI_RULES §160
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';
import { isMedicalCategory } from '@/lib/services/sov-seed';
import {
  MEDICAL_FAQ_TEMPLATES,
  getApplicableTemplates,
  renderFAQTemplate,
} from '@/lib/services/medical-faq-templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FAQPair {
  id: string; // content hash (SHA-256 of question, first 12 chars)
  question: string;
  answer: string;
  contentHash: string; // SHA-256 of question (full, for exclusion matching)
  source: 'hours' | 'location' | 'menu' | 'amenity' | 'operational' | 'medical';
}

export interface FAQGeneratorInput {
  name: string;
  city: string;
  state: string;
  phone: string | null;
  website_url: string | null;
  hours_data: Record<string, { open: string; close: string } | null> | null;
  amenities: Record<string, boolean | null> | null;
  categories: string[] | null;
  display_name: string | null;
  operational_status: string;
  // Menu data
  menuItemNames: string[]; // top 5 published menu item names
  // Medical fields (Sprint 127)
  accepting_new_patients: boolean | null;
  telehealth_available: boolean | null;
  insurance_types: string[] | null;
  specialty_tags: string[] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function makeHash(question: string): string {
  return createHash('sha256').update(question).digest('hex');
}

function formatHours(
  hours_data: FAQGeneratorInput['hours_data'],
): string {
  if (!hours_data) return 'during regular business hours';
  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  const open = days.filter(
    (d) => hours_data[d] !== null && hours_data[d] !== undefined,
  );
  if (open.length === 7) return 'Monday–Sunday';
  if (
    open.length === 5 &&
    !open.includes('saturday') &&
    !open.includes('sunday')
  )
    return 'Monday–Friday';
  return open
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3))
    .join(', ');
}

// ---------------------------------------------------------------------------
// Core: Generate FAQ pairs from location ground truth
// ---------------------------------------------------------------------------

/**
 * Generate FAQ pairs from location ground truth.
 * Returns 0–15 pairs. Never generates for null fields.
 * PURE FUNCTION — no side effects.
 */
export function generateFAQs(input: FAQGeneratorInput): FAQPair[] {
  const pairs: FAQPair[] = [];
  const isMedical = isMedicalCategory(input.categories ?? []);

  // ── Hours ─────────────────────────────────────────────────────────
  if (input.hours_data) {
    const hoursStr = formatHours(input.hours_data);
    const q = `What are ${input.name}'s hours?`;
    const a = `${input.name} in ${input.city}, ${input.state} is open ${hoursStr}.${input.phone ? ` Call ${input.phone} for holiday hours.` : ''}`;
    const hash = makeHash(q);
    pairs.push({
      id: hash.slice(0, 12),
      question: q,
      answer: a,
      contentHash: hash,
      source: 'hours',
    });
  }

  // ── Location ──────────────────────────────────────────────────────
  if (input.city && input.state) {
    const q = `Where is ${input.name} located?`;
    const a = `${input.name} is located in ${input.city}, ${input.state}.${input.phone ? ` Call ${input.phone} for directions.` : ''}`;
    const hash = makeHash(q);
    pairs.push({
      id: hash.slice(0, 12),
      question: q,
      answer: a,
      contentHash: hash,
      source: 'location',
    });
  }

  // ── Phone / Contact ───────────────────────────────────────────────
  if (input.phone) {
    const q = `How do I contact ${input.name}?`;
    const a = `Call ${input.name} at ${input.phone}.${input.website_url ? ` You can also visit ${input.website_url} for more information.` : ''}`;
    const hash = makeHash(q);
    pairs.push({
      id: hash.slice(0, 12),
      question: q,
      answer: a,
      contentHash: hash,
      source: 'location',
    });
  }

  // ── Operational Status ────────────────────────────────────────────
  if (input.operational_status === 'OPERATIONAL') {
    const q = `Is ${input.name} still open?`;
    const a = `Yes, ${input.name} in ${input.city} is currently open and operating.`;
    const hash = makeHash(q);
    pairs.push({
      id: hash.slice(0, 12),
      question: q,
      answer: a,
      contentHash: hash,
      source: 'operational',
    });
  }

  // ── Menu Items (non-medical only) ─────────────────────────────────
  if (!isMedical && input.menuItemNames.length > 0) {
    const topItems = input.menuItemNames.slice(0, 3).join(', ');
    const q = `What does ${input.name} serve?`;
    const a = `${input.name} serves items including ${topItems}. Visit our menu page for the full selection.`;
    const hash = makeHash(q);
    pairs.push({
      id: hash.slice(0, 12),
      question: q,
      answer: a,
      contentHash: hash,
      source: 'menu',
    });
  }

  // ── Amenities (non-medical only) ──────────────────────────────────
  if (!isMedical && input.amenities) {
    const trueAmenities = Object.entries(input.amenities)
      .filter(([, v]) => v === true)
      .map(([k]) => k.replace(/_/g, ' '))
      .slice(0, 3);

    if (trueAmenities.length > 0) {
      const q = `Does ${input.name} have ${trueAmenities[0]}?`;
      const a = `Yes, ${input.name} in ${input.city} offers ${trueAmenities.join(', ')}.`;
      const hash = makeHash(q);
      pairs.push({
        id: hash.slice(0, 12),
        question: q,
        answer: a,
        contentHash: hash,
        source: 'amenity',
      });
    }
  }

  // ── Medical Templates (Sprint 127) ────────────────────────────────
  if (isMedical) {
    const locationData: Record<string, unknown> = {
      accepting_new_patients: input.accepting_new_patients,
      telehealth_available: input.telehealth_available,
      insurance_types: input.insurance_types,
      specialty_tags: input.specialty_tags,
      phone: input.phone,
      hours_data: input.hours_data,
    };
    const applicable = getApplicableTemplates(
      MEDICAL_FAQ_TEMPLATES,
      locationData,
    );
    const insuranceList = input.insurance_types?.join(', ') ?? undefined;

    for (const template of applicable.slice(0, 8)) {
      const rendered = renderFAQTemplate(template, {
        businessName: input.name,
        city: input.city,
        phone: input.phone,
        insuranceList,
        hoursString: formatHours(input.hours_data),
      });
      if (rendered) {
        const hash = makeHash(rendered.question);
        pairs.push({
          id: hash.slice(0, 12),
          question: rendered.question,
          answer: rendered.answer,
          contentHash: hash,
          source: 'medical',
        });
      }
    }
  }

  // Cap at 15 pairs
  return pairs.slice(0, 15);
}

// ---------------------------------------------------------------------------
// Exclusion filter
// ---------------------------------------------------------------------------

/**
 * Filter out excluded pairs by content hash.
 */
export function applyExclusions(
  pairs: FAQPair[],
  excludedHashes: string[],
): FAQPair[] {
  const excluded = new Set(excludedHashes);
  return pairs.filter((p) => !excluded.has(p.contentHash));
}
