// ---------------------------------------------------------------------------
// lib/schema-generator/medical-types.ts — Medical/Dental Schema.org Types
//
// Sprint E (M5): Schema.org types for Medical/Dental practices.
// References:
//   https://schema.org/Physician
//   https://schema.org/Dentist
//   https://schema.org/MedicalClinic
//
// These types are additive — they do not modify existing restaurant types.
// PURE FUNCTION — no DB, no fetch, no side effects.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Schema interfaces
// ---------------------------------------------------------------------------

export interface PhysicianSchema {
  '@context': 'https://schema.org';
  '@type': 'Physician';
  name: string;
  description?: string;
  url?: string;
  telephone?: string;
  address: {
    '@type': 'PostalAddress';
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: 'US';
  };
  geo?: {
    '@type': 'GeoCoordinates';
    latitude: number;
    longitude: number;
  };
  openingHoursSpecification?: OpeningHoursSpecification[];
  medicalSpecialty?: string[];
  availableService?: MedicalService[];
  hasMap?: string;
  aggregateRating?: AggregateRating;
  image?: string;
}

export interface DentistSchema extends Omit<PhysicianSchema, '@type'> {
  '@type': 'Dentist';
}

export interface MedicalClinicSchema {
  '@context': 'https://schema.org';
  '@type': 'MedicalClinic';
  name: string;
  description?: string;
  url?: string;
  telephone?: string;
  address: PhysicianSchema['address'];
  geo?: PhysicianSchema['geo'];
  medicalSpecialty?: string[];
  availableService?: MedicalService[];
  openingHoursSpecification?: OpeningHoursSpecification[];
  hasMap?: string;
  aggregateRating?: AggregateRating;
}

interface MedicalService {
  '@type': 'MedicalProcedure' | 'MedicalTherapy' | 'DiagnosticProcedure';
  name: string;
  description?: string;
}

interface OpeningHoursSpecification {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string | string[];
  opens: string;
  closes: string;
}

interface AggregateRating {
  '@type': 'AggregateRating';
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}

// ---------------------------------------------------------------------------
// Input type for medical schema generation
// ---------------------------------------------------------------------------

export interface MedicalSchemaInput {
  name: string;
  specialty?: string | null;
  phone?: string | null;
  website?: string | null;
  address: { street: string; city: string; state: string; zip: string };
  lat?: number | null;
  lng?: number | null;
  hours?: Record<string, { open: string | null; close: string | null }> | null;
  services?: string[];
  rating?: { value: number; count: number } | null;
}

// ---------------------------------------------------------------------------
// Schema generation
// ---------------------------------------------------------------------------

/**
 * Generates a Physician or Dentist schema from org data.
 * Returns Dentist @type when specialty contains 'dent', otherwise Physician.
 */
export function generateMedicalSchema(
  org: MedicalSchemaInput,
): PhysicianSchema | DentistSchema {
  const isDentist = org.specialty?.toLowerCase().includes('dent') ?? false;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org' as const,
    '@type': isDentist ? 'Dentist' : 'Physician',
    name: org.name,
    address: {
      '@type': 'PostalAddress' as const,
      streetAddress: org.address.street,
      addressLocality: org.address.city,
      addressRegion: org.address.state,
      postalCode: org.address.zip,
      addressCountry: 'US' as const,
    },
  };

  if (org.phone) schema.telephone = org.phone;
  if (org.website) schema.url = org.website;

  if (org.lat != null && org.lng != null) {
    schema.geo = {
      '@type': 'GeoCoordinates' as const,
      latitude: org.lat,
      longitude: org.lng,
    };
  }

  if (org.specialty) {
    schema.medicalSpecialty = [org.specialty];
  }

  if (org.services?.length) {
    schema.availableService = org.services.map((s) => ({
      '@type': 'MedicalProcedure' as const,
      name: s,
    }));
  }

  if (org.hours) {
    const specs = buildHoursSpecification(org.hours);
    if (specs.length > 0) {
      schema.openingHoursSpecification = specs;
    }
  }

  if (org.rating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating' as const,
      ratingValue: org.rating.value,
      reviewCount: org.rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema as unknown as PhysicianSchema | DentistSchema;
}

// ---------------------------------------------------------------------------
// Hours helper
// ---------------------------------------------------------------------------

export function buildHoursSpecification(
  hours: Record<string, { open: string | null; close: string | null }>,
): OpeningHoursSpecification[] {
  const DAY_MAP: Record<string, string> = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };

  return Object.entries(hours)
    .filter(([, h]) => h.open && h.close)
    .map(([day, h]) => ({
      '@type': 'OpeningHoursSpecification' as const,
      dayOfWeek: DAY_MAP[day.toLowerCase()] ?? day,
      opens: h.open!,
      closes: h.close!,
    }));
}
