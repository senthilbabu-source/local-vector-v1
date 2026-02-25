# Claude Code Prompt #5 — Tremor Raw Foundation (Copy-Paste Components)

## Context

You are working on the **LocalVector.ai** codebase at `local-vector-v1/`. This is a Next.js 16.1.6 app with React 19.2.3, Tailwind CSS 4.2.0, shadcn/ui (manually installed with `cn()` in `lib/utils.ts`), and Recharts 2.15.4. Read `docs/AI_RULES.md` and `docs/DESIGN-SYSTEM.md` before making any changes.

**CRITICAL: DO NOT `npm install @tremor/react`.** The npm package requires `tailwind.config.js` which doesn't exist in Tailwind v4 projects. Instead, this prompt installs the **Tremor Raw** foundation — copy-paste utility files and npm dependencies that Tremor Raw chart components need. No actual chart components are copied yet — this is the foundation layer only.

Tremor Raw chart components (AreaChart, BarChart, DonutChart, etc.) will be copied in future prompts once this foundation is verified working.

## What Already Exists (DO NOT reinstall)

- `recharts@2.15.4` ✅ — Tremor charts are built on Recharts
- `clsx@2.1.1` ✅ — used by both shadcn `cn()` and Tremor `cx()`
- `tailwind-merge@3.5.0` ✅ — used by both shadcn `cn()` and Tremor `cx()`
- `lucide-react@0.575.0` ✅ — shadcn icons
- `lib/utils.ts` with `cn()` ✅ — shadcn class merge utility

## Step 1 — Install Tremor Raw dependencies

```bash
npm install @remixicon/react tailwind-variants
```

**Why these two:**
- `@remixicon/react` — Tremor chart components use `RiArrowLeftSLine` / `RiArrowRightSLine` for legend pagination arrows. Without this, chart components won't compile.
- `tailwind-variants` — Tremor's non-chart UI components (Button, Badge, Callout) use `tv()` from this package instead of shadcn's `cva()`. Peer dep: `tailwind-merge >=3.0.0` — you have 3.5.0, so compatible.

Verify in `package.json`:
- `@remixicon/react` in dependencies ✅
- `tailwind-variants` in dependencies ✅

## Step 2 — Add `cx` export to lib/utils.ts

Tremor components import `{ cx }` from `@/lib/utils`. shadcn components import `{ cn }` from `@/lib/utils`. Both are identical — `twMerge(clsx(...args))`. Add `cx` as a named alias alongside the existing `cn`.

Also add Tremor's `focusInput`, `focusRing`, and `hasErrorInput` utilities that non-chart Tremor components reference.

**Replace the contents of `lib/utils.ts` with:**

```typescript
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
```

**Note the color mapping:** Tremor's defaults use `blue-500` for focus and `red-500` for errors. We've remapped to `electric-indigo` (focus) and `alert-crimson` (errors) to match the LocalVector design system. These are already registered as Tailwind tokens in `globals.css`.

## Step 3 — Create lib/chartUtils.ts

This is the core utility file that ALL Tremor chart components import from. Copy it exactly from Tremor's docs, but remap chart colors to the LocalVector palette.

Create `lib/chartUtils.ts`:

```typescript
// ---------------------------------------------------------------------------
// lib/chartUtils.ts — Tremor Raw Chart Utilities
//
// Provides color mapping and axis utilities for Tremor chart components.
// All chart components (AreaChart, BarChart, DonutChart, LineChart, etc.)
// import from this file.
//
// Colors remapped to LocalVector design system palette.
// Original Tremor uses: blue, emerald, violet, amber, gray, cyan, pink, lime, fuchsia
// LocalVector maps: indigo, emerald, violet, amber, gray, cyan, pink, lime, fuchsia
//   (blue → indigo to match electric-indigo brand color)
//
// Source: https://www.tremor.so/docs/utilities/chartUtils
// ---------------------------------------------------------------------------

// Tremor chartColors [v0.1.0]

export type ColorUtility = 'bg' | 'stroke' | 'fill' | 'text';

export const chartColors = {
  indigo: {
    bg: 'bg-indigo-500',
    stroke: 'stroke-indigo-500',
    fill: 'fill-indigo-500',
    text: 'text-indigo-500',
  },
  emerald: {
    bg: 'bg-emerald-500',
    stroke: 'stroke-emerald-500',
    fill: 'fill-emerald-500',
    text: 'text-emerald-500',
  },
  violet: {
    bg: 'bg-violet-500',
    stroke: 'stroke-violet-500',
    fill: 'fill-violet-500',
    text: 'text-violet-500',
  },
  amber: {
    bg: 'bg-amber-500',
    stroke: 'stroke-amber-500',
    fill: 'fill-amber-500',
    text: 'text-amber-500',
  },
  gray: {
    bg: 'bg-gray-500',
    stroke: 'stroke-gray-500',
    fill: 'fill-gray-500',
    text: 'text-gray-500',
  },
  cyan: {
    bg: 'bg-cyan-500',
    stroke: 'stroke-cyan-500',
    fill: 'fill-cyan-500',
    text: 'text-cyan-500',
  },
  pink: {
    bg: 'bg-pink-500',
    stroke: 'stroke-pink-500',
    fill: 'fill-pink-500',
    text: 'text-pink-500',
  },
  lime: {
    bg: 'bg-lime-500',
    stroke: 'stroke-lime-500',
    fill: 'fill-lime-500',
    text: 'text-lime-500',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500',
    stroke: 'stroke-fuchsia-500',
    fill: 'fill-fuchsia-500',
    text: 'text-fuchsia-500',
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string;
  };
};

export type AvailableChartColorsKeys = keyof typeof chartColors;

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as Array<AvailableChartColorsKeys>;

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>();
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length]);
  });
  return categoryColors;
};

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: 'bg-gray-500',
    stroke: 'stroke-gray-500',
    fill: 'fill-gray-500',
    text: 'text-gray-500',
  };
  return chartColors[color]?.[type] ?? fallbackColor[type];
};

// Tremor getYAxisDomain [v0.0.0]
export const getYAxisDomain = (
  autoMinValue: boolean,
  minValue: number | undefined,
  maxValue: number | undefined,
) => {
  const minDomain = autoMinValue ? 'auto' : minValue ?? 0;
  const maxDomain = maxValue ?? 'auto';
  return [minDomain, maxDomain];
};

// Tremor hasOnlyOneValueForKey [v0.1.0]
export function hasOnlyOneValueForKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: any[],
  keyToCheck: string,
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const val: any[] = [];

  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      val.push(obj[keyToCheck]);
      if (val.length > 1) {
        return false;
      }
    }
  }

  return true;
}
```

## Step 4 — Create lib/useOnWindowResize.ts

Chart components use this hook to handle responsive tooltip positioning.

Create `lib/useOnWindowResize.ts`:

```typescript
// ---------------------------------------------------------------------------
// lib/useOnWindowResize.ts — Tremor Raw Window Resize Hook
//
// Used by chart components for responsive layout recalculation.
// Source: https://www.tremor.so/docs/getting-started/installation/next
// ---------------------------------------------------------------------------

// Tremor useOnWindowResize [v0.0.2]

import * as React from 'react';

export const useOnWindowResize = (handler: () => void) => {
  React.useEffect(() => {
    const handleResize = () => {
      handler();
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handler]);
};
```

## Step 5 — Create the components/tremor/ directory

```bash
mkdir -p components/tremor
```

This directory will house Tremor Raw chart components (separate from shadcn's `components/ui/`). This separation keeps the two component libraries organized:
- `components/ui/` — shadcn/ui components (Button, Card, Dialog, etc.)
- `components/tremor/` — Tremor Raw chart components (AreaChart, BarChart, etc.)

## Step 6 — Verify build

```bash
npm run build
```

If the build fails, check:
1. Does `lib/utils.ts` compile? (The `cx` export must not conflict with `cn`)
2. Does `lib/chartUtils.ts` compile? (TypeScript `satisfies` requires TS 4.9+, you have 5.x)
3. Does `lib/useOnWindowResize.ts` compile? (Simple React effect hook)

## Step 7 — Run tests

```bash
npm run test
```

All existing tests must pass. The only file modified is `lib/utils.ts` (adding `cx` and focus utilities). Existing shadcn components import `cn` which is unchanged.

**Specific concern:** The shadcn Button component (`components/ui/button.tsx`) imports `{ cn } from "@/lib/utils"`. Verify this import still resolves after adding the new exports. It should — we're adding exports, not renaming or removing `cn`.

## Step 8 — Verify cn still works for shadcn

```bash
grep "import.*cn.*from.*utils" components/ui/button.tsx
```

Should return the existing import line. The button component should still build correctly.

## Step 9 — Commit

```
feat: add Tremor Raw foundation (utilities, deps, directory structure)

Foundation for copy-paste Tremor Raw chart components:
- Installed @remixicon/react (chart pagination icons) and tailwind-variants
- Added cx() export to lib/utils.ts alongside existing cn() (same function)
- Added focusInput, focusRing, hasErrorInput utilities to lib/utils.ts
- Created lib/chartUtils.ts with color mapping and axis utilities
- Created lib/useOnWindowResize.ts responsive hook
- Created components/tremor/ directory for chart components

Colors remapped to LocalVector design system:
- Focus states: electric-indigo (replaces Tremor blue-500)
- Error states: alert-crimson (replaces Tremor red-500)
- Default chart palette: indigo first (matches brand)

No chart components copied yet — this is the utility foundation.
shadcn cn() import path unchanged. Zero changes to existing components.
```

## Rules

- **NEVER `npm install @tremor/react`** — the npm package is incompatible with Tailwind v4
- The ONLY existing file you may modify is `lib/utils.ts`
- Do NOT modify `app/globals.css`
- Do NOT modify `components/ui/button.tsx` or any shadcn component
- Do NOT modify `components.json`
- Do NOT modify any dashboard component in `app/dashboard/`
- Do NOT modify `app/layout.tsx`
- Do NOT create any files inside `components/ui/` — that's shadcn territory
- Tremor chart components go in `components/tremor/` ONLY
- The existing `cn` function in `lib/utils.ts` must remain unchanged — only ADD new exports
- If `npm run build` or `npm run test` fails, STOP and report the error
