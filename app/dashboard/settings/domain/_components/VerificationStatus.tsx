'use client';

/**
 * VerificationStatus — Sprint 114
 *
 * Badge showing the current verification status of a custom domain.
 */

import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import type { VerificationStatus as VerificationStatusType } from '@/lib/whitelabel/types';

interface VerificationStatusProps {
  status: VerificationStatusType;
}

const STATUS_CONFIG: Record<
  VerificationStatusType,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  unverified: {
    label: 'Unverified',
    icon: AlertCircle,
    className: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  },
  pending: {
    label: 'Checking...',
    icon: Clock,
    className: 'text-alert-amber bg-alert-amber/10 border-alert-amber/20',
  },
  verified: {
    label: 'Verified',
    icon: CheckCircle,
    className: 'text-truth-emerald bg-truth-emerald/10 border-truth-emerald/20',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    className: 'text-alert-crimson bg-alert-crimson/10 border-alert-crimson/20',
  },
};

export default function VerificationStatus({ status }: VerificationStatusProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      data-testid="verification-status-badge"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'pending' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}
