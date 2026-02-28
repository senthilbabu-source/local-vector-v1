// ---------------------------------------------------------------------------
// lib/industries/industry-config.ts — Industry Configuration SSOT
//
// Sprint E (M5): Single source of truth for industry-specific UI, schema,
// and copy. Each IndustryConfig entry defines everything needed to adapt
// LocalVector to a vertical without modifying the intelligence engines.
//
// To add a new vertical: add one entry to INDUSTRY_CONFIG and update the
// golden tenant fixture and SOV seeds. No engine changes needed.
// ---------------------------------------------------------------------------

import type { LucideIcon } from 'lucide-react';
import { Utensils, Stethoscope, Scale, Home } from 'lucide-react';

export type IndustryId = 'restaurant' | 'medical_dental' | 'legal' | 'real_estate';

export interface IndustryConfig {
  id: IndustryId;
  /** Display name for the industry (used in onboarding and admin) */
  label: string;
  /** Lucide icon component for the Magic Menus / Magic Services sidebar item */
  magicMenuIcon: LucideIcon;
  /** Sidebar nav label for the magic menu item ("Magic Menu" vs "Magic Services") */
  magicMenuLabel: string;
  /** What "menu/services" are called in this vertical */
  servicesNoun: string;
  /** What "cuisine/specialty" is called in this vertical */
  specialtyNoun: string;
  /** Onboarding wizard Step 4 search example placeholder */
  onboardingSearchPlaceholder: string;
  /** Schema.org @type values this industry generates */
  schemaTypes: string[];
  /** Short description of why AI hallucinations matter for this vertical */
  hallucinationRiskDescription: string;
}

export const INDUSTRY_CONFIG: Record<IndustryId, IndustryConfig> = {
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant / Food & Beverage',
    magicMenuIcon: Utensils,
    magicMenuLabel: 'Magic Menu',
    servicesNoun: 'Menu',
    specialtyNoun: 'Cuisine',
    onboardingSearchPlaceholder: 'best hookah bar with live music in Alpharetta',
    schemaTypes: ['Restaurant', 'FoodEstablishment', 'BarOrPub', 'NightClub'],
    hallucinationRiskDescription:
      'AI models showing wrong hours, wrong location, or wrong menu items cost you reservations and walk-ins.',
  },

  medical_dental: {
    id: 'medical_dental',
    label: 'Medical / Dental Practice',
    magicMenuIcon: Stethoscope,
    magicMenuLabel: 'Magic Services',
    servicesNoun: 'Services',
    specialtyNoun: 'Specialty',
    onboardingSearchPlaceholder: 'best pediatric dentist accepting new patients in Alpharetta',
    schemaTypes: ['Physician', 'Dentist', 'MedicalClinic', 'MedicalSpecialty'],
    hallucinationRiskDescription:
      'AI models showing wrong insurance networks, wrong credentials, or wrong specialties create legal risk and deter patients.',
  },

  // Placeholders for future verticals — not active in Sprint E:
  legal: {
    id: 'legal',
    label: 'Law Firm / Legal Practice',
    magicMenuIcon: Scale,
    magicMenuLabel: 'Magic Practice Areas',
    servicesNoun: 'Practice Areas',
    specialtyNoun: 'Specialty',
    onboardingSearchPlaceholder: 'best personal injury attorney in Alpharetta',
    schemaTypes: ['LegalService', 'Attorney'],
    hallucinationRiskDescription:
      'AI models citing wrong bar admissions, wrong specialties, or wrong contact info cost you qualified referrals.',
  },

  real_estate: {
    id: 'real_estate',
    label: 'Real Estate Agency',
    magicMenuIcon: Home,
    magicMenuLabel: 'Magic Listings',
    servicesNoun: 'Listings',
    specialtyNoun: 'Specialty',
    onboardingSearchPlaceholder: 'best real estate agent for luxury homes in Alpharetta',
    schemaTypes: ['RealEstateAgent', 'LocalBusiness'],
    hallucinationRiskDescription:
      'AI models showing outdated listings, wrong contact info, or wrong service areas cost you buyer and seller leads.',
  },
};

/**
 * Get industry config by ID, with safe fallback to restaurant.
 * Handles null, undefined, and unknown industry IDs gracefully.
 */
export function getIndustryConfig(industryId: string | null | undefined): IndustryConfig {
  if (!industryId) return INDUSTRY_CONFIG.restaurant;
  return INDUSTRY_CONFIG[industryId as IndustryId] ?? INDUSTRY_CONFIG.restaurant;
}
