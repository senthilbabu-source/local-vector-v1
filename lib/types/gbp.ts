// ---------------------------------------------------------------------------
// lib/types/gbp.ts — Google Business Profile API Response Types
//
// Source: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md §3.4
// Reference: https://developers.google.com/my-business/reference/businessinformation/rest
// ---------------------------------------------------------------------------

export interface GBPAccount {
  name: string; // "accounts/1234567890"
  accountName: string; // "My Business Name"
  type: string; // "PERSONAL" | "LOCATION_GROUP" | "USER_GROUP"
}

export interface GBPLocation {
  name: string; // "accounts/.../locations/987654321"
  title: string; // Business display name

  storefrontAddress?: {
    addressLines?: string[]; // ["123 Main St", "Suite 100"]
    locality?: string; // City
    administrativeArea?: string; // State code ("GA")
    postalCode?: string;
    regionCode?: string; // Country ("US")
  };

  regularHours?: {
    periods: Array<{
      openDay: string; // "MONDAY" | "TUESDAY" | ...
      openTime: { hours: number; minutes?: number };
      closeDay: string;
      closeTime: { hours: number; minutes?: number };
    }>;
  };

  primaryPhone?: string; // "(470) 546-4866"
  websiteUri?: string; // "https://charcoalnchill.com"
  metadata?: {
    placeId: string; // Google Maps place_id
    mapsUri?: string;
    newReviewUri?: string;
  };
}
