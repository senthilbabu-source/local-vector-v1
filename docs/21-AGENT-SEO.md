# 21-AGENT-SEO.md — Agent-SEO Action Readiness Spec
## Sprint 126

### Problem
Sprint 84 measures whether AI can access business *information* (hours, menu, location).
Sprint 126 measures whether AI agents can take *actions* — book, order, schedule.

### 5 Audit Dimensions

| ID | Jargon-free label | Schema type | Points |
|----|-------------------|-------------|--------|
| reserve_action | Reservation Booking | ReserveAction | 25 |
| order_action | Online Ordering | OrderAction | 25 |
| booking_cta | Visible Booking Button | n/a | 20 |
| booking_crawlable | Booking Link Accessible | n/a | 20 |
| appointment_action | Appointment Scheduling | MedicalAppointment/BuyAction | 10 |

### Scoring
- agent_action_ready: >= 80 pts
- partially_actionable: >= 40 pts
- not_actionable: < 40 pts

### Audit methodology
- Fetch homepage with standard User-Agent. Parse JSON-LD blocks. Read magic_menus schema.
- READ-ONLY. Never submit forms. Never execute JS. Never follow > 1 redirect.
- Check booking CTA accessibility in `<a>`/`<button>` text and aria-label attributes.
- Booking URL safety: HTTPS required; /login /signin path -> needs-login flag.

### UI rules (jargon-free)
- "ReserveAction" -> "Reservation Booking" everywhere in UI
- "JSON-LD" -> never shown in UI
- "OrderAction" -> "Online Ordering"
- "MedicalAppointment" -> "Appointment Scheduling"

### Content brief integration
Missing capability -> "Generate Schema" button -> Sprint 126 schema generator

### Cache strategy
Results cached on `locations.agent_seo_cache` (JSONB) + `locations.agent_seo_audited_at`.
Weekly cron (Monday 8 AM UTC) populates cache. Never audit on page request.
