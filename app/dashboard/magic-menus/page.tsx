// Server Component — fetches primary location + its magic_menu record,
// then delegates all interaction to the MenuWorkspace client shell.
// The existing /dashboard/magic-menus/[id] deep-edit route is unchanged.

import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { MenuWorkspaceData } from '@/lib/types/menu';
import MenuWorkspace from './_components/MenuWorkspace';
import MenuCoachHero from './_components/MenuCoachHero';
import AITalkingAboutSection from './_components/AITalkingAboutSection';
import type { AITalkingItem } from './_components/AITalkingAboutSection';
import { getIndustryConfig } from '@/lib/industries/industry-config';
import { analyzeMenuDemandWithCategories } from '@/lib/menu-intelligence/demand-analyzer';
import { analyzeMenuCompleteness, generateMenuSuggestions, type MenuSuggestion } from '@/lib/menu-intelligence/menu-optimizer';
import MenuOptimizerCard from './_components/MenuOptimizerCard';
import AISuggestionsButton from './_components/AISuggestionsButton';
import type { MenuContext } from '@/lib/menu-intelligence/ai-menu-suggestions';

export const metadata = { title: 'Menu | LocalVector.ai' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PrimaryLocation = {
  id: string;
  business_name: string;
  city: string | null;
  state: string | null;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchWorkspaceData(orgId: string): Promise<{
  location: PrimaryLocation | null;
  menu: MenuWorkspaceData | null;
  industry: string | null;
  demandItems: AITalkingItem[];
  menuSuggestions: MenuSuggestion[];
  menuContext: MenuContext | null;
}> {
  const supabase = await createClient();

  // Belt-and-suspenders: filter by org_id explicitly in addition to RLS.
  // The "public_published_location" RLS policy (migration 20260221000001)
  // also grants SELECT on locations that have a published magic_menu, so a
  // pure RLS-only query can return > 1 primary location when the golden
  // tenant has a published menu — causing .maybeSingle() to return null.
  // Matching the pattern used by app/dashboard/layout.tsx.
  const { data: location } = (await supabase
    .from('locations')
    .select('id, business_name, city, state')
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .maybeSingle()) as { data: PrimaryLocation | null };

  // Sprint E: Fetch org industry for dynamic labels
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('industry')
    .eq('id', orgId)
    .maybeSingle();
  const industry = (orgRow as { industry?: string | null } | null)?.industry ?? null;

  if (!location) return { location: null, menu: null, industry, demandItems: [], menuSuggestions: [], menuContext: null };

  // Fetch the most recent magic_menu for this location (one workspace per location).
  const { data: menu } = (await supabase
    .from('magic_menus')
    .select(
      'id, location_id, processing_status, extracted_data, extraction_confidence, is_published, public_slug, human_verified, propagation_events, content_hash, last_distributed_at'
    )
    .eq('location_id', location.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: MenuWorkspaceData | null };

  // Fetch AI demand signals for "What AI Is Talking About" section
  const demandResults = await analyzeMenuDemandWithCategories(supabase, location.id, orgId);
  const demandItems: AITalkingItem[] = demandResults.map((r) => ({
    item_id: r.item_id,
    item_name: r.item_name,
    mention_count: r.mention_count,
    category_name: r.category_name,
  }));

  // S43: Fetch menu items for optimizer suggestions
  let menuSuggestions: MenuSuggestion[] = [];
  if (menu?.extracted_data) {
    try {
      const items = (menu.extracted_data as unknown as { items?: Array<{ name: string; description?: string; price?: string; dietary_tags?: string[]; category?: string }> })?.items ?? [];
      const completeness = analyzeMenuCompleteness(items);
      const demandForOptimizer = demandResults.map(r => ({ item_name: r.item_name, mention_count: r.mention_count }));
      menuSuggestions = generateMenuSuggestions(completeness, demandForOptimizer, items);
    } catch (_e) {
      // Non-critical — skip optimizer suggestions
    }
  }

  // S66: Build MenuContext for AI suggestions
  const menuContext: MenuContext | null = menu?.extracted_data ? (() => {
    const items = (menu.extracted_data as unknown as { items?: Array<{ name: string; description?: string; price?: string; dietary_tags?: string[] }> })?.items ?? [];
    return {
      businessName: location.business_name,
      industry: industry ?? 'restaurant',
      itemCount: items.length,
      itemsWithDescription: items.filter(i => i.description && i.description.length > 0).length,
      itemsWithPrice: items.filter(i => i.price != null).length,
      itemsWithDietary: items.filter(i => i.dietary_tags && i.dietary_tags.length > 0).length,
      topMentionedItems: demandResults.slice(0, 5).map(r => r.item_name),
    };
  })() : null;

  return { location, menu, industry, demandItems, menuSuggestions, menuContext };
}

// ---------------------------------------------------------------------------
// MagicMenusPage
// ---------------------------------------------------------------------------

export default async function MagicMenusPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  // orgId is null only in the brief window after signup before the DB trigger
  // creates the org. In that case, skip the location query and show empty state.
  const { location, menu, industry, demandItems, menuSuggestions, menuContext } = ctx.orgId
    ? await fetchWorkspaceData(ctx.orgId)
    : { location: null, menu: null, industry: null, demandItems: [] as AITalkingItem[], menuSuggestions: [] as MenuSuggestion[], menuContext: null as MenuContext | null };

  const industryConfig = getIndustryConfig(industry);

  return (
    <div className="space-y-5">

      {/* ── Page header ───────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          {industryConfig.magicMenuLabel}
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          AI-readable {industryConfig.servicesNoun.toLowerCase()} that teaches ChatGPT, Perplexity, and Google the
          truth about your business.
        </p>
      </div>

      {/* ── S36: AI Demand Signals (promoted above hero) ──────────── */}
      <AITalkingAboutSection items={demandItems} />

      {/* ── S43: Menu Optimizer Suggestions ──────────────────────── */}
      <MenuOptimizerCard suggestions={menuSuggestions} />

      {/* ── S66: AI-Powered Suggestions ───────────────────────────── */}
      {menuContext && menuContext.itemCount > 0 && (
        <AISuggestionsButton context={menuContext} />
      )}

      {/* ── S7: Menu coaching hero ────────────────────────────────── */}
      <MenuCoachHero
        menu={menu}
        locationName={location?.business_name ?? 'your business'}
        industryNoun={industryConfig.servicesNoun.toLowerCase()}
      />

      {/* ── Workspace ─────────────────────────────────────────────── */}
      <div id="workspace">
      {!location ? (
        // No primary location yet — guide the user
        <div className="rounded-2xl bg-surface-dark border border-white/5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-300">No location found.</p>
          <p className="mt-1 text-xs text-slate-400">
            Add a location first before creating your {industryConfig.magicMenuLabel}.
          </p>
          <a
            href="/dashboard/locations"
            className="mt-4 inline-flex items-center rounded-xl bg-signal-green/10 border border-signal-green/30 px-4 py-2 text-xs font-semibold text-signal-green hover:bg-signal-green/20 transition"
          >
            Add a Location →
          </a>
        </div>
      ) : (
        <MenuWorkspace
          locationId={location.id}
          locationName={location.business_name}
          locationCity={location.city}
          initialMenu={menu}
        />
      )}
      </div>

    </div>
  );
}
