// lib/bing-places/index.ts — Sprint 131
// Barrel export for Bing Places sync module.

export type { BingLocation, BingAddress, BingHours, BingSyncResult } from './bing-places-types';
export { BING_CATEGORY_MAP } from './bing-places-types';
export { toBingHours, toBingCategories, toBingStatus, buildBingLocation } from './bing-places-mapper';
export {
  searchBingBusiness,
  getBingLocation,
  updateBingLocation,
  closeBingLocation,
  syncOneBingLocation,
} from './bing-places-client';
