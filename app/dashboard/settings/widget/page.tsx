// ---------------------------------------------------------------------------
// app/dashboard/settings/widget/page.tsx — Widget Settings (Sprint 133)
//
// Shows data completeness bar (from checkRAGReadiness()), enable/disable toggle,
// customization (color, position, greeting), embed code, and live preview.
//
// Plan gate: Growth+ required.
// If completenessScore < 80: show gap list, disable toggle.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { canEmbedWidget } from '@/lib/plan-enforcer';
import type { PlanTier } from '@/lib/plan-enforcer';
import { getActiveLocationId } from '@/lib/location/active-location';
import { checkRAGReadiness } from '@/lib/rag/rag-readiness-check';
import type { RAGReadinessInput } from '@/lib/rag/rag-readiness-check';
import WidgetSettingsForm from './_components/WidgetSettingsForm';

export const metadata = { title: 'Website Chat | LocalVector.ai' };

export default async function WidgetSettingsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  const planTier = (ctx.plan ?? 'trial') as PlanTier;

  // ── Plan gate ───────────────────────────────────────────────────────
  if (!canEmbedWidget(planTier)) {
    return (
      <div data-testid="widget-settings-page" className="max-w-2xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Chat Widget
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Embed a truth-grounded AI chatbot on your website.
          </p>
        </div>
        <div
          data-testid="upgrade-prompt"
          className="rounded-2xl border border-white/5 bg-surface-dark p-8 text-center space-y-3"
        >
          <p className="text-sm text-slate-300">
            The Chat Widget is available on the Growth plan and above.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-block rounded-xl bg-electric-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-electric-indigo/90"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>
    );
  }

  // ── Fetch location data ─────────────────────────────────────────────
  const supabase = await createClient();
  const locationId = await getActiveLocationId(supabase, ctx.orgId!) as string | null;

  if (!locationId) {
    return (
      <div data-testid="widget-settings-page" className="max-w-2xl space-y-5">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Chat Widget
        </h1>
        <p className="text-sm text-slate-400">
          No active location found. Add a location first.
        </p>
      </div>
    );
  }

  // Fetch location + menu item count + amenity info for readiness check
  const [locationResult, menuCountResult] = await Promise.all([
    (supabase
      .from('locations') as any)
      .select(
        'widget_enabled, widget_settings, hours_data, amenities, operational_status',
      )
      .eq('id', locationId)
      .single() as Promise<{ data: { widget_enabled: boolean; widget_settings: Record<string, unknown> | null; hours_data: Record<string, unknown> | null; amenities: Record<string, boolean | null> | null; operational_status: string | null } | null; error: unknown }>,
    supabase
      .from('menu_items')
      .select(
        'id, menu_categories!inner(menu_id, magic_menus!inner(location_id, is_published))',
      )
      .eq('menu_categories.magic_menus.location_id', locationId)
      .eq('menu_categories.magic_menus.is_published', true),
  ]);

  const location = locationResult.data;
  if (!location) {
    return (
      <div data-testid="widget-settings-page" className="max-w-2xl space-y-5">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Chat Widget
        </h1>
        <p className="text-sm text-slate-400">Location data not found.</p>
      </div>
    );
  }

  // Compute readiness
  const amenities = (location.amenities ?? {}) as Record<
    string,
    boolean | null
  >;
  const amenityEntries = Object.entries(amenities);
  const amenitiesSetCount = amenityEntries.filter(
    ([, v]) => v !== null,
  ).length;

  const hoursData = location.hours_data as Record<string, unknown> | null;
  const DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  const hoursDataComplete = hoursData
    ? DAYS.every((d) => hoursData[d] !== undefined && hoursData[d] !== null)
    : false;

  const readinessInput: RAGReadinessInput = {
    menuItemCount: menuCountResult.data?.length ?? 0,
    amenitiesSetCount,
    amenitiesTotal: amenityEntries.length,
    hoursDataComplete,
    operationalStatusSet:
      !!location.operational_status && location.operational_status !== '',
  };

  const readiness = checkRAGReadiness(readinessInput);

  const settings = (location.widget_settings ?? {}) as {
    color?: string;
    position?: string;
    greeting?: string;
    daily_limit?: number;
  };

  // Get the public slug for embed code
  const { data: menu } = await supabase
    .from('magic_menus')
    .select('public_slug')
    .eq('location_id', locationId)
    .eq('is_published', true)
    .limit(1)
    .single();

  const publicSlug = menu?.public_slug ?? null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://localvector.ai';

  return (
    <div data-testid="widget-settings-page" className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Chat Widget
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Embed a truth-grounded AI chatbot on your website.
        </p>
      </div>

      {/* Completeness bar */}
      <div className="rounded-2xl border border-white/5 bg-surface-dark p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">
            Data Completeness
          </span>
          <span
            className={`text-sm font-bold ${readiness.ready ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {readiness.completenessScore}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10">
          <div
            className={`h-2 rounded-full transition-all ${readiness.ready ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${readiness.completenessScore}%` }}
            data-testid="completeness-bar"
          />
        </div>
        {!readiness.ready && (
          <div className="space-y-1" data-testid="completeness-gaps">
            <p className="text-xs text-slate-400">
              Complete the following to enable the widget (need 80%+):
            </p>
            {readiness.gaps.map((gap, i) => (
              <p key={i} className="text-xs text-amber-400">
                • {gap}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Settings form */}
      <WidgetSettingsForm
        locationId={locationId}
        widgetEnabled={location.widget_enabled}
        canEnable={readiness.ready}
        color={settings.color ?? '#6366f1'}
        position={settings.position ?? 'bottom-right'}
        greeting={settings.greeting ?? 'Ask us anything!'}
        publicSlug={publicSlug}
        appUrl={appUrl}
      />
    </div>
  );
}
