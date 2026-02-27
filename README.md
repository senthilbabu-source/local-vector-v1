# LocalVector.ai

[![CI](https://github.com/senthilbabu-source/local-vector-v1/actions/workflows/test.yml/badge.svg)](https://github.com/senthilbabu-source/local-vector-v1/actions/workflows/test.yml)

AI visibility monitoring platform for local restaurants — detects and fixes hallucinations across ChatGPT, Perplexity, Gemini, and other AI search engines.

## What It Does

LocalVector continuously scans major AI engines to detect what they say about your restaurant,
then scores the accuracy and alerts you when something is wrong. The core loop is:
**Scan → Detect Hallucinations → Score → Alert → Fix → Monitor**.
When an AI engine tells customers your restaurant is closed on Tuesdays (when it isn't)
or invents menu items that don't exist, LocalVector catches it and helps you fix it
before you lose revenue.

The platform is powered by several specialized engines:

- **Fear Engine** — Detects hallucinations across AI search results and tracks their severity.
- **Greed Engine** — Monitors competitors and identifies intercept opportunities where rivals are winning AI visibility.
- **SOV Engine** (Share of Voice) — Tracks how often your business is recommended across AI models for relevant queries.
- **Autopilot Engine** — Generates AI-optimized content drafts to close visibility gaps, with a strict human-in-the-loop approval workflow before anything is published.
- **Occasion Engine** — Surfaces seasonal and event-based content opportunities.
- **Citation Intelligence** — Tracks which platforms AI engines actually cite as sources.
- **Content Grader** — Audits web pages for AEO (Answer Engine Optimization) readiness across five scoring dimensions.

The **Revenue Leak Scorecard** translates AI inaccuracies into estimated dollar impact,
making it clear what hallucinations cost your business. LocalVector also exposes an
**MCP server** so any MCP-compatible AI assistant can query your visibility data directly.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | Supabase (PostgreSQL) with Row Level Security via `current_user_org_id()` |
| AI | Vercel AI SDK (`ai` package) — OpenAI GPT-4o, Perplexity Sonar, Anthropic Claude, Google Gemini |
| Job Queue | Inngest (event-driven fan-out for cron pipelines) |
| Billing | Stripe (webhooks → `plan_tier` enum) |
| Email | Resend + React Email |
| Cache | Upstash Redis (optional, graceful degradation) |
| Testing | Vitest (61 unit/integration test files), Playwright (18 E2E specs) |
| Monitoring | Sentry (client, server, edge) |
| Styling | Tailwind CSS v4, Tremor Raw charts, Recharts |

## Project Structure

```
app/api/cron/              — Automated pipelines (sov, audit, content-audit)
app/(auth)/                — Auth pages (login, register, forgot-password)
app/dashboard/             — Authenticated dashboard pages
app/_sections/             — Landing page sections (code-split)
app/m/                     — Public Magic Menu pages (edge cached)
lib/ai/                    — AI provider config, schemas, server actions
lib/services/              — Pure business logic (no side effects)
lib/autopilot/             — Content draft generation and publish pipeline
lib/inngest/               — Inngest job queue functions
lib/mcp/                   — MCP server tool registrations
components/                — Shared UI components (layout, tremor, ui)
supabase/migrations/       — Applied SQL migrations (20, timestamp-ordered)
supabase/prod_schema.sql   — Authoritative production schema
docs/                      — 50 spec documents (architecture, API contracts, UX)
src/__tests__/             — Unit + integration tests (Vitest)
tests/e2e/                 — Playwright E2E specs
```

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- A Supabase project (local or hosted)

### Setup

1. Clone the repo:
   ```bash
   git clone <repo-url>
   cd local-vector-v1
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template and fill in values:
   ```bash
   cp .env.local.example .env.local
   ```
   See the [Environment Variables](#environment-variables) section below for details on each variable.

4. Start local Supabase (or configure a hosted Supabase URL in `.env.local`):
   ```bash
   npx supabase start
   ```

5. Apply all migrations and seed test data:
   ```bash
   npx supabase db reset
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

See `.env.local.example` for the full manifest with inline comments.
Below is a summary grouped by service.

### Required

| Category | Variables | Notes |
|----------|-----------|-------|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Service role key is server-only — never expose to client |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Powers billing and plan tier management |
| Inngest | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Required for job queue (cron pipelines) |
| Cron | `CRON_SECRET` | Bearer token for cron route authentication |

### Optional

| Category | Variables | Notes |
|----------|-----------|-------|
| AI Providers | `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | Services fall back to mock/demo mode when absent |
| Resend | `RESEND_API_KEY` | Email delivery (weekly digests, alerts) |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Needed for Google Business Profile integration |
| Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | All callers degrade gracefully when unavailable |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Error monitoring and performance tracking |
| MCP | `MCP_API_KEY` | Bearer token for MCP endpoint; fails closed when absent |
| Kill Switches | `STOP_GOOGLE_REFRESH` | Set to `true` to instantly halt Google API spending |

## Scripts

```bash
npm run dev               # Start development server
npm run build             # Production build
npm run start             # Start production server
npm test                  # Run all Vitest tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:coverage     # Tests with coverage report
npx playwright test       # Run E2E tests
```

## Database

- **Schema authority:** `supabase/prod_schema.sql` is the canonical schema.
  Markdown docs like `docs/03-DATABASE-SCHEMA.md` are conceptual references — the SQL file is the source of truth.
- **Migrations:** 20 migrations in `supabase/migrations/`, applied in timestamp order.
  Each migration is idempotent and uses `IF NOT EXISTS` / `IF EXISTS` guards where appropriate.
- **Seed data:** `supabase/seed.sql` provides realistic test data for local development,
  including organizations, locations, menu items, hallucinations, and SOV evaluations.
- **Reset:** `npx supabase db reset` drops and recreates the database,
  applies all migrations, and runs the seed script in one step.
- **RLS pattern:** Every tenant-scoped table uses
  `org_id = public.current_user_org_id()` policies.
  Organization isolation is enforced at the database level — never rely on application-layer filtering alone.

## Architecture Notes

- **Services are pure.** Files in `lib/services/` never create their own Supabase client —
  callers inject one. This lets the same service work with RLS-scoped clients (user actions)
  and service-role clients (cron routes).

- **Plan gating** lives in `lib/plan-enforcer.ts`. Four tiers: `trial`, `starter`, `growth`, `agency`.
  Always use enforcer helpers — never inline tier checks.

- **AI providers are centralized** in `lib/ai/providers.ts`. Never call AI APIs directly —
  use `getModel(key)`. Mock fallbacks activate when API keys are absent, enabling local
  development without paid API credentials.

- **Middleware** lives in `proxy.ts` at the project root (not `middleware.ts`).
  Handles subdomain routing (app vs. menu vs. marketing) and auth session management.

- **Cron routes** in `app/api/cron/` require `Authorization: Bearer <CRON_SECRET>`.
  Each has a kill switch env var. Execution is logged to the `cron_run_log` table
  for health monitoring.

- **Server Actions** use `getSafeAuthContext()` (returns null on failure, never throws).
  Organization ID is always derived server-side — never accepted from the client.

## Documentation

The `docs/` directory contains 50 spec documents covering architecture, API contracts,
UX specifications, and build plans. Key documents:

| Document | Description |
|----------|-------------|
| `docs/00-INDEX.md` | Master index of all spec documents |
| `docs/03-DATABASE-SCHEMA.md` | Schema reference (conceptual; `prod_schema.sql` is authoritative) |
| `docs/05-API-CONTRACT.md` | API endpoint contracts |
| `docs/06-FRONTEND-UX-SPEC.md` | UI/UX specification |
| `docs/09-BUILD-PLAN.md` | Sprint-by-sprint build plan |
| `docs/AI_RULES.md` | AI agent coding rules (34 rules with edge cases) |

For full project context used by AI assistants, see `docs/CLAUDE.md`.

## License

Private / Proprietary. Not open source.
