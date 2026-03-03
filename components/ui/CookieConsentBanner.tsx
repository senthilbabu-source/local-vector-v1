'use client';

// ---------------------------------------------------------------------------
// CookieConsentBanner — P6-FIX-26: GDPR Cookie Consent
//
// Minimal informational banner. LocalVector.ai uses only essential cookies
// (Supabase auth session). No advertising or analytics cookies.
// Shows on first visit; dismissible via localStorage.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'lv_cookie_consent';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if consent not yet given
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      data-testid="cookie-consent-banner"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-surface-dark/95 backdrop-blur-sm px-4 py-3 sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <p className="text-xs text-slate-400 sm:text-sm">
          We use essential cookies to keep you logged in. No tracking or advertising cookies.{' '}
          <Link href="/privacy" className="text-electric-indigo hover:underline">
            Privacy Policy
          </Link>
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-md bg-electric-indigo px-4 py-1.5 text-xs font-medium text-white hover:bg-electric-indigo/90 transition"
          data-testid="cookie-consent-dismiss"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
