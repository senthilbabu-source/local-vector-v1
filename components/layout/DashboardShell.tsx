'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardShellProps {
  children: React.ReactNode;
  displayName: string;
  orgName: string;
  plan: string | null;
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
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-midnight-slate">

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
      />

      {/* ── Right column: TopBar + page content ──────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          orgName={orgName}
          displayName={displayName}
          plan={plan}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-midnight-slate">
          {children}
        </main>
      </div>
    </div>
  );
}
