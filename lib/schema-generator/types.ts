// ---------------------------------------------------------------------------
// lib/schema-generator/types.ts — Shared types for Schema Fix Generator
//
// Sprint 70: These types are consumed by all three generators (FAQ, Hours,
// LocalBusiness) and the data layer that populates them.
// ---------------------------------------------------------------------------

import type { HoursData, Amenities, Categories } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Input types — assembled from DB by the data layer
// ---------------------------------------------------------------------------

export interface SchemaLocationInput {
  business_name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  phone: string | null;
  website_url: string | null;
  hours_data: HoursData | null;
  amenities: Amenities | null;
  categories: Categories | null;
  google_place_id: string | null;
}

export interface SchemaIntegrationInput {
  platform: string;
  listing_url: string | null;
}

export interface SchemaQueryInput {
  query_text: string;
  query_category: string;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type SchemaType = 'FAQPage' | 'OpeningHoursSpecification' | 'LocalBusiness';

export interface GeneratedSchema {
  schemaType: SchemaType;
  jsonLd: object;
  jsonLdString: string;
  description: string;
  estimatedImpact: string;
  missingReason: string;
}
