// lib/bing-places/bing-places-types.ts — Sprint 131
// Bing's schema is simpler than Apple's — closer to Google format.

export interface BingLocation {
  listingId?: string;
  businessName: string;
  address: BingAddress;
  phone?: string;           // E.164 format (same as Apple)
  website?: string;
  hours?: BingHours[];
  categories?: string[];    // Bing category IDs (Google-compatible for most)
  status?: 'OPEN' | 'CLOSED' | 'TEMPORARILY_CLOSED';
}

export interface BingAddress {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface BingHours {
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  openTime?: string;   // "HH:MM" 24-hour
  closeTime?: string;
  isClosed?: boolean;
}

export interface BingSyncResult {
  locationId: string;
  bingListingId: string | null;
  fieldsUpdated: string[];
  status: 'success' | 'error' | 'no_changes' | 'skipped';
  errorMessage?: string;
}

// Bing uses Google-compatible category IDs for most types
export const BING_CATEGORY_MAP: Record<string, string> = {
  'Restaurant': 'gcid:restaurant',
  'FoodEstablishment': 'gcid:restaurant',
  'BarOrPub': 'gcid:bar',
  'NightClub': 'gcid:night_club',
  'Cafe': 'gcid:cafe',
  'Physician': 'gcid:doctor',
  'Dentist': 'gcid:dentist',
  'MedicalClinic': 'gcid:medical_clinic',
  'LegalService': 'gcid:lawyer',
  'HairSalon': 'gcid:hair_salon',
  'GymOrFitnessCenter': 'gcid:gym',
  'Hotel': 'gcid:lodging',
  'RetailStore': 'gcid:store',
  'AutoRepair': 'gcid:car_repair',
  'Bakery': 'gcid:bakery',
};
