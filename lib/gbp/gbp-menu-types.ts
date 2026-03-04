// ---------------------------------------------------------------------------
// lib/gbp/gbp-menu-types.ts — Sprint 2: GBP Food Menus Push
//
// TypeScript types matching the Google Business Profile updateFoodMenus API.
// Ref: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.foodMenus
// ---------------------------------------------------------------------------

/**
 * Money amount in the format expected by GBP API.
 * Uses units + nanos representation (e.g. $12.50 → { currencyCode: 'USD', units: '12', nanos: 500000000 }).
 */
export interface GBPMoneyAmount {
  currencyCode: string; // ISO 4217, e.g. "USD"
  units: string; // Whole part as string
  nanos: number; // Fractional part in nano-units (1 billionth)
}

/**
 * A single menu item in GBP Food Menus format.
 */
export interface GBPMenuItem {
  name: string;
  price?: GBPMoneyAmount;
  description?: string;
}

/**
 * A section (category) of a GBP Food Menu.
 */
export interface GBPMenuSection {
  name: string;
  items: GBPMenuItem[];
}

/**
 * Top-level GBP Food Menu object.
 * Sent via PATCH to accounts/{a}/locations/{l}/foodMenus.
 */
export interface GBPFoodMenu {
  menus: Array<{
    menuName: string;
    sections: GBPMenuSection[];
  }>;
}
