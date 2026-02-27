import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';
import BusinessInfoForm from './_components/BusinessInfoForm';

// ---------------------------------------------------------------------------
// BusinessInfoPage — Server Component (Sprint 93)
//
// Fetches the org's primary location and GBP connection status, then renders
// the BusinessInfoForm client component with pre-populated values.
//
// Pattern reference: app/dashboard/settings/revenue/page.tsx
// ---------------------------------------------------------------------------

export interface BusinessInfoPageData {
  location: {
    id: string;
    name: string;
    business_name: string;
    phone: string | null;
    website_url: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    hours_data: HoursData | null;
    amenities: Partial<Amenities> | null;
    categories: string[] | null;
    operational_status: string | null;
    gbp_synced_at: string | null;
  } | null;
  hasGBPConnection: boolean;
}

export default async function BusinessInfoPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const orgId = ctx.orgId ?? '';
  const supabase = await createClient();

  // Fetch primary location for this org.
  const { data: locationRow } = await supabase
    .from('locations')
    .select(
      'id, name, business_name, phone, website_url, address_line1, city, state, zip, hours_data, amenities, categories, operational_status, gbp_synced_at'
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Check GBP connection via google_oauth_tokens (service-role — table is RLS-locked).
  const serviceClient = createServiceRoleClient();
  const { data: tokenRow } = await serviceClient
    .from('google_oauth_tokens')
    .select('id')
    .eq('org_id', orgId)
    .maybeSingle();

  const location = locationRow
    ? {
        id: locationRow.id,
        name: locationRow.name,
        business_name: locationRow.business_name,
        phone: locationRow.phone,
        website_url: locationRow.website_url,
        address_line1: locationRow.address_line1,
        city: locationRow.city,
        state: locationRow.state,
        zip: locationRow.zip,
        hours_data: locationRow.hours_data as HoursData | null,
        amenities: locationRow.amenities as Partial<Amenities> | null,
        categories: locationRow.categories as string[] | null,
        operational_status: locationRow.operational_status,
        gbp_synced_at: locationRow.gbp_synced_at,
      }
    : null;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Business Information
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Keep your hours and details accurate — AI models cite what they find.
          Wrong hours here means AI hallucinations about you.
        </p>
      </div>
      <BusinessInfoForm
        location={location}
        hasGBPConnection={!!tokenRow}
      />
    </div>
  );
}
