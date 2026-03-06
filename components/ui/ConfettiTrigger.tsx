'use client';

// ---------------------------------------------------------------------------
// ConfettiTrigger — S8 milestone celebration
//
// Client component. Fires canvas-confetti on mount when `fire={true}`.
// Uses sessionStorage to guarantee it fires at most once per session per
// `storageKey`, so returning to the page does not re-trigger.
//
// Usage:
//   <ConfettiTrigger fire={winRate >= 60} storageKey="compete-winning" />
// ---------------------------------------------------------------------------

import { useEffect } from 'react';

interface ConfettiTriggerProps {
  /** Whether conditions are met to fire confetti. */
  fire: boolean;
  /**
   * Unique key scoped to this milestone.
   * Confetti fires at most once per session per key.
   * Example: "sov-leading", "compete-winning", "menu-live"
   */
  storageKey: string;
}

export default function ConfettiTrigger({ fire, storageKey }: ConfettiTriggerProps) {
  useEffect(() => {
    if (!fire) return;

    const sessionKey = `lv_confetti_${storageKey}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');

    // Dynamically import canvas-confetti to keep it out of the initial bundle
    import('canvas-confetti').then(({ default: confetti }) => {
      // Two bursts — left and right — for a broad spread
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: 0.35, y: 0.55 },
        colors: ['#00F5A0', '#FFB800', '#ffffff', '#a78bfa'],
        zIndex: 9999,
      });
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { x: 0.65, y: 0.55 },
        colors: ['#00F5A0', '#FFB800', '#ffffff', '#a78bfa'],
        zIndex: 9999,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
