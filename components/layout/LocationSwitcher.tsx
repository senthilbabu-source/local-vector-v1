'use client';

// ---------------------------------------------------------------------------
// LocationSwitcher — Agency multi-location dropdown (Sprint 62F, Sprint 100)
//
// Renders only when the org has > 1 location. Uses server action to set
// HttpOnly cookie and reloads on change. Filters archived locations
// (handled upstream by resolveActiveLocation).
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { MapPin, ChevronDown, Settings } from 'lucide-react';
import Link from 'next/link';
import { switchActiveLocation } from '@/app/actions/locations';

export interface LocationOption {
  id: string;
  business_name: string;
  display_name: string | null;
  city: string | null;
  state: string | null;
  is_primary: boolean;
}

interface LocationSwitcherProps {
  locations: LocationOption[];
  selectedLocationId: string | null;
  plan?: string | null;
}

export default function LocationSwitcher({ locations, selectedLocationId, plan }: LocationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Only render when there are multiple locations
  if (locations.length <= 1) return null;

  const current = locations.find((l) => l.id === selectedLocationId) ?? locations[0];
  const displayLabel = (loc: LocationOption) => loc.display_name ?? loc.business_name;

  function handleSelect(locationId: string) {
    if (locationId === selectedLocationId) {
      setIsOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await switchActiveLocation(locationId);
      if (result.success) {
        setIsOpen(false);
        window.location.reload();
      }
    });
  }

  return (
    <div className="relative px-5 py-3 border-b border-white/5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        data-testid="location-switcher-trigger"
        className="flex items-center gap-2 w-full rounded-lg bg-midnight-slate px-3 py-2 text-left hover:bg-white/5 transition disabled:opacity-60"
      >
        <MapPin className="h-4 w-4 shrink-0 text-signal-green" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {isPending ? 'Switching…' : displayLabel(current)}
          </p>
          <p className="truncate text-xs text-slate-500">
            {[current.city, current.state].filter(Boolean).join(', ') || 'No location'}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div
            data-testid="location-switcher"
            className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg border border-white/10 bg-surface-dark shadow-lg overflow-hidden"
          >
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => handleSelect(loc.id)}
                disabled={isPending}
                data-testid={`location-switcher-option-${loc.id}`}
                className={`flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-white/5 transition disabled:opacity-60 ${
                  loc.id === selectedLocationId ? 'bg-signal-green/10' : ''
                }`}
              >
                <MapPin
                  className={`h-3.5 w-3.5 shrink-0 ${
                    loc.id === selectedLocationId ? 'text-signal-green' : 'text-slate-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`truncate text-sm font-medium ${
                    loc.id === selectedLocationId ? 'text-signal-green' : 'text-white'
                  }`}>
                    {displayLabel(loc)}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {[loc.city, loc.state].filter(Boolean).join(', ')}
                  </p>
                </div>
                {loc.is_primary && (
                  <span className="rounded-full bg-electric-indigo/10 px-1.5 py-0.5 text-[10px] font-medium text-electric-indigo">
                    Primary
                  </span>
                )}
              </button>
            ))}

            {/* Manage Locations link — Agency orgs only */}
            {plan === 'agency' && (
              <Link
                href="/dashboard/settings/locations"
                onClick={() => setIsOpen(false)}
                data-testid="location-switcher-manage-link"
                className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-400 hover:text-white border-t border-white/5 transition"
              >
                <Settings className="h-3 w-3" />
                Manage Locations
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
