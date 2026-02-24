# LocalVector.ai — Component Reference
> Full JSX for every reusable component. Read when building new UI, not on every task.
> For rules and tokens, see `DESIGN-SYSTEM.md`.

## useReveal Hook
```js
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}
```

## Reveal Wrapper
```jsx
function Reveal({ children, delay = 0, className = "" }) {
  const [ref, visible] = useReveal(0.12);
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(36px)",
      transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms`,
    }}>{children}</div>
  );
}
```

## PulseDot
```jsx
function PulseDot({ color = T.green, size = 8 }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, animation: "lv-ping 1.8s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ position: "relative", display: "block", width: size, height: size, borderRadius: "50%", background: color }} />
    </span>
  );
}
```
Sizes: `6` (eyebrow), `8` (default).

## Label
```jsx
function Label({ children, color = T.green }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>
      {children}
    </p>
  );
}
```

## Counter (animated number on scroll)
```jsx
function Counter({ end, prefix = "", suffix = "", duration = 1800 }) {
  const [ref, visible] = useReveal(0.3);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = end / (duration / 16);
    const id = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(id); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(id);
  }, [visible, end, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}
```

## Bar (animated progress on scroll)
```jsx
function Bar({ pct, color, delay = 0 }) {
  const [ref, visible] = useReveal(0.2);
  return (
    <div ref={ref} style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{ width: visible ? `${pct}%` : "0%", height: "100%", borderRadius: 3, background: color, transition: `width 1.2s cubic-bezier(.16,1,.3,1) ${delay}ms` }} />
    </div>
  );
}
```

## FAQ Accordion
```jsx
function FAQ({ q, a, delay = 0 }) {
  const [open, setOpen] = useState(false);
  const [ref, visible] = useReveal(0.15);
  return (
    <div ref={ref} style={{
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "20px 0", background: "none", border: "none", cursor: "pointer",
        fontFamily: "'Outfit', sans-serif", textAlign: "left",
      }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.white, paddingRight: 20 }}>{q}</span>
        <span style={{ color: T.green, fontSize: 20, flexShrink: 0, transition: "transform 0.3s", transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
      </button>
      <div style={{ maxHeight: open ? 300 : 0, overflow: "hidden", transition: "max-height 0.4s cubic-bezier(.16,1,.3,1), opacity 0.3s", opacity: open ? 1 : 0 }}>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: T.gray400, paddingBottom: 20, maxWidth: 680 }}>{a}</p>
      </div>
    </div>
  );
}
```

## Inline Style Recipes

### Eyebrow badge
```js
{ display: "inline-flex", alignItems: "center", gap: 8, background: T.amberDim, borderRadius: 100, padding: "6px 16px", marginBottom: 28 }
// inner text: { fontSize: 12, fontWeight: 600, color: T.amber, fontFamily: "'JetBrains Mono', monospace" }
```

### Status chip
```js
// green: { fontSize: 11, fontWeight: 600, color: T.green, background: T.greenDim, padding: "4px 10px", borderRadius: 6 }
// amber: { fontSize: 11, fontWeight: 600, color: T.amber, background: T.amberDim, padding: "4px 10px", borderRadius: 6 }
```

### Engine number badge
```js
{ fontSize: 11, fontWeight: 700, color: accent, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px 8px" }
```

### "What you see" sub-card
```js
{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px", borderLeft: `2px solid ${accent}44` }
```

### Headline green underline
```jsx
<span style={{ color: T.green, position: "relative" }}>
  text
  <span style={{ position: "absolute", bottom: -2, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${T.green}, transparent)`, borderRadius: 2, opacity: 0.5 }} />
</span>
```

### Input field
```js
{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: T.white, fontSize: 14, fontFamily: "'Outfit', sans-serif", outline: "none", transition: "border-color 0.25s" }
// Focus: borderColor → "rgba(0,245,160,0.3)"
// Blur:  borderColor → "rgba(255,255,255,0.08)"
```

### "Most Popular" pricing chip
```js
{ position: "absolute", top: 12, right: 12, fontSize: 10, fontWeight: 700, color: T.navy, background: T.green, padding: "3px 10px", borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.06em" }
// Card border: `1px solid rgba(0,245,160,0.3)`
```

## Nav Bar
```jsx
position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
background: scrollY > 40 ? "rgba(5,10,21,0.92)" : "transparent",
backdropFilter: scrollY > 40 ? "blur(16px)" : "none",
borderBottom: scrollY > 40 ? "1px solid rgba(255,255,255,0.05)" : "none",
transition: "all 0.35s", padding: "0 24px"
// Inner: maxWidth 1120, height 64
// Logo: 28×28, borderRadius 7, gradient(135deg, green, green88), letter 14/800/navy
// Wordmark: 700/16/"-0.02em", ".ai" in T.green
// Links: gap 28, 13/500/gray400
// CTA: .lv-btn-green + padding "8px 20px", fontSize 13, animation "none"
```

## Backgrounds

### Hero radial glow
```js
background: `radial-gradient(ellipse 70% 50% at 50% 30%, rgba(0,245,160,0.06) 0%, transparent 70%)`
```

### Hero grid overlay
```js
{ position: "absolute", inset: 0, opacity: 0.03, backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "60px 60px" }
```

### Card inner glows
```js
// Green:   { position: "absolute", inset: 0, opacity: 0.04, background: `radial-gradient(circle at 30% 30%, ${T.green}, transparent 60%)` }
// Crimson: { position: "absolute", inset: 0, opacity: 0.03, background: `radial-gradient(circle at 70% 70%, ${T.crimson}, transparent 60%)` }
```

### Final CTA floating glow
```js
{ position: "absolute", top: "50%", left: "50%", width: 600, height: 600, transform: "translate(-50%, -50%)", background: `radial-gradient(circle, rgba(0,245,160,0.06) 0%, transparent 70%)`, animation: "lv-float 6s ease-in-out infinite" }
```

### Scroll indicator
```js
// Outer: bottom 32, animation "lv-float 2.5s ease-in-out infinite"
// Track: 20×32, borderRadius 10, border `1.5px solid ${T.gray600}`
// Pip:   3×8, borderRadius 2, T.gray500, animation "lv-float 1.5s ease-in-out infinite"
```

## Stagger Delays
| Section | Increment | Pattern |
|---------|-----------|---------|
| Hero | 120ms | 0, 120, 240, 360, 480 |
| Label → h2 → content | 80ms | 0, 80, 160 |
| Stat cards (3) | 120ms | `i*120` |
| Score cards (2) | 150ms | 100, 250 |
| Engine cards (3) | 150ms | `i*150` |
| Pricing (4) | 100ms | `i*100` |
| FAQ items | 80ms | `i*80` |
| Closing text | 400–500ms | single Reveal |
