'use client';

// ---------------------------------------------------------------------------
// OrgSwitcher — Multi-org dropdown for users in 2+ organizations (Sprint 100)
//
// Hidden when user belongs to exactly 1 org (majority of V1 users).
// Sets HttpOnly cookie via server action and reloads dashboard.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { switchActiveOrg } from '@/app/actions/switch-org';

export interface OrgOption {
  id: string;
  name: string;
  plan: string;
  role: string;
}

interface OrgSwitcherProps {
  orgs: OrgOption[];
  activeOrgId: string | null;
}

function planBadge(plan: string) {
  const colors: Record<string, string> = {
    trial: 'bg-slate-600/30 text-slate-400',
    starter: 'bg-signal-green/15 text-signal-green',
    growth: 'bg-electric-indigo/15 text-electric-indigo',
    agency: 'bg-alert-amber/15 text-alert-amber',
  };
  return colors[plan] ?? colors.trial;
}

export default function OrgSwitcher({ orgs, activeOrgId }: OrgSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Only render for multi-org users
  if (orgs.length <= 1) return null;

  const current = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];

  function handleSelect(orgId: string) {
    if (orgId === activeOrgId) {
      setIsOpen(false);
      return;
    }
    startTransition(async () => {
      const result = await switchActiveOrg(orgId);
      if (result.success) {
        setIsOpen(false);
        window.location.reload();
      }
    });
  }

  return (
    <div className="relative px-5 py-2 border-b border-white/5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        data-testid="org-switcher-trigger"
        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-left hover:bg-white/5 transition disabled:opacity-60"
      >
        <Building2 className="h-4 w-4 shrink-0 text-electric-indigo" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-medium text-white">
            {isPending ? 'Switching…' : current.name}
          </p>
        </div>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${planBadge(current.plan)}`}>
          {current.plan}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            data-testid="org-switcher"
            className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg border border-white/10 bg-surface-dark shadow-lg overflow-hidden"
          >
            {orgs.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => handleSelect(org.id)}
                disabled={isPending}
                data-testid={`org-switcher-option-${org.id}`}
                className={`flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-white/5 transition disabled:opacity-60 ${
                  org.id === activeOrgId ? 'bg-electric-indigo/10' : ''
                }`}
              >
                <Building2
                  className={`h-3.5 w-3.5 shrink-0 ${
                    org.id === activeOrgId ? 'text-electric-indigo' : 'text-slate-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`truncate text-sm font-medium ${
                    org.id === activeOrgId ? 'text-electric-indigo' : 'text-white'
                  }`}>
                    {org.name}
                  </p>
                  <p className="text-[10px] text-slate-500 capitalize">{org.role}</p>
                </div>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${planBadge(org.plan)}`}>
                  {org.plan}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
