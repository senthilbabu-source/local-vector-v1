'use client';

import { useState, useMemo } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import GuidedTour from '@/app/dashboard/_components/GuidedTour';
import PresenceAvatars from '@/app/dashboard/_components/PresenceAvatars';
import RealtimeNotificationToast from '@/app/dashboard/_components/RealtimeNotificationToast';
import type { LocationOption } from './LocationSwitcher';
import ImpersonationBanner from '@/components/admin/ImpersonationBanner';
import type { PresenceUser } from '@/lib/realtime/types';
import type { MemberRole } from '@/lib/membership/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardShellProps {
  children: React.ReactNode;
  displayName: string;
  orgName: string;
  plan: string | null;
  locations?: LocationOption[];
  selectedLocationId?: string | null;
  badgeCounts?: Record<string, string | null>;
  credits?: { credits_used: number; credits_limit: number; reset_date: string } | null;
  orgIndustry?: string | null;
  // Sprint 116: Realtime presence props
  orgId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: MemberRole | null;
  // Sprint §204: Admin impersonation
  isImpersonating?: boolean;
  impersonatingOrgName?: string;
}

// ---------------------------------------------------------------------------
// DashboardShell
//
// Client Component wrapper that holds the sidebar toggle state.
// The dashboard layout.tsx remains a Server Component so it can call
// getSafeAuthContext(). Server-derived props (displayName, orgName, plan)
// are passed down; children are the RSC page slot.
// ---------------------------------------------------------------------------

export default function DashboardShell({
  children,
  displayName,
  orgName,
  plan,
  locations,
  selectedLocationId,
  badgeCounts,
  credits,
  orgIndustry,
  orgId,
  userId,
  userEmail,
  userRole,
  isImpersonating,
  impersonatingOrgName,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sprint 116: Build presence user object for realtime
  const presenceUser = useMemo<PresenceUser | null>(() => {
    if (!userId || !userEmail || !userRole) return null;
    return {
      user_id: userId,
      email: userEmail,
      full_name: displayName !== userEmail.split('@')[0] ? displayName : null,
      role: userRole,
      current_page: '/dashboard',
      online_at: new Date().toISOString(),
    };
  }, [userId, userEmail, userRole, displayName]);

  return (
    <div className={`flex h-screen overflow-hidden bg-midnight-slate ${isImpersonating ? 'pt-10' : ''}`}>

      {/* Sprint §204: Impersonation banner */}
      {isImpersonating && impersonatingOrgName && (
        <ImpersonationBanner orgName={impersonatingOrgName} />
      )}

      {/* P6-FIX-27: Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-signal-green focus:px-4 focus:py-2 focus:text-deep-navy focus:font-semibold focus:text-sm"
      >
        Skip to main content
      </a>

      {/* ── Mobile overlay backdrop ───────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────
          On desktop: part of the flex row (w-64, not fixed)
          On mobile:  position:fixed, slides in over content    */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        displayName={displayName}
        orgName={orgName}
        plan={plan}
        locations={locations}
        selectedLocationId={selectedLocationId}
        badgeCounts={badgeCounts}
        orgIndustry={orgIndustry}
      />

      {/* ── Right column: TopBar + page content ──────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          orgName={orgName}
          displayName={displayName}
          plan={plan}
          credits={credits}
          presenceSlot={
            orgId && presenceUser ? (
              <PresenceAvatars orgId={orgId} currentUser={presenceUser} />
            ) : null
          }
        />

        {/* Main content area */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 sm:p-6 bg-midnight-slate">
          {children}
        </main>
      </div>

      {/* Post-onboarding guided tour (Sprint 62B) */}
      <GuidedTour />

      {/* Sprint 116: Realtime notification toasts */}
      {orgId && <RealtimeNotificationToast orgId={orgId} />}
    </div>
  );
}
