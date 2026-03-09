'use client';

// ---------------------------------------------------------------------------
// components/auth/PasswordStrengthMeter.tsx — Password Strength UI (§314)
//
// Client-side-only meter that shows password strength as the user types.
// Uses pure functions from lib/auth/password-policy.ts.
// ---------------------------------------------------------------------------

import { computePasswordStrength, getStrengthLabel, getStrengthColor } from '@/lib/auth/password-policy';

interface PasswordStrengthMeterProps {
  password: string;
}

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const score = computePasswordStrength(password);
  const label = getStrengthLabel(score);
  const color = getStrengthColor(score);

  return (
    <div className="mt-2 space-y-1" data-testid="password-strength-meter" aria-live="polite">
      {/* Bar segments */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              i < score ? color : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      {/* Label */}
      <p className="text-xs text-slate-400">
        Strength: <span data-testid="strength-label">{label}</span>
      </p>
    </div>
  );
}
