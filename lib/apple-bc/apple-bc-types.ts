// Apple Business Connect API response types.
// Sprint 130: Minimal — only fields LocalVector writes/reads.

export interface ABCLocation {
  locationId: string;           // Apple's internal ID
  displayName: string;
  address: ABCAddress;
  telephone?: string;           // Must be E.164: +14045551234
  regularHours?: ABCHours[];
  categories?: string[];        // Apple category IDs
  status?: 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY';
  websiteUrl?: string;
}

export interface ABCAddress {
  addressLine1: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;  // ISO 3166-1 alpha-2, e.g. "US"
}

export interface ABCHours {
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  openTime?: string;   // "HH:MM" 24-hour
  closeTime?: string;  // "HH:MM" 24-hour
  isClosed?: boolean;
}

export interface ABCSyncResult {
  locationId: string;
  appleLocationId: string | null;
  fieldsUpdated: string[];
  status: 'success' | 'error' | 'no_changes' | 'skipped';
  errorMessage?: string;
}

// Apple category taxonomy — top 20 mapped to LocalVector categories
export const APPLE_CATEGORY_MAP: Record<string, string> = {
  'Restaurant': 'RESTAURANT',
  'FoodEstablishment': 'RESTAURANT',
  'BarOrPub': 'BAR',
  'NightClub': 'NIGHTCLUB',
  'Cafe': 'COFFEE_SHOP',
  'Physician': 'MEDICAL_OFFICE',
  'Dentist': 'DENTIST',
  'MedicalClinic': 'MEDICAL_CLINIC',
  'LegalService': 'LAWYER',
  'Attorney': 'LAWYER',
  'RealEstateAgent': 'REAL_ESTATE',
  'HairSalon': 'HAIR_SALON',
  'GymOrFitnessCenter': 'GYM',
  'Hotel': 'HOTEL',
  'RetailStore': 'SHOPPING',
  'AutoRepair': 'AUTO_REPAIR',
  'Bakery': 'BAKERY',
  'PetStore': 'PET_STORE',
  'LodgingBusiness': 'LODGING',
  'Store': 'SHOPPING',
};
