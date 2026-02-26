'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertTriangle,
  Utensils,
  TrendingUp,
  FileText,
  Swords,
  MapPin,
  Globe,
  FileSearch,
  MessageSquare,
  Quote,
  Settings,
  CreditCard,
  X,
} from 'lucide-react';
import LogoutButton from '@/app/dashboard/_components/LogoutButton';
import LocationSwitcher, { type LocationOption } from './LocationSwitcher';

// ---------------------------------------------------------------------------
// Nav items — mapped to Doc 06 §2 Application Shell
// ---------------------------------------------------------------------------

export const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    exact: true,
    active: true,
  },
  {
    href: '/dashboard/hallucinations',
    label: 'Alerts',
    icon: AlertTriangle,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/magic-menus',
    label: 'Menu',
    icon: Utensils,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/share-of-voice',
    label: 'Share of Voice',
    icon: TrendingUp,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/content-drafts',
    label: 'Content',
    icon: FileText,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/compete',
    label: 'Compete',
    icon: Swords,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/integrations',
    label: 'Listings',
    icon: MapPin,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/citations',
    label: 'Citations',
    icon: Globe,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/page-audits',
    label: 'Page Audits',
    icon: FileSearch,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/ai-assistant',
    label: 'AI Assistant',
    icon: MessageSquare,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/ai-responses',
    label: 'AI Says',
    icon: Quote,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: Settings,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    icon: CreditCard,
    exact: false,
    active: true,
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  displayName: string;
  orgName: string;
  plan: string | null;
  locations?: LocationOption[];
  selectedLocationId?: string | null;
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function planLabel(plan: string | null): string {
  const labels: Record<string, string> = {
    starter: 'Starter Plan',
    growth: 'Growth Plan',
    agency: 'Agency Plan',
  };
  return plan ? (labels[plan] ?? `${plan} Plan`) : 'Free Plan';
}

export default function Sidebar({ isOpen, onClose, displayName, orgName, plan, locations, selectedLocationId }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean): boolean {
    if (href === '#') return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <>
      {/* ── Sidebar panel ────────────────────────────────────────── */}
      <aside
        className={[
          // Base layout
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-surface-dark',
          // Mobile: slide in/out
          'transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible
          'lg:relative lg:translate-x-0',
        ].join(' ')}
      >
        {/* ── Brand header ───────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="LocalVector" className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white leading-none tracking-tight">
                LocalVector<span className="text-signal-green">.ai</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{orgName}</p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Location Switcher (multi-location orgs) ──────────── */}
        {locations && locations.length > 1 && (
          <LocationSwitcher locations={locations} selectedLocationId={selectedLocationId ?? null} />
        )}

        {/* ── Navigation ─────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;

            if (!item.active) {
              return (
                <span
                  key={item.label}
                  title="Coming soon"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 cursor-not-allowed select-none"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </span>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-signal-green/15 text-signal-green'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <Icon
                  className={['h-4 w-4 shrink-0', active ? 'text-signal-green' : ''].join(' ')}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer: AI Visibility Score + logout ───────────────── */}
        <div className="border-t border-white/5 px-3 py-4 space-y-3">
          {/* Plan tier badge */}
          <div className="rounded-xl bg-midnight-slate px-4 py-3">
            <p className="text-xs font-medium text-slate-400 mb-1.5">Current Plan</p>
            <span className="inline-flex items-center rounded-md bg-signal-green/15 px-2 py-0.5 text-xs font-semibold text-signal-green">
              {planLabel(plan)}
            </span>
          </div>

          {/* User info */}
          <div className="px-3 py-1">
            <p className="truncate text-xs font-medium text-slate-300" title={displayName}>
              {displayName}
            </p>
          </div>

          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
