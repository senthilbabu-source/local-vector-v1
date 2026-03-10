# LocalVector.ai — Claude Code Project Memory

> Read this file completely before writing any code, running any command, or making any architectural decision.
> This file is the single source of truth for development rules on this project.

---

## 1. Project Overview

**LocalVector.ai** is a two-product SaaS platform that monitors and corrects how AI search engines (ChatGPT, Gemini, Perplexity, Claude, Copilot) represent local businesses.

- **Business Owner product** — Single-location dashboard, $99–$299/mo, monitors AI hallucinations about their business
- **Agency product** — Multi-client dashboard, $499–$999/mo, manages hallucination monitoring for client portfolios

**Stack:** Next.js 15/16 App Router · TypeScript · Supabase (PostgreSQL + RLS) · Tailwind v4 · shadcn/ui · Stripe · Inngest · Resend · Cloudflare Turnstile

---

## 2. Specification Documents — READ BEFORE CODING

All specs live in `docs/`. **Always read the relevant spec before writing any code for that domain.** These are the authoritative source — not your training data.

| Document | Path | When to Read |
|---|---|---|
| Business Owner Dashboard | `docs/BUSINESS_OWNER_DASHBOARD_SPEC.md` | Any dashboard UI, data, or API for business owners |
| Agency Dashboard | `docs/AGENCY_DASHBOARD_DELTA_SPEC.md` | Any agency-facing feature, multi-client UI |
| Marketing Site | `docs/MARKETING_SITE_REDESIGN_SPEC.md` | Any change to `app/(marketing)/` |
| Stripe & Billing | `docs/STRIPE_BILLING_SPEC.md` | Subscriptions, webhooks, plan gating, checkout |
| GBP OAuth | `docs/GBP_OAUTH_SPEC.md` | Google Business Profile connection, token management, sync |
| API Routes | `docs/API_ROUTES_SPEC.md` | All `/api/` route handlers, error codes, rate limits |
| Design System | `docs/DESIGN_SYSTEM_SPEC.md` | Every UI component, token, animation, or style decision |
| Design System (Colors/Fonts) | `docs/DESIGN-SYSTEM.md` | Colors, fonts, animations, and rules |
| Design System (Components) | `docs/DESIGN-SYSTEM-COMPONENTS.md` | Full component JSX when building new UI |
| Onboarding Flow | `docs/ONBOARDING_FLOW_SPEC.md` | Registration, wizard steps, email verification, first audit |
| Engineering Rules | `docs/AI_RULES.md` | Engineering rules (§1–§327) covering auth, DB, validation, security, performance |
| Build History | `docs/DEVLOG.md` | Build history — **log every change here** |
| Architecture | `docs/ARCHITECTURE.md` | System architecture, tech stack, directory structure |

**How to read them:** Use the Read tool on the specific file at the start of your first response, before any implementation. Do not summarise from memory — read the actual file.

**Onboarding reading order** (if new to codebase): CLAUDE.md → `docs/ARCHITECTURE.md` → the spec for your current area → `docs/AI_RULES.md` (on demand).

---

## 3. Architecture Non-Negotiables

These rules must never be violated. They exist to prevent security holes, data corruption, and billing bugs.

### Authentication & Authorization
- **`orgId` is ALWAYS derived server-side** from `getSafeAuthContext()`. Never trust a client-supplied `orgId`, `org_id` header, or query parameter.
- All DB queries for org-scoped data must include `.eq('org_id', ctx.orgId)` as a belt-and-suspenders guard even when RLS covers it.
- Use `createClient()` (user-scoped) for normal queries. Use `createServiceRoleClient()` only when RLS must be bypassed (e.g., `completeOnboarding`, service-level token access). Document why at the call site.
- **Admin guards:** Use `requireAdmin()` in Server Actions, `requireAdminAPI()` in API routes. See `lib/admin.ts`.

### Plan Gating
- **`resolvePlanContext()` is always called server-side**, never from a client component.
- Plan capabilities come from the DB (`organizations.plan_tier`), never from client-supplied headers, cookies, or query params.
- Capability checks use `PLAN_CAPABILITIES[planTier]` from `lib/stripe/plans.ts`. Never hard-code tier comparisons like `if (plan === 'agency_pro')`.

### Billing (Stripe)
- **Never update the DB from an upgrade/checkout route.** Always wait for the webhook (`customer.subscription.updated`). The webhook is the canonical source of plan state.
- Webhooks must verify signature first, return 200 even on handler errors (log to Sentry), and check `billing_events.stripe_event_id` for idempotency before any DB mutation.
- Stripe Subscription Schedules are used for downgrades (end-of-period). Never cancel and re-create a subscription for a downgrade.

### GBP / OAuth
- Access tokens are AES-256-GCM encrypted at rest. **Never log, expose in API responses, or store in plaintext.** The `access_token_enc` column is never read by client code — only by server-side service-role functions.
- Token refresh uses a PostgreSQL advisory lock (`pg_try_advisory_lock`) to prevent race conditions. Never refresh without this lock.
- `business.manage` scope requires Google OAuth app verification (1–4 week process). **This is a launch blocker** — do not launch to >100 users without completing it.

### Design System
- **No hex values in TSX files.** All colours must reference CSS custom properties (`var(--m-green)`, `var(--color-signal-green)`) or Tailwind token aliases.
- `var(--m-*)` tokens are only valid inside `.lv-marketing` scope. Never use them in dashboard components.
- All new CSS animations must have a corresponding `@media (prefers-reduced-motion: reduce)` override in `globals.css`.
- All keyframes are defined in `app/globals.css` only. Never define them in component files.
- Do not reimplement shadcn/ui primitives (Dialog, Input, Button, etc.) from scratch.

---

## 4. File & Folder Conventions

```
app/
  (marketing)/          ← Marketing site. Uses .lv-marketing scope + m-* tokens.
  (auth)/               ← Login, register, verify-email. Minimal layout.
  dashboard/            ← Business Owner dashboard. Dark theme, lv-* tokens.
  onboarding/           ← 5-step wizard. Dark theme.
  admin/                ← Internal admin panel.
  api/
    public/             ← No auth required (scan endpoints, webhooks)
    owner/              ← Authenticated business owner API
    agency/             ← Authenticated agency API
    billing/            ← Stripe checkout, portal, verify-session
    webhooks/           ← stripe/, twilio/ — signature-verified only
    admin/              ← Admin-role gated
    cron/               ← Cron jobs as Route Handlers. No Supabase Edge Functions.
lib/
  supabase/             ← client.ts, server.ts, middleware.ts
  stripe/               ← plans.ts (PLAN_CAPABILITIES), seat-manager.ts
  inngest/              ← client.ts, functions/
  email/                ← Resend send-* helpers
  gbp/                  ← GBP data mapper, token refresh
  services/             ← Domain service files
  schemas/              ← Zod schemas
docs/                   ← All specification documents (read-only reference)
```

**Never create files in `docs/`** — those are spec documents, not application code.

**Middleware:** The middleware file is `proxy.ts` at project root (not `middleware.ts`). This is the Next.js 16 convention.

---

## 5. TypeScript Standards

- Zod validates **all** external input (API route bodies, Server Action args, webhook payloads). Never trust raw `req.body` or `formData` without Zod.
- API responses use the standard envelope: `{ data: T }` for success, `{ error: ErrorCode; message: string }` for failure. `ErrorCode` values are `SCREAMING_SNAKE_CASE` constants from the `ApiErrorCode` union in `docs/API_ROUTES_SPEC.md`.
- Use `type` not `interface` for data shapes unless you need declaration merging.
- Use `unknown` not `any`. Cast only after validation.
- Server Components are `async` functions with no `'use client'` directive. Client Components must declare `'use client'` at the top.

---

## 6. Database Conventions

- **Schema authority:** Read `supabase/prod_schema.sql` for tables, RLS, enums — not markdown docs. The SQL file is the source of truth.
- All DB mutations in Server Actions use the **user-scoped** Supabase client except where documented.
- Every INSERT/UPDATE/DELETE includes an `org_id` filter. No exceptions.
- JSONB columns (`hours_data`, `amenities`, `user_overrides`) use the canonical types from `lib/types/ground-truth.ts`. Never write raw JSONB without validating against these types first.
- Migrations go in `supabase/migrations/` with the naming format `YYYYMMDDHHMMSS_description.sql`.
- RLS policies exist on all user-data tables. Adding a new table requires adding RLS policies before the migration is merged.

---

## 7. Testing Standards

- Write a failing test before fixing a bug.
- Unit tests for Server Actions, service functions, and Zod schemas go in `tests/unit/`.
- E2E tests (Playwright) go in `tests/` with descriptive filenames matching the feature.
- Use MSW for mocking external APIs (Stripe, Google OAuth, GBP API) in tests. Mock handlers are in `tests/mocks/`.
- Golden tenant fixtures live in `src/__fixtures__/golden-tenant.ts`. Use these for consistent test data.
- Never use `any` in test files. Type your mocks.

---

## 8. What NOT to Do

- Do not use `next/headers` cookies to store sensitive auth state — use Supabase session cookies.
- Do not call Stripe API in a client component. All Stripe calls are server-side.
- Do not call `supabase.auth.getUser()` in a Server Component — use `getSafeAuthContext()` which wraps it correctly for the App Router.
- Do not add `console.log` with user data, tokens, or PII. Use `Sentry.captureException()` for errors.
- Do not modify `app/globals.css` token values without also updating `docs/DESIGN_SYSTEM_SPEC.md`.
- Do not add a new `/api/` route without adding it to `docs/API_ROUTES_SPEC.md`.

---

## 9. Sprint Workflow

**Sprint prompt pattern:** READ specs → define SCOPE → enforce RULES → start with TESTS.

When starting a sprint:
1. Read the relevant spec document(s) fully using the Read tool
2. Ask clarifying questions if requirements are ambiguous — do not assume
3. Create a todo list with specific, testable tasks
4. Write failing tests first for any new Server Actions or API routes
5. Implement the feature
6. **Log every change to `docs/DEVLOG.md`** with the sprint/section number
7. Verify against the spec's Acceptance Criteria section before marking done

---

## 10. Key Commands

```bash
npm run dev          # Start dev server (Next.js)
npm run build        # Production build (run before PR)
npm run lint         # ESLint check
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests
npx playwright test  # E2E tests
npx supabase db push # Apply pending migrations
```

Always run `npm run typecheck && npm run lint` before considering any task complete.

---

## 11. Session Management

- **Mid-sprint drift:** Run `/compact Focus on [current task], preserve modified files list`
- **Switching tasks:** Run `/clear` — fresh session beats polluted context
- **Spec contradiction:** Re-read the actual spec file section, do not rely on memory
- **New day, same sprint:** Re-state the sprint scope — CLAUDE.md loads automatically but sprint context does not persist
