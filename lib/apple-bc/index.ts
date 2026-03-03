// lib/apple-bc/index.ts — Sprint 130
// Barrel export for Apple Business Connect sync module.

export type { ABCLocation, ABCAddress, ABCHours, ABCSyncResult } from './apple-bc-types';
export { APPLE_CATEGORY_MAP } from './apple-bc-types';
export { toE164, toABCHours, toABCCategories, toABCStatus, buildABCLocation } from './apple-bc-mapper';
export { computeLocationDiff } from './apple-bc-diff';
export type { LocationDiff } from './apple-bc-diff';
export {
  searchABCLocation,
  getABCLocation,
  updateABCLocation,
  closeABCLocation,
  syncOneLocation,
} from './apple-bc-client';
