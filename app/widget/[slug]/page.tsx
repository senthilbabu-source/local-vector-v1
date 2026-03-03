// ---------------------------------------------------------------------------
// app/widget/[slug]/page.tsx — RAG Chat Widget UI (Sprint 133)
//
// Minimal iframe-rendered widget UI. White-label ready.
// Renders inside an iframe at localvector.ai/widget/[slug]
//
// Stateless per session — no chat history persistence.
// Question text is NEVER sent to analytics.
// ---------------------------------------------------------------------------

import { createServiceRoleClient } from '@/lib/supabase/server';
import WidgetChat from './WidgetChat';

export const dynamic = 'force-dynamic';

interface WidgetPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WidgetPage({ params }: WidgetPageProps) {
  const { slug } = await params;

  const supabase = createServiceRoleClient();

  // Resolve slug to location
  const { data: menu } = await supabase
    .from('magic_menus')
    .select('location_id')
    .eq('public_slug', slug)
    .eq('is_published', true)
    .single();

  if (!menu?.location_id) {
    return (
      <div className="flex h-screen items-center justify-center bg-white p-4 text-center text-sm text-gray-500">
        Chat widget not available.
      </div>
    );
  }

  // Fetch location info for the widget
  const { data: location } = await (supabase
    .from('locations') as any)
    .select(
      'business_name, phone, widget_enabled, widget_settings, org_id',
    )
    .eq('id', menu.location_id)
    .single() as { data: { business_name: string | null; phone: string | null; widget_enabled: boolean; widget_settings: Record<string, unknown> | null; org_id: string } | null };

  if (!location?.widget_enabled) {
    return (
      <div className="flex h-screen items-center justify-center bg-white p-4 text-center text-sm text-gray-500">
        Chat widget is not enabled for this location.
      </div>
    );
  }

  const settings = (location.widget_settings ?? {}) as {
    color?: string;
    greeting?: string;
  };

  // Check white-label: if org has custom theme, don't show LocalVector branding
  const { data: theme } = await (supabase
    .from('org_themes') as any)
    .select('hide_powered_by')
    .eq('org_id', location.org_id)
    .single() as { data: { hide_powered_by: boolean } | null };

  const hideBranding = theme?.hide_powered_by === true;

  return (
    <WidgetChat
      slug={slug}
      businessName={location.business_name ?? 'Business'}
      phone={location.phone ?? null}
      color={settings.color ?? '#6366f1'}
      greeting={settings.greeting ?? 'Ask us anything!'}
      hideBranding={hideBranding}
    />
  );
}
