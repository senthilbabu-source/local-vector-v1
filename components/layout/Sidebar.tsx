'use client';

import { useState, useCallback, useEffect } from 'react';
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
  FileSearch,
  BotMessageSquare,
  GitCompareArrows,
  HeartPulse,
  DollarSign,
  MessageSquare,
  Quote,
  SmilePlus,
  Settings,
  CreditCard,
  ScatterChart,
  MapPinned,
  Trophy,
  Star,
  Mic,
  Users,
  X,
  Link2,
  MessageCircle,
  Zap,
  Compass,
  Eye,
  Lock,
  ChevronRight,
} from 'lucide-react';
import LogoutButton from '@/app/dashboard/_components/LogoutButton';
import LocationSwitcher, { type LocationOption } from './LocationSwitcher';
import { getPlanDisplayName } from '@/lib/plan-display-names';
import { getIndustryConfig } from '@/lib/industries/industry-config';
import { planSatisfies } from '@/lib/plan-enforcer';
import { UpgradeModal } from '@/components/ui/UpgradeModal';

// ---------------------------------------------------------------------------
// Nav items — mapped to Doc 06 §2 Application Shell
// ---------------------------------------------------------------------------

export const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    testId: 'dashboard',
    icon: LayoutDashboard,
    exact: true,
    active: true,
  },
  {
    href: '/dashboard/ai-responses',
    label: 'What AI Says About You',
    testId: 'ai-says',
    icon: Quote,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/hallucinations',
    label: 'AI Mistakes',
    testId: 'alerts',
    icon: AlertTriangle,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/revenue-impact',
    label: 'Lost Sales',
    testId: 'revenue-impact',
    icon: DollarSign,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/share-of-voice',
    label: 'AI Mentions',
    testId: 'share-of-voice',
    icon: TrendingUp,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/magic-menus',
    label: 'Menu',
    testId: 'menu',
    icon: Utensils,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/compete',
    label: 'Competitors',
    testId: 'compete',
    icon: Swords,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/sentiment',
    label: 'How AI Feels About You',
    testId: 'ai-sentiment',
    icon: SmilePlus,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/agent-readiness',
    label: 'Can Customers Act?',
    testId: 'agent-readiness',
    icon: BotMessageSquare,
    exact: false,
    active: true,
    minPlan: 'growth' as const,
  },
  {
    href: '/dashboard/content-drafts',
    label: 'AI-Ready Posts',
    testId: 'content',
    icon: FileText,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/entity-health',
    label: 'Where AI Knows You',
    testId: 'entity-health',
    icon: HeartPulse,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/integrations',
    label: 'Listings',
    testId: 'listings',
    icon: MapPin,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/benchmarks',
    label: 'Local Comparison',
    testId: 'benchmarks',
    icon: Trophy,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/playbooks',
    label: 'Improvement Plans',
    testId: 'playbooks',
    icon: Zap,
    exact: false,
    active: true,
    minPlan: 'agency' as const,
  },
  // S32: Calendar merged into Posts — /dashboard/content-calendar redirects to /dashboard/content-drafts?view=calendar
  {
    href: '/dashboard/page-audits',
    label: 'Website Checkup',
    testId: 'page-audits',
    icon: FileSearch,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/ai-assistant',
    label: 'AI Assistant',
    testId: 'ai-assistant',
    icon: MessageSquare,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/cluster-map',
    label: 'Your Position',
    testId: 'cluster-map',
    icon: ScatterChart,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/proof-timeline',
    label: 'Update Tracking',
    testId: 'proof-timeline',
    icon: GitCompareArrows,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/wins',
    label: 'Wins',
    testId: 'wins',
    icon: Star,
    exact: false,
    active: true,
  },
  // S34: Crawler Analytics merged into Website Checkup — /dashboard/crawler-analytics redirects to /dashboard/page-audits#bots
  // S33: Source Intelligence merged into Entity Health — /dashboard/source-intelligence redirects to /dashboard/entity-health?tab=sources
  // S33: Citations merged into Entity Health — /dashboard/citations redirects to /dashboard/entity-health?tab=citations
  {
    href: '/dashboard/vaio',
    label: 'How AI Answers',
    testId: 'voice-readiness',
    icon: Mic,
    exact: false,
    active: true,
    minPlan: 'growth' as const,
  },
  {
    href: '/dashboard/intent-discovery',
    label: 'Missing Questions',
    testId: 'intent-discovery',
    icon: Compass,
    exact: false,
    active: true,
    minPlan: 'agency' as const,
  },
  {
    href: '/dashboard/ai-overviews',
    label: 'AI Overviews',
    testId: 'ai-overviews',
    icon: Eye,
    exact: false,
    active: true,
    minPlan: 'growth' as const,
  },
  // S35: System Status moved to Admin — /dashboard/system-health redirects for non-admins
  {
    href: '/dashboard/settings',
    label: 'Settings',
    testId: 'settings',
    icon: Settings,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/team',
    label: 'Team',
    testId: 'team',
    icon: Users,
    exact: false,
    active: true,
    minPlan: 'agency' as const,
  },
  {
    href: '/dashboard/settings/domain',
    label: 'Domain',
    testId: 'domain',
    icon: Link2,
    exact: false,
    active: true,
    minPlan: 'agency' as const,
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    testId: 'billing',
    icon: CreditCard,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/settings/locations',
    label: 'Locations',
    testId: 'locations',
    icon: MapPinned,
    exact: false,
    active: true,
  },
  {
    href: '/dashboard/settings/widget',
    label: 'Website Chat',
    testId: 'chat-widget',
    icon: MessageCircle,
    exact: false,
    active: true,
    minPlan: 'growth' as const,
  },
  {
    href: '/dashboard/reviews',
    label: 'Reviews',
    testId: 'reviews',
    icon: MessageCircle,
    exact: false,
    active: true,
  },
];

// ---------------------------------------------------------------------------
// Grouped navigation — S1 Sidebar Rebuild (coaching-first structure)
// ---------------------------------------------------------------------------

type NavItem = (typeof NAV_ITEMS)[number] & { minPlan?: 'growth' | 'agency' };

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    // Daily check: what AI says, errors, revenue impact
    label: 'Today',
    items: NAV_ITEMS.filter((i) =>
      [
        '/dashboard',
        '/dashboard/ai-responses',
        '/dashboard/hallucinations',
        '/dashboard/revenue-impact',
      ].includes(i.href),
    ),
  },
  {
    // Weekly cadence: mentions, menu, competitors, sentiment, agent readiness
    label: 'This Week',
    items: NAV_ITEMS.filter((i) =>
      [
        '/dashboard/share-of-voice',
        '/dashboard/magic-menus',
        '/dashboard/compete',
        '/dashboard/sentiment',
        '/dashboard/agent-readiness',
      ].includes(i.href),
    ),
  },
  {
    // Monthly cadence: posts, entity health, listings, benchmarks, playbooks
    label: 'This Month',
    items: NAV_ITEMS.filter((i) =>
      [
        '/dashboard/content-drafts',
        '/dashboard/entity-health',
        '/dashboard/integrations',
        '/dashboard/benchmarks',
        '/dashboard/playbooks',
      ].includes(i.href),
    ),
  },
  {
    // Power-user / technical pages — collapsed by default
    // S32: Calendar removed (merged into Posts)
    // S33: Source Intelligence + Citations removed (merged into Entity Health)
    // S34: Crawler Analytics removed (merged into Website Checkup)
    // S35: System Status removed (moved to Admin)
    label: 'Advanced',
    items: NAV_ITEMS.filter((i) =>
      [
        '/dashboard/page-audits',
        '/dashboard/ai-assistant',
        '/dashboard/cluster-map',
        '/dashboard/proof-timeline',
        '/dashboard/wins',
        '/dashboard/vaio',
        '/dashboard/intent-discovery',
        '/dashboard/ai-overviews',
        '/dashboard/reviews',
      ].includes(i.href),
    ),
  },
  {
    // Account management
    label: 'Account',
    items: NAV_ITEMS.filter((i) =>
      [
        '/dashboard/settings',
        '/dashboard/team',
        '/dashboard/settings/domain',
        '/dashboard/billing',
        '/dashboard/settings/locations',
        '/dashboard/settings/widget',
      ].includes(i.href),
    ),
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
  badgeCounts?: Record<string, string | null>;
  orgIndustry?: string | null;
}

// Map of nav item hrefs to badge data-testid suffixes
const BADGE_MAP: Record<string, string> = {
  '/dashboard/content-drafts': 'content-drafts',
  '/dashboard/share-of-voice': 'visibility',
};

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function planLabel(plan: string | null): string {
  return getPlanDisplayName(plan);
}

const STORAGE_KEY = 'lv_sidebar_expanded_groups';
const DEFAULT_EXPANDED = 'Today';

function getGroupForPath(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')) {
        return group.label;
      }
    }
  }
  return null;
}

function getSSRExpandedGroups(pathname: string): Set<string> {
  const activeGroup = getGroupForPath(pathname);
  const defaults = new Set([DEFAULT_EXPANDED]);
  if (activeGroup) defaults.add(activeGroup);
  return defaults;
}

export default function Sidebar({ isOpen, onClose, displayName, orgName, plan, locations, selectedLocationId, badgeCounts, orgIndustry }: SidebarProps) {
  const pathname = usePathname();
  const industryConfig = getIndustryConfig(orgIndustry);
  const [lockedItem, setLockedItem] = useState<NavItem | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => getSSRExpandedGroups(pathname));

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        const set = new Set(parsed);
        const activeGroup = getGroupForPath(pathname);
        if (activeGroup) set.add(activeGroup);
        setExpandedGroups(set);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand group when navigating to a page within it
  useEffect(() => {
    const activeGroup = getGroupForPath(pathname);
    if (activeGroup && !expandedGroups.has(activeGroup)) {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        next.add(activeGroup);
        return next;
      });
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

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
              <p className="mt-0.5 truncate text-xs text-slate-400">{orgName}</p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* ── Location Switcher (multi-location orgs) ──────────── */}
        {locations && locations.length > 1 && (
          <LocationSwitcher locations={locations} selectedLocationId={selectedLocationId ?? null} plan={plan} />
        )}

        {/* ── Navigation (grouped — Sprint A H4) ───────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const groupId = `nav-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`;
            const isExpanded = expandedGroups.has(group.label);
            const groupDisplayLabel = group.label === 'Grow Your Presence'
              ? `Grow with ${industryConfig.servicesNoun}`
              : group.label;
            return (
            <div key={group.label} className="mb-2" role="group" aria-labelledby={groupId}>
              <button
                type="button"
                id={groupId}
                data-testid="sidebar-group-label"
                onClick={() => toggleGroup(group.label)}
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-1 px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 select-none hover:text-muted-foreground transition-colors"
              >
                <ChevronRight
                  className={['h-3 w-3 shrink-0 transition-transform duration-200', isExpanded ? 'rotate-90' : ''].join(' ')}
                  aria-hidden="true"
                />
                {groupDisplayLabel}
              </button>
              <div
                className={['space-y-0.5 overflow-hidden transition-all duration-200', isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'].join(' ')}
              >
                {group.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  // Sprint E: Dynamic icon/label for Magic Menus based on org industry
                  const isMagicMenu = item.href === '/dashboard/magic-menus';
                  const Icon = isMagicMenu ? industryConfig.magicMenuIcon : item.icon;
                  const displayLabel = isMagicMenu ? industryConfig.magicMenuLabel : item.label;

                  if (!item.active) {
                    return (
                      <span
                        key={item.label}
                        title="Coming soon"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 cursor-not-allowed select-none"
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {displayLabel}
                      </span>
                    );
                  }

                  // P1-FIX-06: Plan-locked items render as buttons with lock icon
                  const isLocked = !!(item as NavItem).minPlan && !planSatisfies(plan, (item as NavItem).minPlan!);
                  if (isLocked) {
                    return (
                      <button
                        key={item.label}
                        type="button"
                        data-testid={`nav-${item.testId}`}
                        onClick={() => setLockedItem(item as NavItem)}
                        aria-label={`${displayLabel} — requires ${getPlanDisplayName((item as NavItem).minPlan!)} plan`}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-300 transition cursor-pointer"
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
                        {displayLabel}
                        <Lock className="ml-auto h-3 w-3 shrink-0 opacity-50" aria-hidden="true" />
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onClose}
                      data-testid={`nav-${item.testId}`}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                        active
                          ? 'bg-signal-green/15 text-signal-green'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white',
                      ].join(' ')}
                    >
                      <Icon
                        className={['h-4 w-4 shrink-0', active ? 'text-signal-green' : ''].join(' ')}
                        aria-hidden="true"
                      />
                      {displayLabel}
                      {/* Sprint 101: Sidebar badge pill */}
                      {badgeCounts && BADGE_MAP[item.href] && badgeCounts[BADGE_MAP[item.href]!] && (
                        <span
                          data-testid={`sidebar-badge-${BADGE_MAP[item.href]}`}
                          className="ml-auto flex items-center justify-center"
                        >
                          <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold leading-none flex items-center justify-center">
                            {badgeCounts[BADGE_MAP[item.href]!]}
                          </span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
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

      {/* P1-FIX-06: Upgrade modal for plan-locked nav items */}
      {lockedItem?.minPlan && (
        <UpgradeModal
          open={!!lockedItem}
          onClose={() => setLockedItem(null)}
          featureName={lockedItem.label}
          requiredPlan={lockedItem.minPlan}
        />
      )}
    </>
  );
}
