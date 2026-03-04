'use client';

// ---------------------------------------------------------------------------
// components/ui/UpgradeModal.tsx — P1-FIX-06, P6-FIX-27 (a11y)
//
// Shown when a user clicks a plan-locked sidebar nav item.
// Follows the InviteMemberModal pattern (custom modal, no shadcn Dialog).
// ---------------------------------------------------------------------------

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Lock, X } from 'lucide-react';
import { getPlanDisplayName } from '@/lib/plan-display-names';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  featureName: string;
  requiredPlan: 'growth' | 'agency';
}

export function UpgradeModal({ open, onClose, featureName, requiredPlan }: UpgradeModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const planDisplayName = getPlanDisplayName(requiredPlan);

  // Store previously focused element on open
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Focus the modal content when opened
  useEffect(() => {
    if (open && contentRef.current) {
      contentRef.current.focus();
    }
  }, [open]);

  // Restore focus on close
  useEffect(() => {
    if (!open && previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // P6-FIX-27: Tab key focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !contentRef.current) return;

    const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;

    const firstEl = focusableElements[0];
    const lastEl = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }, []);

  if (!open) return null;

  return (
    <div
      data-testid="upgrade-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={contentRef}
        data-testid="upgrade-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        tabIndex={-1}
        className="relative mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-surface-dark p-8 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Close button */}
        <button
          data-testid="upgrade-modal-close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Lock icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-electric-indigo/10">
          <Lock className="h-6 w-6 text-electric-indigo" aria-hidden="true" />
        </div>

        {/* Title */}
        <h2
          id="upgrade-modal-title"
          data-testid="upgrade-modal-title"
          className="mb-2 text-center text-lg font-semibold text-white"
        >
          {featureName}
        </h2>

        {/* Description */}
        <p
          data-testid="upgrade-modal-description"
          className="mb-6 text-center text-sm text-slate-400"
        >
          This feature requires the{' '}
          <span className="font-semibold text-electric-indigo">{planDisplayName}</span> plan.
        </p>

        {/* CTA */}
        <Link
          href="/dashboard/billing"
          onClick={onClose}
          data-testid="upgrade-modal-cta"
          className="block w-full rounded-xl bg-electric-indigo px-5 py-2.5 text-center text-sm font-semibold text-white hover:bg-electric-indigo/90 transition"
        >
          Upgrade to {planDisplayName}
        </Link>

        {/* Dismiss */}
        <button
          data-testid="upgrade-modal-dismiss"
          onClick={onClose}
          className="mt-3 block w-full text-center text-sm text-slate-400 hover:text-slate-300 transition"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
