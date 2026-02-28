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
  credits?: { credits_used: number; credits_limit: number; reset_date: string } | null;
}

// ---------------------------------------------------------------------------
// CreditsMeterBar — small horizontal battery-style bar
// ---------------------------------------------------------------------------

function CreditsMeterBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-signal-green';

  return (
    <div
      className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden"
      role="progressbar"
      aria-valuenow={used}
      aria-valuemax={limit}
      aria-label={`${limit - used} API credits remaining`}
      data-testid="credits-meter-bar"
    >
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------

export default function TopBar({ onMenuToggle, orgName, plan, credits }: TopBarProps) {
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

      {/* Right: Credits meter + Help + User */}
      <div className="flex items-center gap-1">
        {/* Sprint D: Credits meter */}
        {credits && (
          <div className="flex items-center gap-2 mr-2" data-testid="credits-meter">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider leading-none">
                Credits
              </span>
              <span className="text-xs font-medium tabular-nums text-slate-300">
                {credits.credits_limit - credits.credits_used}
                <span className="text-slate-500"> / {credits.credits_limit}</span>
              </span>
            </div>
            <CreditsMeterBar used={credits.credits_used} limit={credits.credits_limit} />
          </div>
        )}
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
