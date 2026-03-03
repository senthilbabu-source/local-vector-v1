// lib/apple-bc/apple-bc-diff.ts — Sprint 130
// Computes field-level diff between LocalVector ground truth and Apple BC data.
// Returns only changed fields to prevent overwriting Apple's editorial data.
// PURE FUNCTION.

import type { ABCLocation } from './apple-bc-types';

export interface LocationDiff {
  hasChanges: boolean;
  changedFields: string[];
  updates: Partial<ABCLocation>;
}

/**
 * Compare LocalVector-mapped location with current Apple BC data.
 * Returns only the fields that differ.
 *
 * CRITICAL: Never send unchanged fields. Apple BC may have editorial
 * enrichments (photos, attributes) that we don't want to overwrite.
 */
export function computeLocationDiff(
  localVersion: Partial<ABCLocation>,
  appleVersion: Partial<ABCLocation> | null,
): LocationDiff {
  if (!appleVersion) {
    // Location not yet in ABC — full create
    return {
      hasChanges: true,
      changedFields: Object.keys(localVersion),
      updates: localVersion,
    };
  }

  const changedFields: string[] = [];
  const updates: Partial<ABCLocation> = {};

  // displayName
  if (localVersion.displayName && localVersion.displayName !== appleVersion.displayName) {
    changedFields.push('displayName');
    updates.displayName = localVersion.displayName;
  }

  // telephone
  if (localVersion.telephone && localVersion.telephone !== appleVersion.telephone) {
    changedFields.push('telephone');
    updates.telephone = localVersion.telephone;
  }

  // websiteUrl
  if (localVersion.websiteUrl && localVersion.websiteUrl !== appleVersion.websiteUrl) {
    changedFields.push('websiteUrl');
    updates.websiteUrl = localVersion.websiteUrl;
  }

  // status
  if (localVersion.status && localVersion.status !== appleVersion.status) {
    changedFields.push('status');
    updates.status = localVersion.status;
  }

  // address (compare as JSON string — deep comparison)
  if (localVersion.address) {
    const localAddr = JSON.stringify(localVersion.address);
    const appleAddr = JSON.stringify(appleVersion.address ?? {});
    if (localAddr !== appleAddr) {
      changedFields.push('address');
      updates.address = localVersion.address;
    }
  }

  // regularHours (compare as JSON string)
  if (localVersion.regularHours && localVersion.regularHours.length > 0) {
    const localHours = JSON.stringify(localVersion.regularHours);
    const appleHours = JSON.stringify(appleVersion.regularHours ?? []);
    if (localHours !== appleHours) {
      changedFields.push('regularHours');
      updates.regularHours = localVersion.regularHours;
    }
  }

  return {
    hasChanges: changedFields.length > 0,
    changedFields,
    updates,
  };
}
