'use client';

// ---------------------------------------------------------------------------
// LocationSwitcher — Agency multi-location dropdown (Sprint 62F)
//
// Renders only when the org has > 1 location. Sets a cookie
// `lv_selected_location` and reloads on change.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';

export interface LocationOption {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  is_primary: boolean;
}

interface LocationSwitcherProps {
  locations: LocationOption[];
  selectedLocationId: string | null;
}

export default function LocationSwitcher({ locations, selectedLocationId }: LocationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only render when there are multiple locations
  if (locations.length <= 1) return null;

  const current = locations.find((l) => l.id === selectedLocationId) ?? locations[0];

  function handleSelect(locationId: string) {
    // Set cookie with 1-year expiry
    document.cookie = `lv_selected_location=${locationId}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
    setIsOpen(false);
    window.location.reload();
  }

  return (
    <div className="relative px-5 py-3 border-b border-white/5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full rounded-lg bg-midnight-slate px-3 py-2 text-left hover:bg-white/5 transition"
      >
        <MapPin className="h-4 w-4 shrink-0 text-signal-green" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-white">{current.business_name}</p>
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
          <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg border border-white/10 bg-surface-dark shadow-lg overflow-hidden">
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => handleSelect(loc.id)}
                className={`flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-white/5 transition ${
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
                    {loc.business_name}
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
          </div>
        </>
      )}
    </div>
  );
}
