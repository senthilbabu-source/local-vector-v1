'use client';

// ---------------------------------------------------------------------------
// LocationCard — Per-location card with actions (Sprint 100)
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { MoreHorizontal, Star, Archive } from 'lucide-react';
import { archiveLocation, setPrimaryLocation } from '@/app/actions/locations';
import LocationFormModal from './LocationFormModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocationCardData {
  id: string;
  business_name: string;
  display_name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
  timezone: string | null;
  operational_status: string | null;
  is_primary: boolean;
  created_at: string;
}

interface LocationCardProps {
  location: LocationCardData;
  isOwner: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LocationCard({ location, isOwner }: LocationCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const formatAddress = () => {
    const parts = [location.city, location.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  const statusBadge = () => {
    const status = location.operational_status;
    if (!status || status === 'OPERATIONAL') {
      return (
        <span className="inline-flex items-center rounded-full bg-signal-green/10 px-2.5 py-0.5 text-xs font-medium text-signal-green ring-1 ring-inset ring-signal-green/20">
          Operational
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-slate-400">
        {status}
      </span>
    );
  };

  function handleSetPrimary() {
    setMenuOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await setPrimaryLocation(location.id);
      if (!result.success) setError(result.error);
    });
  }

  function handleArchive() {
    setMenuOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await archiveLocation(location.id);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div
      data-testid={`location-row-${location.id}`}
      className={`rounded-xl bg-surface-dark border border-white/5 p-5 transition hover:border-white/10 ${isPending ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-white truncate pr-2">
          {location.display_name ?? location.business_name}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {location.is_primary && (
            <span
              data-testid={`location-primary-badge-${location.id}`}
              className="rounded-full bg-electric-indigo/10 px-2 py-0.5 text-xs font-medium text-electric-indigo ring-1 ring-inset ring-electric-indigo/20"
            >
              Primary
            </span>
          )}
          {statusBadge()}
        </div>
      </div>

      <p className="text-sm text-slate-400 mb-1">{formatAddress()}</p>
      {location.address_line1 && (
        <p className="text-xs text-slate-500 mb-2">{location.address_line1}</p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-alert-crimson mt-2 mb-2">{error}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
        <p className="text-xs text-slate-500">
          {location.phone ?? 'No phone'}
        </p>
        <div className="flex items-center gap-1">
          {/* Edit button */}
          <LocationFormModal initialData={location} />

          {/* Overflow menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              data-testid={`location-overflow-menu-${location.id}`}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-white/10 bg-surface-dark shadow-lg overflow-hidden">
                  {/* Set Primary — owner only, non-primary only */}
                  {isOwner && !location.is_primary && (
                    <button
                      onClick={handleSetPrimary}
                      disabled={isPending}
                      data-testid={`location-set-primary-btn-${location.id}`}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-white/5 transition disabled:opacity-50"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Set as Primary
                    </button>
                  )}

                  {/* Archive — non-primary only */}
                  {!location.is_primary && (
                    <button
                      onClick={handleArchive}
                      disabled={isPending}
                      data-testid={`location-archive-btn-${location.id}`}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-alert-crimson hover:bg-alert-crimson/10 transition disabled:opacity-50"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      Archive Location
                    </button>
                  )}

                  {/* Primary locations show message */}
                  {location.is_primary && (
                    <p className="px-3 py-2 text-xs text-slate-500">
                      Primary locations cannot be archived
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
