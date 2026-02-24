'use client';

import { Menu, HelpCircle, User } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TopBarProps {
  onMenuToggle: () => void;
  orgName: string;
  displayName: string;
  plan: string | null;
}

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------

export default function TopBar({ onMenuToggle, orgName, plan }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-surface-dark/80 backdrop-blur-md px-4 lg:px-6">

      {/* Left: hamburger (mobile) + logo wordmark */}
      <div className="flex items-center gap-3">
        {/* Hamburger — visible only on mobile */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo — hidden on mobile (shown in sidebar), visible on desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <img src="/logo.svg" alt="LocalVector" className="h-7 w-7 shrink-0" />
          <span className="text-sm font-semibold text-white tracking-tight">
            LocalVector<span className="text-signal-green">.ai</span>
          </span>
        </div>

        {/* Mobile: show org name as breadcrumb */}
        <span className="lg:hidden text-sm font-semibold text-white truncate max-w-[180px]">
          {orgName}
        </span>
      </div>

      {/* Center: Org name (desktop only) */}
      <div className="hidden lg:flex items-center gap-2">
        <span className="text-sm font-medium text-slate-300 truncate max-w-xs">{orgName}</span>
        {plan && (
          <span className="rounded-full bg-signal-green/15 px-2.5 py-0.5 text-xs font-medium text-signal-green capitalize">
            {plan}
          </span>
        )}
      </div>

      {/* Right: Help + User */}
      <div className="flex items-center gap-1">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition"
          aria-label="Help"
          title="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal-green/15 text-signal-green hover:bg-signal-green/25 transition"
          aria-label="User profile"
          title="User profile"
        >
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
