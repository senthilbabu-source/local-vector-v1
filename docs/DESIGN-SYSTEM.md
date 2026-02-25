# LocalVector.ai — Design System Rules
> Read before editing any frontend file. For full component JSX, see `DESIGN-SYSTEM-COMPONENTS.md`.

## Color Tokens

### Tailwind v4 Design Tokens (from `globals.css` — use as utility classes)

These are registered via `@theme inline` in `app/globals.css` and available as Tailwind utilities
(e.g., `bg-midnight-slate`, `text-electric-indigo`, `border-signal-green`):

```css
/* ── Background surfaces ── */
--color-midnight-slate:  #050A15;   /* bg-midnight-slate — primary dark bg */
--color-surface-dark:    #0A1628;   /* bg-surface-dark — card/panel bg */

/* ── Brand / Accent ── */
--color-electric-indigo: #6366f1;   /* text-electric-indigo — dashboard interactive accent */
--color-signal-green:    #00F5A0;   /* text-signal-green — brand CTA, success, Growth tier */

/* ── Semantic colours ── */
--color-alert-crimson:   #ef4444;   /* text-alert-crimson — errors, hallucination alerts */
--color-truth-emerald:   #10b981;   /* text-truth-emerald — verified/healthy states */
--color-alert-amber:     #FFB800;   /* text-alert-amber — warnings, stale states */
--color-deep-navy:       #050A15;   /* alias for midnight-slate */
```

**Color usage contexts:**
- **signal-green** → brand CTAs (`.lv-btn-green`), Growth tier highlight (`border-signal-green`), success states
- **electric-indigo** → dashboard interactive elements (buttons, inputs, AI assistant, badges, form focus rings)
- **alert-crimson** → hallucination alerts, error states, danger badges
- **alert-amber** → warnings, stale sync, pending review states
- **truth-emerald** → healthy/verified status badges

### Legacy `T.` Object (inline styles on marketing pages)
```js
const T = {
  navy: "#050A15", navyLight: "#0A1628", navyMid: "#111D33",
  green: "#00F5A0", greenDim: "rgba(0,245,160,0.12)", greenGlow: "rgba(0,245,160,0.25)",
  amber: "#FFB800", amberDim: "rgba(255,184,0,0.12)",
  crimson: "#EF4444", crimsonDim: "rgba(239,68,68,0.10)",
  white: "#F1F5F9", gray300: "#CBD5E1", gray400: "#94A3B8",
  gray500: "#64748B", gray600: "#475569", gray700: "#334155",
};
```
Common inline RGBAs: borders `rgba(255,255,255, 0.03|0.05|0.08)`, green glows `rgba(0,245,160, 0.06|0.12|0.15|0.3)`, shadow `rgba(0,0,0,0.3)`, accent suffixes `${hex}44`=27% `${hex}33`=20% `${hex}88`=53%.

## Fonts
```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
```
- **Outfit** → headings, body, buttons, nav, FAQ
- **JetBrains Mono** → section labels, scores, prices, stat numbers, micro-copy, engine subtitles ONLY

## Type Scale (key sizes)
| Element | size | weight | spacing | font |
|---------|------|--------|---------|------|
| Hero h1 | `clamp(32px,5vw,58px)` | 800 | -0.03em | Outfit |
| Section h2 | `clamp(24px,3.5vw,38px)` | 700 | -0.02em | Outfit |
| Card h3 | 20 | 700 | — | Outfit |
| Body | 14–15 | 400 | — | Outfit, line-height 1.6–1.75 |
| Section label | 11 | 700 | 0.14em | JetBrains Mono, uppercase |
| Stat numbers | `clamp(32px,4vw,48px)` | 800 | — | JetBrains Mono |
| Micro-copy | 11 | 400 | — | JetBrains Mono |

## CSS Keyframes (defined in globals.css — never create new ones in components)
| Name | Duration | Easing | Use |
|------|----------|--------|-----|
| `lv-ping` | 1.8s | cubic-bezier(0,0,0.2,1) inf | PulseDot rings |
| `lv-glow` | 3s | ease-in-out inf | `.lv-btn-green` only (max 2/viewport, nav gets `animation:none`) |
| `lv-scan` | 3–4s | linear inf | Accent sweep bars on cards (stagger 1000ms) |
| `lv-float` | 1.5–6s | ease-in-out inf | Scroll indicator, decorative glows |
| `lv-shimmer` | 2s | ease-in-out | Model chips (forwards, staggered), locked text (infinite) |
| `lv-blink` | — | — | Available, unused |
| `lv-gradient` | — | — | Available, unused |

## CSS Classes
- `.lv-card` — bg navyLight, border `rgba(255,255,255,0.05)`, radius 16, pad 28, hover lifts -3px
- `.lv-btn-green` — bg green, color navy, radius 10, pad 14/32, glow animation, hover lifts -2px+scale
- `.lv-btn-outline` — transparent, green text, green/30 border, radius 10, hover fills 6%
- `.lv-section` — max-w 1120, pad 100/24 (64/16 mobile)
- `.lv-grid2` — 2-col grid, gap 24 (1-col ≤840px)
- `.lv-grid3` — 3-col grid, gap 24 (1-col ≤840px)

## Scroll Reveal
`Reveal` wrapper: translateY(36px→0), 0.7s, `cubic-bezier(.16,1,.3,1)`, threshold 0.12. Fire once.
FAQ uses lighter: translateY(20px→0), 0.5s ease. Stagger: hero 120ms, grids 100–150ms, FAQ 80ms.

## Layout
- Max width: 1120px. Single breakpoint: 840px.
- Section alternation: `T.navy` ↔ `T.navyLight` + `rgba(255,255,255,0.03)` border. No third bg.
- Nav: fixed, transparent→`rgba(5,10,21,0.92)` at 40px scroll, blur(16px), height 64
- Hero: min-height 100vh, paddingTop 80

## Border Radius Scale
2 (underlines) · 3 (progress bars) · 6 (chips/badges) · 7 (logo) · 10 (buttons/inputs) · 12 (highlight boxes) · 16 (cards) · 100 (pills)

## Hard Rules
1. No animation libraries (Framer Motion, GSAP, AOS). CSS keyframes + IntersectionObserver only.
2. No new keyframes in component files. Add to `globals.css` with `lv-` prefix.
3. Fonts: Outfit + JetBrains Mono. No Inter, Roboto, Arial.
4. `T.white`=#F1F5F9 not #FFF. `T.navy`=#050A15 not #000.
5. One accent per card: green=success, amber=warning, crimson=danger.
6. Max 2 glowing buttons per viewport. Nav CTA = `animation: none`.
7. Radial glow opacity: 0.03–0.06 max.
8. JetBrains Mono = data elements only. Never paragraphs or headings.
