// ---------------------------------------------------------------------------
// MilestoneCelebration — S20 (AI_RULES §220)
//
// Full-screen overlay for 3s when AI Health Score crosses 50/60/70/80/90.
// CSS-only confetti. Auto-dismisses after 3s. sessionStorage dedup.
// Respects prefers-reduced-motion (static card instead of confetti).
// ---------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

interface MilestoneCelebrationProps {
  milestone: number;
  message: string;
}

const STORAGE_KEY_PREFIX = 'lv_milestone_celebrated_';

export default function MilestoneCelebration({
  milestone,
  message,
}: MilestoneCelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `${STORAGE_KEY_PREFIX}${milestone}`;
    if (sessionStorage.getItem(key)) return;

    sessionStorage.setItem(key, '1');
    setVisible(true);

    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [milestone]);

  if (!visible) return null;

  return (
    <div
      data-testid="milestone-celebration"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-label={`Score milestone: ${milestone}`}
      onClick={() => setVisible(false)}
    >
      {/* CSS confetti particles — hidden when prefers-reduced-motion */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="absolute block h-2 w-2 rounded-full animate-[confetti_2s_ease-out_forwards]"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: '-5%',
              backgroundColor: ['#22c55e', '#f59e0b', '#6366f1', '#ec4899', '#06b6d4'][i % 5],
              animationDelay: `${Math.random() * 0.8}s`,
              // @ts-expect-error CSS custom properties
              '--confetti-x': `${(Math.random() - 0.5) * 200}px`,
              '--confetti-r': `${Math.random() * 720 - 360}deg`,
            }}
          />
        ))}
      </div>

      {/* Card */}
      <div className="relative rounded-2xl border border-green-400/20 bg-surface-dark px-8 py-6 text-center shadow-2xl motion-safe:animate-[scaleIn_0.3s_ease-out]">
        <Trophy className="mx-auto h-10 w-10 text-yellow-400 motion-reduce:animate-none" aria-hidden="true" />
        <p className="mt-3 text-2xl font-bold text-white">
          Score Milestone: {milestone}
        </p>
        <p className="mt-2 max-w-xs text-sm text-slate-400">
          {message}
        </p>
      </div>
    </div>
  );
}
