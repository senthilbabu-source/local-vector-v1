import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import AddCategoryModal from './_components/AddCategoryModal';
import AddItemModal from './_components/AddItemModal';
import PublishToggle from '../_components/PublishToggle';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  is_available: boolean;
  sort_order: number;
};

type MenuCategory = {
  id: string;
  name: string;
  sort_order: number;
  menu_items: MenuItem[];
};

type MagicMenuDetail = {
  id: string;
  public_slug: string | null;
  processing_status: string;
  is_published: boolean;
  locations: {
    name: string;
    business_name: string;
    city: string | null;
    state: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchMenuAndCategories(menuId: string): Promise<{
  menu: MagicMenuDetail | null;
  categories: MenuCategory[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const [menuResult, categoriesResult] = await Promise.all([
    // Fetch the menu header (RLS ensures it belongs to this org)
    supabase
      .from('magic_menus')
      .select('id, public_slug, processing_status, is_published, locations(name, business_name, city, state)')
      .eq('id', menuId)
      .single() as Promise<{ data: MagicMenuDetail | null; error: unknown }>,

    // Fetch all categories for this menu, nested with their items
    supabase
      .from('menu_categories')
      .select(
        'id, name, sort_order, menu_items(id, name, description, price, currency, is_available, sort_order)'
      )
      .eq('menu_id', menuId)
      .order('sort_order', { ascending: true }) as Promise<{
        data: MenuCategory[] | null;
        error: unknown;
      }>,
  ]);

  return {
    menu: menuResult.data ?? null,
    categories: (categoriesResult.data ?? []).map((cat) => ({
      ...cat,
      menu_items: (cat.menu_items ?? []).sort(
        (a, b) => a.sort_order - b.sort_order
      ),
    })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a human-readable display name from a public_slug.
 * Strips the base-36 timestamp suffix added by toUniqueSlug().
 */
function slugToDisplayName(slug: string | null): string {
  if (!slug) return 'Untitled Menu';
  const parts = slug.split('-');
  const lastPart = parts[parts.length - 1];
  const isTimestamp = /^[a-z0-9]{6,9}$/.test(lastPart ?? '');
  const nameParts = isTimestamp ? parts.slice(0, -1) : parts;
  return nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(price);
}

const STATUS_STYLES: Record<string, string> = {
  uploading:    'bg-blue-50 text-blue-700 ring-blue-600/20',
  processing:   'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  review_ready: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  published:    'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  failed:       'bg-red-50 text-red-700 ring-red-600/20',
};

const STATUS_LABELS: Record<string, string> = {
  uploading:    'Uploading',
  processing:   'Processing',
  review_ready: 'Ready to Review',
  published:    'Published',
  failed:       'Failed',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MenuEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getSafeAuthContext();
  if (!ctx) {
    redirect('/login');
  }

  const { id } = await params;
  const { menu, categories } = await fetchMenuAndCategories(id);

  // If RLS filtered it out (different org) or it doesn't exist, show 404
  if (!menu) {
    notFound();
  }

  const menuDisplayName = slugToDisplayName(menu.public_slug);
  const locationName = menu.locations?.business_name ?? menu.locations?.name ?? 'Unknown Location';
  const locationCity = menu.locations?.city;
  const locationState = menu.locations?.state;

  const totalItems = categories.reduce((sum, c) => sum + c.menu_items.length, 0);

  // Pass a simplified category list (id + name) to AddItemModal
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <div>
        <Link
          href="/dashboard/magic-menus"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Magic Menus
        </Link>
      </div>

      {/* ── Menu Header Card ─────────────────────────────────────── */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left: menu info */}
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{menuDisplayName}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {locationName}
              {locationCity && (
                <>
                  {' '}
                  &mdash; {locationCity}
                  {locationState ? `, ${locationState}` : ''}
                </>
              )}
            </p>

            {/* Slug */}
            {menu.public_slug && (
              <p className="mt-2 font-mono text-xs text-slate-400">
                menu.localvector.ai/{menu.public_slug}
              </p>
            )}

            {/* Stats */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>
                <span className="font-semibold tabular-nums text-slate-700">
                  {categories.length}
                </span>{' '}
                {categories.length === 1 ? 'category' : 'categories'}
              </span>
              <span className="text-slate-300">·</span>
              <span>
                <span className="font-semibold tabular-nums text-slate-700">
                  {totalItems}
                </span>{' '}
                {totalItems === 1 ? 'item' : 'items'}
              </span>
            </div>
          </div>

          {/* Right: status badge + publish toggle */}
          <div className="flex flex-col items-end gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                STATUS_STYLES[menu.processing_status] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {STATUS_LABELS[menu.processing_status] ?? menu.processing_status}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {menu.is_published ? 'Live' : 'Draft'}
              </span>
              <PublishToggle menuId={menu.id} isPublished={menu.is_published} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Category List ────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Menu Categories</h2>
          <AddCategoryModal menuId={id} />
        </div>

        {/* Empty state — no categories yet */}
        {categories.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-8 w-8 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-500">No categories yet</p>
            <p className="mt-1 text-xs text-slate-400">
              Add your first category (e.g. Starters, Mains, Desserts) to begin building
              your AI-readable menu.
            </p>
          </div>
        )}

        {/* Category cards */}
        {categories.map((category) => (
          <div
            key={category.id}
            className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5"
          >
            {/* Category header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">{category.name}</h3>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 tabular-nums">
                  {category.menu_items.length}
                </span>
              </div>
              <AddItemModal
                menuId={id}
                categories={categoryOptions}
                defaultCategoryId={category.id}
              />
            </div>

            {/* Items table */}
            {category.menu_items.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-xs text-slate-400">
                  No items yet. Click &ldquo;Add Item&rdquo; to add the first dish.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr className="bg-white">
                    <th className="py-2.5 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Item
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Description
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Price
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Available
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {category.menu_items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50">
                      {/* Name */}
                      <td className="py-3 pl-5 pr-3">
                        <span className="text-sm font-medium text-slate-900">
                          {item.name}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="max-w-xs px-3 py-3">
                        <span className="block truncate text-sm text-slate-500">
                          {item.description ?? <span className="italic text-slate-300">No description</span>}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                          {formatPrice(item.price, item.currency)}
                        </span>
                      </td>

                      {/* Available */}
                      <td className="whitespace-nowrap px-3 py-3">
                        {item.is_available ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                            Unavailable
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {/* Global "Add Item" when categories exist but user wants a shortcut */}
        {categories.length > 0 && (
          <div className="flex justify-center pt-2">
            <AddItemModal menuId={id} categories={categoryOptions} />
          </div>
        )}
      </div>
    </div>
  );
}
