'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertTriangle,
  Utensils,
  TrendingUp,
  Swords,
  MapPin,
  Settings,
  CreditCard,
  X,
} from 'lucide-react';
import LogoutButton from '@/app/dashboard/_components/LogoutButton';

// ---------------------------------------------------------------------------
// Nav items — mapped to Doc 06 §2 Application Shell
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
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
    href: '#',
    label: 'Settings',
    icon: Settings,
    exact: false,
    active: false,
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
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function Sidebar({ isOpen, onClose, displayName, orgName }: SidebarProps) {
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-electric-indigo text-white font-bold text-sm select-none">
              LV
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white leading-none tracking-tight">
                LocalVector<span className="text-electric-indigo">.ai</span>
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
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-electric-indigo/15 text-electric-indigo'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <Icon
                  className={['h-4 w-4 shrink-0', active ? 'text-electric-indigo' : ''].join(' ')}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer: AI Visibility Score + logout ───────────────── */}
        <div className="border-t border-white/5 px-3 py-4 space-y-3">
          {/* AI Visibility Score */}
          <div className="rounded-xl bg-midnight-slate px-4 py-3">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-slate-400">AI Visibility Score</p>
              <span className="font-mono text-sm font-bold text-truth-emerald">98/100</span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1 w-full rounded-full bg-white/5">
              <div
                className="h-1 rounded-full bg-truth-emerald"
                style={{ width: '98%' }}
                aria-hidden
              />
            </div>
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
