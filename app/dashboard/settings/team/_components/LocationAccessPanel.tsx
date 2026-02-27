'use client';

// ---------------------------------------------------------------------------
// LocationAccessPanel — Sprint 99
//
// Expandable panel per team member showing location-level role overrides.
// Only visible for Agency plan, multi-location orgs, when current user is owner.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';

interface LocationAccess {
  locationId: string;
  locationName: string;
  effectiveRole: string;
  hasOverride: boolean;
}

interface LocationAccessPanelProps {
  memberId: string;
  memberRole: string;
  locations: LocationAccess[];
  isOwner: boolean;
  onRoleChange: (memberId: string, locationId: string, role: string) => Promise<void>;
}

export default function LocationAccessPanel({
  memberId,
  memberRole,
  locations,
  isOwner,
  onRoleChange,
}: LocationAccessPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Don't show for owner role (owner has access to everything)
  if (memberRole === 'owner') return null;

  // Don't show for single location orgs
  if (locations.length <= 1) return null;

  function handleRoleChange(locationId: string, newRole: string) {
    startTransition(async () => {
      await onRoleChange(memberId, locationId, newRole);
    });
  }

  function roleBadgeColor(role: string) {
    switch (role) {
      case 'owner':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'admin':
        return 'bg-electric-indigo/10 text-electric-indigo';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  }

  return (
    <div data-testid={`location-access-panel-${memberId}`} className="px-4 pb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <MapPin className="h-3 w-3" />
        Location Access ({locations.length} locations)
      </button>

      {expanded && (
        <div className="mt-2 ml-5 space-y-1.5">
          {locations.map((loc) => (
            <div
              key={loc.locationId}
              className="flex items-center gap-2 text-xs"
            >
              <span className="flex-1 text-slate-300 truncate">
                {loc.locationName}
              </span>

              {/* Role badge or select */}
              {isOwner ? (
                <select
                  data-testid={`location-role-select-${memberId}-${loc.locationId}`}
                  value={loc.hasOverride ? loc.effectiveRole : 'default'}
                  onChange={(e) => handleRoleChange(loc.locationId, e.target.value)}
                  disabled={isPending}
                  className="text-xs bg-slate-700 text-slate-300 border border-slate-600 rounded px-1.5 py-0.5"
                >
                  <option value="default">
                    Org Default ({memberRole})
                  </option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span
                  data-testid={`location-role-badge-${memberId}-${loc.locationId}`}
                  className={`px-1.5 py-0.5 rounded text-xs ${roleBadgeColor(loc.effectiveRole)}`}
                >
                  {loc.effectiveRole}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
