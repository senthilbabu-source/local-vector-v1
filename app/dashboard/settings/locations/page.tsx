import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { maxLocations, type PlanTier } from '@/lib/plan-enforcer';
import { roleSatisfies } from '@/lib/auth/org-roles';
import { PlanGate } from '@/components/plan-gate/PlanGate';
import LocationCard, { type LocationCardData } from './_components/LocationCard';
import LocationFormModal from './_components/LocationFormModal';

// ---------------------------------------------------------------------------
// Location Management Page — /dashboard/settings/locations (Sprint 100)
//
// Lists all locations (non-archived) for the org. Agency plan required for
// multi-location access. Provides add/edit/archive/set-primary actions.
// ---------------------------------------------------------------------------

export default async function LocationsSettingsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');
  if (!ctx.orgId) redirect('/onboarding');

  const plan = (ctx.plan ?? 'trial') as PlanTier;
  const limit = maxLocations(plan);
  const isOwner = roleSatisfies(ctx.role, 'owner');

  const supabase = await createClient();

  // Fetch all non-archived locations
  const { data: rawLocations } = await supabase
    .from('locations')
    .select(
      'id, business_name, display_name, address_line1, city, state, zip, phone, website_url, timezone, operational_status, is_primary, created_at',
    )
    .eq('org_id', ctx.orgId)
    .eq('is_archived', false)
    .order('is_primary', { ascending: false })
    .order('location_order', { ascending: true })
    .order('created_at', { ascending: true });

  const locations: LocationCardData[] = (rawLocations ?? []).map((l) => ({
    id: l.id,
    business_name: l.business_name,
    display_name: l.display_name,
    address_line1: l.address_line1,
    city: l.city,
    state: l.state,
    zip: l.zip,
    phone: l.phone,
    website_url: l.website_url,
    timezone: l.timezone,
    operational_status: l.operational_status,
    is_primary: l.is_primary ?? false,
    created_at: l.created_at ?? '',
  }));

  const atLimit = locations.length >= limit;

  const content = (
    <div data-testid="locations-page" className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Locations</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Manage the physical locations you are monitoring for AI accuracy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Location count */}
          <p
            data-testid="location-count-display"
            className={`text-xs ${atLimit ? 'text-alert-amber' : 'text-slate-500'}`}
          >
            {locations.length} of {limit} locations used
          </p>
          {/* Add button — admin+ only */}
          {roleSatisfies(ctx.role, 'admin') && (
            <LocationFormModal
              disabled={atLimit}
              disabledReason={
                atLimit
                  ? plan === 'agency'
                    ? `Location limit reached (${limit})`
                    : 'Upgrade to Agency for more locations'
                  : undefined
              }
            />
          )}
        </div>
      </div>

      {/* Card grid */}
      {locations.length === 0 ? (
        <div className="overflow-hidden rounded-xl bg-surface-dark border border-white/5">
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-10 w-10 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-400">No locations yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Click &quot;Add Location&quot; to register your first business location.
            </p>
          </div>
        </div>
      ) : (
        <div data-testid="location-list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <LocationCard key={loc.id} location={loc} isOwner={isOwner} />
          ))}
        </div>
      )}
    </div>
  );

  // Wrap in plan gate for non-Agency users (multi-location is Agency only).
  // Single-location users on lower plans can still see their 1 location.
  if (locations.length <= 1 && limit === 1) {
    return content;
  }

  return (
    <PlanGate
      requiredPlan="agency"
      currentPlan={ctx.plan}
      feature="Multi-Location Management"
    >
      {content}
    </PlanGate>
  );
}
