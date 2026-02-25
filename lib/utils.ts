// ---------------------------------------------------------------------------
// lib/utils.ts — Shared Tailwind class utilities
//
// Exports:
//   cn()          — shadcn/ui convention (used by components/ui/*)
//   cx()          — Tremor Raw convention (used by components/tremor/*)
//   focusInput    — Tremor input focus ring classes
//   focusRing     — Tremor focus-visible outline classes
//   hasErrorInput — Tremor error state border/ring classes
//
// Both cn() and cx() are identical: twMerge(clsx(...args)).
// Exporting both avoids import-path rewrites when copying components.
// ---------------------------------------------------------------------------

import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// shadcn/ui convention
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Tremor Raw convention (identical to cn)
export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}

// Tremor focusInput [v0.0.2]
export const focusInput = [
  // base
  'focus:ring-2',
  // ring color — mapped to electric-indigo for LocalVector
  'focus:ring-electric-indigo/30',
  // border color
  'focus:border-electric-indigo',
];

// Tremor Raw focusRing [v0.0.1]
export const focusRing = [
  // base
  'outline outline-offset-2 outline-0 focus-visible:outline-2',
  // outline color — mapped to electric-indigo for LocalVector
  'outline-electric-indigo',
];

// Tremor Raw hasErrorInput [v0.0.1]
export const hasErrorInput = [
  // base
  'ring-2',
  // border color — mapped to alert-crimson for LocalVector
  'border-alert-crimson',
  // ring color
  'ring-alert-crimson/30',
];
