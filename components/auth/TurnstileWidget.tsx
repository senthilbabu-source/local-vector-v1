'use client';

/**
 * §317: Cloudflare Turnstile Widget (Invisible Mode)
 *
 * Renders an invisible Turnstile challenge and passes the token via a hidden
 * input named `cf-turnstile-response`. The parent form reads this value on submit.
 *
 * When NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set (dev/CI), renders nothing —
 * the server-side verification will fail-open.
 */

import { useEffect, useRef, useCallback } from 'react';

interface TurnstileWidgetProps {
  /** Called with the verification token when the challenge is solved. */
  onVerify: (token: string) => void;
  /** Called when the token expires (optional). */
  onExpire?: () => void;
  /** Called when an error occurs (optional). */
  onError?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export default function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || !siteKey) return;
    if (widgetIdRef.current) return; // Already rendered

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      size: 'invisible',
      callback: onVerify,
      'expired-callback': onExpire,
      'error-callback': onError,
    });
  }, [siteKey, onVerify, onExpire, onError]);

  useEffect(() => {
    if (!siteKey) return;

    // If Turnstile script is already loaded, render immediately
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Load the Turnstile script
    if (!scriptLoadedRef.current) {
      scriptLoadedRef.current = true;

      window.onTurnstileLoad = () => {
        renderWidget();
      };

      const script = document.createElement('script');
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, renderWidget]);

  // No site key → skip rendering (dev/CI)
  if (!siteKey) return null;

  return <div ref={containerRef} data-testid="turnstile-widget" />;
}
