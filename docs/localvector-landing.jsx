import { useState, useEffect, useRef, useCallback } from "react";

// ─── Design Tokens ───────────────────────────────────────────────
const T = {
  navy: "#050A15",
  navyLight: "#0A1628",
  navyMid: "#111D33",
  green: "#00F5A0",
  greenDim: "rgba(0,245,160,0.12)",
  greenGlow: "rgba(0,245,160,0.25)",
  amber: "#FFB800",
  amberDim: "rgba(255,184,0,0.12)",
  crimson: "#EF4444",
  crimsonDim: "rgba(239,68,68,0.10)",
  white: "#F1F5F9",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
};

// ─── Scroll-reveal hook (IntersectionObserver, zero deps) ────────
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

// ─── Reusable Animated Section wrapper ───────────────────────────
function Reveal({ children, delay = 0, className = "" }) {
  const [ref, visible] = useReveal(0.12);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(36px)",
        transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Animated counter ────────────────────────────────────────────
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

// ─── Animated progress bar ───────────────────────────────────────
function Bar({ pct, color, delay = 0 }) {
  const [ref, visible] = useReveal(0.2);
  return (
    <div ref={ref} style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div
        style={{
          width: visible ? `${pct}%` : "0%",
          height: "100%",
          borderRadius: 3,
          background: color,
          transition: `width 1.2s cubic-bezier(.16,1,.3,1) ${delay}ms`,
        }}
      />
    </div>
  );
}

// ─── Pulsing dot ─────────────────────────────────────────────────
function PulseDot({ color = T.green, size = 8 }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%", background: color,
        animation: "lv-ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
      }} />
      <span style={{ position: "relative", display: "block", width: size, height: size, borderRadius: "50%", background: color }} />
    </span>
  );
}

// ─── Section label ───────────────────────────────────────────────
function Label({ children, color = T.green }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
      color, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace",
    }}>
      {children}
    </p>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════
export default function LocalVectorLanding() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const h = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div style={{ background: T.navy, color: T.white, fontFamily: "'Outfit', sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        @keyframes lv-ping { 0% { transform: scale(1); opacity: 0.75; } 75%, 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes lv-glow { 0%, 100% { box-shadow: 0 0 20px ${T.greenGlow}, 0 0 40px rgba(0,245,160,0.08); } 50% { box-shadow: 0 0 30px ${T.greenGlow}, 0 0 60px rgba(0,245,160,0.15); } }
        @keyframes lv-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(400%); } }
        @keyframes lv-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes lv-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes lv-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes lv-gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        .lv-card {
          background: ${T.navyLight};
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 28px;
          transition: border-color 0.35s, transform 0.35s, box-shadow 0.35s;
        }
        .lv-card:hover {
          border-color: rgba(0,245,160,0.15);
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }
        .lv-btn-green {
          background: ${T.green}; color: ${T.navy}; border: none; padding: 14px 32px;
          border-radius: 10px; font-weight: 700; font-size: 15px; cursor: pointer;
          font-family: 'Outfit', sans-serif; letter-spacing: 0.01em;
          animation: lv-glow 3s ease-in-out infinite;
          transition: transform 0.2s, filter 0.2s;
        }
        .lv-btn-green:hover { transform: translateY(-2px) scale(1.02); filter: brightness(1.1); }
        .lv-btn-outline {
          background: transparent; color: ${T.green}; border: 1px solid rgba(0,245,160,0.3);
          padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px;
          cursor: pointer; font-family: 'Outfit', sans-serif;
          transition: background 0.25s, border-color 0.25s, transform 0.2s;
        }
        .lv-btn-outline:hover { background: rgba(0,245,160,0.06); border-color: ${T.green}; transform: translateY(-1px); }
        .lv-section { max-width: 1120px; margin: 0 auto; padding: 100px 24px; }
        .lv-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .lv-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 840px) {
          .lv-grid2, .lv-grid3 { grid-template-columns: 1fr; }
          .lv-section { padding: 64px 16px; }
        }
      `}</style>

      {/* ══════ NAV ══════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrollY > 40 ? "rgba(5,10,21,0.92)" : "transparent",
        backdropFilter: scrollY > 40 ? "blur(16px)" : "none",
        borderBottom: scrollY > 40 ? "1px solid rgba(255,255,255,0.05)" : "none",
        transition: "all 0.35s",
        padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg, ${T.green}, ${T.green}88)`, display: "grid", placeItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.navy }}>L</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>LocalVector<span style={{ color: T.green }}>.ai</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 13, fontWeight: 500, color: T.gray400 }}>
            <a href="#how" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}>How It Works</a>
            <a href="#pricing" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}>Pricing</a>
            <button className="lv-btn-green" style={{ padding: "8px 20px", fontSize: 13, animation: "none" }}>
              Free AI Audit →
            </button>
          </div>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center",
        position: "relative", paddingTop: 80,
        background: `radial-gradient(ellipse 70% 50% at 50% 30%, rgba(0,245,160,0.06) 0%, transparent 70%)`,
      }}>
        {/* Subtle grid overlay */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

        <div className="lv-section" style={{ padding: "0 24px", position: "relative" }}>
          {/* Eyebrow */}
          <Reveal>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: T.amberDim, borderRadius: 100, padding: "6px 16px", marginBottom: 28 }}>
              <PulseDot color={T.amber} size={6} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.amber, fontFamily: "'JetBrains Mono', monospace" }}>
                RIGHT NOW: AI is answering questions about your business
              </span>
            </div>
          </Reveal>

          {/* Headline */}
          <Reveal delay={120}>
            <h1 style={{
              fontSize: "clamp(32px, 5vw, 58px)", fontWeight: 800, lineHeight: 1.1,
              letterSpacing: "-0.03em", maxWidth: 780, marginBottom: 20,
            }}>
              Every hour, ChatGPT answers{" "}
              <span style={{ color: T.green, position: "relative" }}>
                11,000 questions
                <span style={{
                  position: "absolute", bottom: -2, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, ${T.green}, transparent)`,
                  borderRadius: 2, opacity: 0.5,
                }} />
              </span>{" "}
              about local restaurants.<br />Yours included.
            </h1>
          </Reveal>

          {/* Subheadline */}
          <Reveal delay={240}>
            <p style={{ fontSize: 18, lineHeight: 1.65, color: T.gray400, maxWidth: 620, marginBottom: 40 }}>
              Most of those answers are wrong. Wrong hours. Wrong prices. "Permanently closed" when you're wide open.
              Every wrong answer sends a customer to your competitor — and you never know it happened.
            </p>
          </Reveal>

          {/* CTA area */}
          <Reveal delay={360}>
            <div style={{
              background: T.navyLight, border: `1px solid rgba(0,245,160,0.12)`,
              borderRadius: 16, padding: 28, maxWidth: 560,
            }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.gray400, marginBottom: 14 }}>
                See exactly what AI is telling your customers right now.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  placeholder="Enter your business name or URL"
                  style={{
                    flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)", color: T.white, fontSize: 14,
                    fontFamily: "'Outfit', sans-serif", outline: "none",
                    transition: "border-color 0.25s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(0,245,160,0.3)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                />
                <button className="lv-btn-green" style={{ whiteSpace: "nowrap", padding: "12px 24px" }}>
                  Run Free Audit →
                </button>
              </div>
              <p style={{ fontSize: 11, color: T.gray600, marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                No signup · No credit card · 8 seconds · Real results
              </p>
            </div>
          </Reveal>

          {/* Model strip */}
          <Reveal delay={480}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 48, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: T.gray600, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>
                Monitoring:
              </span>
              {["ChatGPT", "Perplexity", "Google Gemini", "Claude", "Copilot"].map((m, i) => (
                <span key={m} style={{
                  fontSize: 12, color: T.gray500, fontWeight: 500, padding: "4px 12px",
                  background: "rgba(255,255,255,0.03)", borderRadius: 6,
                  opacity: 0, animation: `lv-shimmer 2s ease-in-out forwards`,
                  animationDelay: `${600 + i * 150}ms`,
                  animationFillMode: "forwards",
                }}>
                  {m}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Scroll hint */}
        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", animation: "lv-float 2.5s ease-in-out infinite" }}>
          <div style={{ width: 20, height: 32, borderRadius: 10, border: `1.5px solid ${T.gray600}`, display: "flex", justifyContent: "center", paddingTop: 6 }}>
            <div style={{ width: 3, height: 8, borderRadius: 2, background: T.gray500, animation: "lv-float 1.5s ease-in-out infinite" }} />
          </div>
        </div>
      </section>

      {/* ══════ THE PROBLEM ══════ */}
      <section style={{ background: T.navyLight, borderTop: `1px solid rgba(255,255,255,0.03)`, borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
        <div className="lv-section">
          <Reveal><Label color={T.amber}>THE INVISIBLE REVENUE LEAK</Label></Reveal>
          <Reveal delay={80}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 700, lineHeight: 1.2, maxWidth: 700, marginBottom: 48, letterSpacing: "-0.02em" }}>
              AI doesn't guess. It states. And when it's wrong, customers don't verify — they leave.
            </h2>
          </Reveal>

          <div className="lv-grid3">
            {[
              { val: "$1,600", sub: "/month", desc: "Revenue one restaurant lost because ChatGPT said they were closed on Mondays. They weren't.", border: T.crimson },
              { val: "68", sub: "%", desc: "Of consumers now use AI assistants to decide where to eat — before they ever see your website.", border: T.amber },
              { val: "0", sub: " alerts", desc: "How many notifications you get when AI sends customers to your competitor. It happens silently. Every day.", border: T.crimson },
            ].map((c, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="lv-card" style={{ borderLeft: `3px solid ${c.border}`, position: "relative", overflow: "hidden" }}>
                  {/* Subtle scan line animation */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 1,
                    background: `linear-gradient(90deg, transparent, ${c.border}44, transparent)`,
                    animation: "lv-scan 3s linear infinite", animationDelay: `${i * 1000}ms`,
                    opacity: 0.5,
                  }} />
                  <div style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 800, color: T.white, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                    <Counter end={parseInt(c.val.replace(/\D/g, ""))} prefix={c.val.startsWith("$") ? "$" : ""} suffix={c.sub} />
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: T.gray400 }}>{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={400}>
            <p style={{ textAlign: "center", color: T.gray500, fontSize: 14, marginTop: 40, maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>
              Traditional SEO tools check if your address is right on Yelp.
              They never check if ChatGPT is telling customers you don't exist.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════ SELF-SCORE (Practice What We Preach) ══════ */}
      <section>
        <div className="lv-section">
          <Reveal><Label>PRACTICE WHAT WE PREACH</Label></Reveal>
          <Reveal delay={80}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 700, lineHeight: 1.2, marginBottom: 48, letterSpacing: "-0.02em" }}>
              We built an AI Visibility platform. So we score ourselves.
            </h2>
          </Reveal>

          <div className="lv-grid2">
            {/* Our score */}
            <Reveal delay={100}>
              <div className="lv-card" style={{ border: `1px solid rgba(0,245,160,0.2)`, position: "relative", overflow: "hidden" }}>
                <div style={{
                  position: "absolute", inset: 0, opacity: 0.04,
                  background: `radial-gradient(circle at 30% 30%, ${T.green}, transparent 60%)`,
                }} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>LocalVector.ai</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.green, background: T.greenDim, padding: "4px 10px", borderRadius: 6 }}>
                      ✅ Fully Protected
                    </span>
                  </div>
                  {[
                    { label: "AI Visibility Score", val: 97, color: T.green },
                    { label: "Citation Accuracy", val: 100, color: T.green },
                    { label: "Hallucinations Detected", val: 0, color: T.green, isZero: true },
                  ].map((r, i) => (
                    <div key={i} style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: T.gray400 }}>
                        <span>{r.label}</span>
                        <span style={{ fontWeight: 700, color: T.white, fontFamily: "'JetBrains Mono', monospace" }}>
                          {r.isZero ? "0" : <Counter end={r.val} />}{!r.isZero && "/100"}
                        </span>
                      </div>
                      <Bar pct={r.isZero ? 100 : r.val} color={r.color} delay={i * 200} />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Average business */}
            <Reveal delay={250}>
              <div className="lv-card" style={{ border: `1px solid rgba(239,68,68,0.12)`, position: "relative", overflow: "hidden" }}>
                <div style={{
                  position: "absolute", inset: 0, opacity: 0.03,
                  background: `radial-gradient(circle at 70% 70%, ${T.crimson}, transparent 60%)`,
                }} />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Average Local Business</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T.amber, background: T.amberDim, padding: "4px 10px", borderRadius: 6 }}>
                      ⚠️ Flying Blind
                    </span>
                  </div>
                  {[
                    { label: "AI Visibility Score", display: "██/100" },
                    { label: "Citation Accuracy", display: "Unknown" },
                    { label: "Hallucinations Detected", display: "Unknown" },
                  ].map((r, i) => (
                    <div key={i} style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: T.gray400 }}>
                        <span>{r.label}</span>
                        <span style={{
                          fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                          color: T.gray600,
                          background: r.display.includes("██") ? `linear-gradient(90deg, ${T.gray600}, ${T.gray700}, ${T.gray600})` : "none",
                          backgroundSize: "200% 100%",
                          animation: r.display.includes("██") ? "lv-shimmer 2s linear infinite" : "none",
                          WebkitBackgroundClip: r.display.includes("██") ? "text" : "unset",
                          WebkitTextFillColor: r.display.includes("██") ? "transparent" : "unset",
                        }}>
                          {r.display}
                        </span>
                      </div>
                      <Bar pct={12} color={T.gray700} delay={i * 200} />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={400}>
            <p style={{ textAlign: "center", color: T.gray400, fontSize: 16, marginTop: 40, fontWeight: 500 }}>
              You wouldn't run a restaurant without a fire alarm.<br />Why run one without an AI alarm?
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════ HOW IT WORKS — THREE ENGINES ══════ */}
      <section id="how" style={{ background: T.navyLight, borderTop: `1px solid rgba(255,255,255,0.03)`, borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
        <div className="lv-section">
          <Reveal><Label>THE THREE ENGINES</Label></Reveal>
          <Reveal delay={80}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 700, lineHeight: 1.2, marginBottom: 56, letterSpacing: "-0.02em" }}>
              Detect the lies. Steal the spotlight. Force the truth.
            </h2>
          </Reveal>

          <div className="lv-grid3">
            {[
              {
                num: "01", icon: "🛡️", accent: T.crimson,
                title: "The Fear Engine",
                subtitle: "AI Hallucination Auditor",
                body: "We interrogate ChatGPT, Perplexity, and Gemini with the same questions your customers ask. Then we compare every answer against your verified data. When AI says you're closed and you're not — Red Alert.",
                result: "A priority-ranked feed of every lie AI is telling about you, with severity scores and dollar-cost estimates.",
              },
              {
                num: "02", icon: "🎯", accent: T.amber,
                title: "The Greed Engine",
                subtitle: "Competitor Intelligence",
                body: "We ask AI: \"Who's the best in your city?\" Then we analyze exactly why your competitor won — and you didn't. Not vague advice. Specific action items you can execute this week.",
                result: "Competitor gap analysis showing the exact words and signals costing you recommendations.",
              },
              {
                num: "03", icon: "✨", accent: T.green,
                title: "The Magic Engine",
                subtitle: "AI-Readable Menu Generator",
                body: "AI can't read your PDF menu. So it guesses — or pulls prices from DoorDash with their 30% markup. Upload your menu. We convert it into structured data every AI on earth can understand.",
                result: "Your menu, readable by every AI, hosted on a page you control — with one-click Google injection.",
              },
            ].map((e, i) => (
              <Reveal key={i} delay={i * 150}>
                <div className="lv-card" style={{ position: "relative", overflow: "hidden", height: "100%" }}>
                  {/* Top accent line with scan animation */}
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: e.accent, opacity: 0.5 }} />
                  <div style={{
                    position: "absolute", top: 0, left: 0, width: 60, height: 2,
                    background: e.accent,
                    animation: `lv-scan 4s linear infinite`,
                    animationDelay: `${i * 600}ms`,
                    transform: "none",
                  }} />

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: e.accent, fontFamily: "'JetBrains Mono', monospace",
                      border: `1px solid ${e.accent}33`, borderRadius: 6, padding: "3px 8px",
                    }}>
                      {e.num}
                    </span>
                    <span style={{ fontSize: 20 }}>{e.icon}</span>
                  </div>

                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{e.title}</h3>
                  <p style={{ fontSize: 12, color: e.accent, fontWeight: 600, marginBottom: 16, fontFamily: "'JetBrains Mono', monospace" }}>
                    {e.subtitle}
                  </p>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: T.gray400, marginBottom: 20 }}>{e.body}</p>

                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 16px", borderLeft: `2px solid ${e.accent}44` }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.gray500, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                      What you see
                    </p>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: T.gray300 }}>{e.result}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <p style={{ textAlign: "center", color: T.green, fontSize: 14, fontWeight: 600, marginTop: 48 }}>
              Every engine runs automatically. Open the dashboard, see the problems, fix them in minutes.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════ COMPARISON TABLE ══════ */}
      <section>
        <div className="lv-section">
          <Reveal><Label color={T.amber}>THE DIFFERENCE</Label></Reveal>
          <Reveal delay={80}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, lineHeight: 1.2, marginBottom: 48, letterSpacing: "-0.02em" }}>
              Static listings were built for Google.<br />
              <span style={{ color: T.green }}>AI runs on a completely different trust model.</span>
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid rgba(255,255,255,0.05)` }}>
              {/* Header row */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 160px 160px", gap: 0,
                background: T.navyMid, padding: "14px 24px",
                borderBottom: `1px solid rgba(255,255,255,0.05)`,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.gray500, textTransform: "uppercase", letterSpacing: "0.08em" }}>Capability</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.green, textAlign: "center" }}>LocalVector</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.gray500, textAlign: "center" }}>Listing Tools</span>
              </div>
              {[
                ["Detects AI hallucinations about your business", true, false],
                ["Shows what ChatGPT actually says about you", true, false],
                ["Tells you WHY competitors win AI recommendations", true, false],
                ["Converts PDF menu into AI-readable data", true, false],
                ["Monitors AI sentiment (Premium vs. Budget)", true, false],
                ["Pushes to 48 directories nobody visits", false, true],
              ].map(([cap, us, them], i) => (
                <div
                  key={i}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 160px 160px", gap: 0,
                    padding: "14px 24px",
                    background: i % 2 === 0 ? T.navyLight : "transparent",
                    borderBottom: `1px solid rgba(255,255,255,0.03)`,
                    transition: "background 0.2s",
                  }}
                >
                  <span style={{ fontSize: 14, color: T.gray300 }}>{cap}</span>
                  <span style={{ textAlign: "center", fontSize: 16 }}>
                    {us ? <span style={{ color: T.green }}>✓</span> : <span style={{ color: T.gray700 }}>—</span>}
                  </span>
                  <span style={{ textAlign: "center", fontSize: 16 }}>
                    {them ? <span style={{ color: T.gray500 }}>✓</span> : <span style={{ color: T.crimson, opacity: 0.6 }}>✗</span>}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ CASE STUDY ══════ */}
      <section style={{ background: T.navyLight, borderTop: `1px solid rgba(255,255,255,0.03)`, borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
        <div className="lv-section">
          <Reveal><Label color={T.crimson}>REAL DAMAGE. REAL RECOVERY.</Label></Reveal>
          <Reveal delay={80}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 700, lineHeight: 1.2, marginBottom: 48, letterSpacing: "-0.02em" }}>
              The $12,000 Steakhouse That Didn't Exist
            </h2>
          </Reveal>

          <div className="lv-grid2" style={{ gap: 32 }}>
            <Reveal delay={120}>
              <div>
                <p style={{ fontSize: 15, lineHeight: 1.75, color: T.gray400, marginBottom: 20 }}>
                  A well-reviewed steakhouse in Dallas ran a thriving Friday night business for 11 years.
                  In September 2025, their revenue started dropping. They blamed the economy. Changed the menu twice.
                </p>
                <p style={{ fontSize: 15, lineHeight: 1.75, color: T.gray300, marginBottom: 20 }}>
                  <strong style={{ color: T.white }}>The actual problem:</strong> ChatGPT had been telling customers
                  the restaurant was "permanently closed" since August. For three months, every person who asked
                  "best steakhouse near downtown Dallas" was sent somewhere else.
                </p>
                <p style={{ fontSize: 15, lineHeight: 1.75, color: T.gray400, marginBottom: 28 }}>
                  Nobody told them. No tool flagged it. No alert fired. By the time they found out — by accident —
                  they'd lost an estimated <strong style={{ color: T.crimson }}>$12,000</strong>.
                </p>
                <div style={{
                  background: T.greenDim, borderRadius: 12, padding: "16px 20px",
                  borderLeft: `3px solid ${T.green}`,
                }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: T.green }}>
                    The fix took 24 hours.
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={280}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Before */}
                <div className="lv-card" style={{ borderLeft: `3px solid ${T.crimson}` }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: T.crimson, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                    Before LocalVector
                  </p>
                  {[
                    ["AI Status", '"Permanently Closed" ❌'],
                    ["Monthly AI Recommendations", "0"],
                    ["Revenue Impact", "−$4,000/mo"],
                    ["Time to Discovery", "3 months (by accident)"],
                  ].map(([k, v], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 3 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                      <span style={{ fontSize: 13, color: T.gray500 }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.gray300, fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
                    </div>
                  ))}
                </div>
                {/* After */}
                <div className="lv-card" style={{ borderLeft: `3px solid ${T.green}` }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                    After LocalVector
                  </p>
                  {[
                    ["AI Status", '"Open, Serving Dinner" ✅'],
                    ["Monthly AI Recommendations", "47"],
                    ["Revenue Recovered", "+$4,000/mo"],
                    ["Time to Detection", "24 hours (automated)"],
                  ].map(([k, v], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 3 ? `1px solid rgba(255,255,255,0.04)` : "none" }}>
                      <span style={{ fontSize: 13, color: T.gray500 }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.gray300, fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════ PRICING ══════ */}
      <section id="pricing">
        <div className="lv-section">
          <Reveal><Label>PRICING</Label></Reveal>
          <Reveal delay={80}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 700, lineHeight: 1.2, marginBottom: 8, letterSpacing: "-0.02em" }}>
              Cheaper than one lost table.
            </h2>
            <p style={{ fontSize: 16, color: T.gray400, marginBottom: 56, maxWidth: 540 }}>
              One wrong AI answer costs you a customer. One lost Friday reservation: $120. Our monthly price: less than that.
            </p>
          </Reveal>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              {
                name: "THE AUDIT", price: "Free", sub: "See the damage.", popular: false,
                features: ["One-time AI hallucination scan", "Real AI mentions + sentiment", "ChatGPT, Perplexity, Gemini", "No signup required"],
                cta: "Run Free Audit →", ctaStyle: "outline",
              },
              {
                name: "STARTER", price: "$29", sub: "Stop the bleeding.", popular: false,
                features: ["Weekly automated AI audits", "Hallucination email alerts", "Reality Score dashboard", "Magic Menu (1 menu)", "Big 6 listing tracker", "1 location"],
                cta: "Start for $29/mo →", ctaStyle: "outline",
              },
              {
                name: "AI SHIELD", price: "$59", sub: "Go on offense.", popular: true,
                features: ["Daily AI audits", "Competitor Intercept analysis", "AI Sentiment tracking", "Content recommendations", "Share of Voice tracking", "Priority alerts", "1 location"],
                cta: "Get AI Shield →", ctaStyle: "green",
              },
              {
                name: "BRAND FORTRESS", price: "Custom", sub: "Agencies & multi-location.", popular: false,
                features: ["Up to 25 locations", "White-label reports", "Agency dashboard", "Dedicated onboarding", "Custom query monitoring", "API access"],
                cta: "Talk to Us →", ctaStyle: "outline",
              },
            ].map((tier, i) => (
              <Reveal key={i} delay={i * 100}>
                <div
                  className="lv-card"
                  style={{
                    position: "relative", overflow: "hidden", height: "100%",
                    display: "flex", flexDirection: "column",
                    border: tier.popular ? `1px solid rgba(0,245,160,0.3)` : undefined,
                  }}
                >
                  {tier.popular && (
                    <div style={{
                      position: "absolute", top: 12, right: 12,
                      fontSize: 10, fontWeight: 700, color: T.navy, background: T.green,
                      padding: "3px 10px", borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      Most Popular
                    </div>
                  )}
                  <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: T.gray500, textTransform: "uppercase", marginBottom: 12 }}>
                    {tier.name}
                  </p>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 36, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                      {tier.price}
                    </span>
                    {tier.price !== "Free" && tier.price !== "Custom" && (
                      <span style={{ fontSize: 14, color: T.gray500 }}>/mo</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: T.gray400, marginBottom: 24 }}>{tier.sub}</p>

                  <div style={{ flex: 1 }}>
                    {tier.features.map((f, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                        <span style={{ color: T.green, fontSize: 14, lineHeight: "20px", flexShrink: 0 }}>✓</span>
                        <span style={{ fontSize: 13, color: T.gray400, lineHeight: "20px" }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    className={tier.ctaStyle === "green" ? "lv-btn-green" : "lv-btn-outline"}
                    style={{ width: "100%", marginTop: 20, fontSize: 13 }}
                  >
                    {tier.cta}
                  </button>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={500}>
            <p style={{ textAlign: "center", color: T.gray500, fontSize: 13, marginTop: 32 }}>
              14-day free trial on all plans. Cancel anytime. No contracts. No setup fees.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section style={{ background: T.navyLight, borderTop: `1px solid rgba(255,255,255,0.03)` }}>
        <div className="lv-section">
          <Reveal><Label>QUESTIONS</Label></Reveal>
          <Reveal delay={80}>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, marginBottom: 48, letterSpacing: "-0.02em" }}>
              Straight answers.
            </h2>
          </Reveal>

          {[
            {
              q: "What exactly does LocalVector do?",
              a: "LocalVector monitors what AI models (ChatGPT, Gemini, Perplexity) say about your business. When they get something wrong — wrong hours, wrong prices, \"permanently closed\" when you're open — we detect it, alert you, and give you the tools to fix it.",
            },
            {
              q: "How is this different from Yelp or Google Business Profile?",
              a: "Yelp and GBP manage your listings on their specific platforms. LocalVector monitors what AI engines synthesize from ALL sources. AI combines data from Yelp, TripAdvisor, Reddit, food blogs, and more. If any source is wrong, AI will be wrong. We catch errors across the entire AI ecosystem.",
            },
            {
              q: "I'm not a tech person. Can I actually use this?",
              a: "Yes. Sign up, enter your business details, and monitoring starts automatically. When something is wrong, you get a plain-English alert. Fixing it is one click. The whole product was built by a restaurant owner who also runs a lounge in Alpharetta, GA.",
            },
            {
              q: "What if AI isn't saying anything wrong about me?",
              a: "Then your dashboard shows \"All Clear\" and your Reality Score. But AI models update constantly — a clean audit today doesn't guarantee next month. We keep watching so you don't have to.",
            },
            {
              q: "Do I need to cancel my BrightLocal or Yext?",
              a: "No. Those tools manage directory listings, which is still useful. LocalVector monitors and optimizes for AI answers — a layer those tools don't touch. Many customers use both.",
            },
          ].map((faq, i) => (
            <FAQ key={i} q={faq.q} a={faq.a} delay={i * 80} />
          ))}
        </div>
      </section>

      {/* ══════ FINAL CTA ══════ */}
      <section style={{
        position: "relative", overflow: "hidden",
        background: `linear-gradient(180deg, ${T.navy} 0%, ${T.navyLight} 100%)`,
      }}>
        {/* Radial glow */}
        <div style={{
          position: "absolute", top: "50%", left: "50%", width: 600, height: 600,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, rgba(0,245,160,0.06) 0%, transparent 70%)`,
          animation: "lv-float 6s ease-in-out infinite",
        }} />

        <div className="lv-section" style={{ position: "relative", textAlign: "center" }}>
          <Reveal>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 16, letterSpacing: "-0.03em" }}>
              Right now, AI is describing your business to someone.<br />
              <span style={{ color: T.green }}>Is it telling the truth?</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p style={{ color: T.gray400, fontSize: 16, marginBottom: 36 }}>
              Find out in 8 seconds. No signup required.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div style={{ maxWidth: 520, margin: "0 auto" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <input
                  placeholder="Enter your business name or URL"
                  style={{
                    flex: 1, padding: "14px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.04)", color: T.white, fontSize: 15,
                    fontFamily: "'Outfit', sans-serif", outline: "none",
                    transition: "border-color 0.25s",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(0,245,160,0.3)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                />
                <button className="lv-btn-green" style={{ whiteSpace: "nowrap", padding: "14px 28px", fontSize: 15 }}>
                  Run Free Audit →
                </button>
              </div>
              <p style={{ fontSize: 12, color: T.gray600, fontFamily: "'JetBrains Mono', monospace" }}>
                Free · Instant · Real results from real AI models
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer style={{ borderTop: `1px solid rgba(255,255,255,0.05)`, padding: "40px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>LocalVector<span style={{ color: T.green }}>.ai</span></span>
            <p style={{ fontSize: 12, color: T.gray600, marginTop: 4 }}>Defending the truth for local business. Built for the Generative Age.</p>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 12, color: T.gray600 }}>
            <span>Privacy</span>
            <span>Terms</span>
            <span>Log In</span>
          </div>
        </div>
        <div style={{ maxWidth: 1120, margin: "20px auto 0", textAlign: "center" }}>
          <p style={{ fontSize: 11, color: T.gray700 }}>© 2026 LocalVector.ai</p>
        </div>
      </footer>
    </div>
  );
}

// ─── FAQ Accordion Component ─────────────────────────────────────
function FAQ({ q, a, delay = 0 }) {
  const [open, setOpen] = useState(false);
  const [ref, visible] = useReveal(0.15);

  return (
    <div
      ref={ref}
      style={{
        borderBottom: `1px solid rgba(255,255,255,0.05)`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 0", background: "none", border: "none", cursor: "pointer",
          fontFamily: "'Outfit', sans-serif", textAlign: "left",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: T.white, paddingRight: 20 }}>{q}</span>
        <span style={{
          color: T.green, fontSize: 20, flexShrink: 0, transition: "transform 0.3s",
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
        }}>
          +
        </span>
      </button>
      <div style={{
        maxHeight: open ? 300 : 0, overflow: "hidden",
        transition: "max-height 0.4s cubic-bezier(.16,1,.3,1), opacity 0.3s",
        opacity: open ? 1 : 0,
      }}>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: T.gray400, paddingBottom: 20, maxWidth: 680 }}>{a}</p>
      </div>
    </div>
  );
}
