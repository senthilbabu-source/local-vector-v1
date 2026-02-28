# Sprint F — Engagement & Retention: On-Demand AI Preview, Correction Follow-Up & Benchmark Comparison

> **Claude Code Prompt — Bulletproof Edition**
> Paste this entire prompt into VS Code Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`, `golden-tenant.ts`, `database.types.ts`, `MEMORY.md`
> **Prerequisites:** Sprints A, B, C, D, and E must be fully merged and all their tests passing before starting Sprint F.

---

## 🎯 Objective

Sprint F is the final sprint in the February 2026 code analysis resolution series. Every critical, high, medium, and low finding has been addressed across Sprints A–E. Sprint F delivers the three engagement and retention features that turn a useful product into a sticky one.

1. **N2 — On-Demand AI Answer Preview** — The most viscerally compelling feature in the product. Today, users wait until Sunday's cron to see what AI models say about their business. This sprint adds a widget where they can type any query and see live responses from ChatGPT, Perplexity, and Gemini in under 10 seconds. This is different from the stored `ai-responses` page — it's on-demand, interactive, and immediately demonstrable in a sales conversation. Credit-gated (1 credit per query run) using the Sprint D credits infrastructure.

2. **N3 — Correction Follow-Up ("Did It Work?" Loop)** — When a user generates a correction brief, the hallucination status moves to `verifying`. Nothing happens after that. There is no automated check to see if the AI model updated its answer. Users never know if their correction worked — the loop is never closed. This sprint adds a targeted follow-up scan cron that runs 2 weeks after each correction brief is generated, checks the same query against the same model, and updates the alert status to `resolved` or `still_hallucinating`. The UI in `CorrectionPanel.tsx` surfaces the result.

3. **N4 — Benchmark Comparison ("You vs. City Average")** — Once 10 or more businesses of the same industry in the same city are on LocalVector, each customer can see how their Reality Score compares to the anonymized average. Below average → motivation to fix issues. Above average → pride and retention. This sprint builds the data collection pipeline (a weekly benchmark cron that computes city+industry averages) and the display layer (a `BenchmarkComparisonCard` on the dashboard that renders when the 10-org threshold is met and shows a placeholder when it isn't). The data is collected starting now — the display will be meaningful as soon as the customer base grows.

**Why this sprint last:** N2 requires the credits infrastructure from Sprint D. N3 builds directly on the correction workflow established in earlier sprints. N4's benchmark data is only meaningful after customer acquisition begins — which Sprints D and E enabled by securing unit economics and opening the medical vertical. This is the right order.

**Estimated total implementation time:** 28–36 hours. N2 is the most complex (12–15 hours) due to multi-model streaming and credit integration. N3 is 8–10 hours (new cron + DB state machine). N4 is 8–10 hours (aggregation cron + card + threshold logic).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

Before writing ANY code, read these files in order. Do not skip any.

```
Read docs/AI_RULES.md                                          — Rules 42–54 from Sprints A–E now in effect
Read CLAUDE.md                                                 — Sprint A–E implementation inventory
Read MEMORY.md                                                 — All architecture decisions through Sprint E
Read supabase/prod_schema.sql                                  — Canonical schema — read fully before any migration
Read lib/supabase/database.types.ts                            — TypeScript DB types (updated through Sprint E)
Read src/__fixtures__/golden-tenant.ts                         — Full fixture (Sprints D+E artifacts present)

--- N2: AI Answer Preview ---
Read app/dashboard/ai-responses/page.tsx                       — Partial foundation: understand how stored responses are displayed
Read app/dashboard/ai-responses/                               — All components; data shapes fetched from DB
Read app/dashboard/ai-assistant/                               — General-purpose chat interface — understand its API call pattern
Read lib/credits/credit-service.ts                             — Sprint D: checkCredit(), consumeCredit() — N2 uses these
Read lib/credits/credit-limits.ts                             — PLAN_CREDIT_LIMITS — verify preview costs 1 credit
Read app/dashboard/_components/TopBar.tsx                      — Sprint D: credits meter location
Read .env.example                                              — Find OPENAI_API_KEY, PERPLEXITY_API_KEY, GOOGLE_API_KEY (or GEMINI_API_KEY)
Read package.json                                              — Find installed AI SDK packages (openai, @google/generative-ai, etc.)

--- N3: Correction Follow-Up ---
Read app/dashboard/_components/CorrectionPanel.tsx             — COMPLETE FILE. How correction briefs are generated; status flow
Read lib/services/correction-generator.service.ts             — How correction briefs are created; what DB writes happen
Read app/api/cron/                                             — ls this directory; understand existing cron route patterns
Read supabase/prod_schema.sql                                  — Find hallucination_alerts table: columns, status enum values
Read app/api/cron/sov/route.ts                                 — Reference for cron auth pattern, Sentry logging, cron_run_log writes
Read lib/services/cron-logger.ts                               — Sprint C artifact: use logCronStart/Success/Failure

--- N4: Benchmark Comparison ---
Read supabase/prod_schema.sql                                  — Find orgs table (industry, city columns), ai_scores table
Read lib/industries/industry-config.ts                         — Sprint E: INDUSTRY_CONFIG; industry IDs
Read app/dashboard/page.tsx                                    — Dashboard page: where BenchmarkComparisonCard will be added
Read app/dashboard/_components/                                — Existing card components: understand the visual pattern
Read components/ui/InfoTooltip.tsx                             — Sprint B: reuse InfoTooltip in the benchmark card
Read lib/sample-data/sample-dashboard-data.ts                  — Sprint B: understand SAMPLE_* pattern for benchmark placeholder
```

**Specifically understand before writing code:**

- **AI SDK pattern for N2:** Read `package.json` to find which AI SDKs are installed (`openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `@perplexity-ai/sdk`, or the generic `ai` package from Vercel). Do NOT install a new SDK if a usable one exists. Read any existing AI call in `ai-assistant/` to understand the exact call pattern, response shape, and streaming approach used in the codebase.

- **N2 credit cost:** The AI Answer Preview fires 3 API calls (one per model) in a single user action. Decide: does it cost 1 credit (for the composite query) or 3 credits (one per model call)? The report says "on-demand query" implying one user action = one credit. Use 1 credit per preview run. Document this in AI_RULES.

- **N3 hallucination alert status state machine:** Read `hallucination_alerts` table carefully. The status values (`open`, `verifying`, `resolved`, `still_hallucinating`, or whatever they actually are) determine the follow-up cron's logic. Do NOT assume status names — read `prod_schema.sql` and any existing status transitions in `CorrectionPanel.tsx`. The follow-up cron must only process alerts in `verifying` status that were moved there at least 14 days ago.

- **N3 targeted re-query approach:** The follow-up scan doesn't run a full SOV scan. It runs a single query against a single AI model — the same query that originally found the hallucination — and checks if the wrong information is still present. Read `correction-generator.service.ts` to understand what data is stored about the original hallucination: the query text, the model, the wrong information. The re-query needs all three.

- **N4 10-org threshold:** The benchmark card has two states — "collecting data" (fewer than 10 orgs in city+industry) and "comparison ready." Both states must render. The "collecting data" state should be helpful, not a dead end: show the current org's score, explain the benchmark, and show progress toward the threshold (e.g., "4 of 10 businesses needed in Alpharetta").

- **N4 anonymization:** Benchmark averages must never reveal individual org names or scores. The aggregation query computes `AVG(reality_score)`, `MIN(reality_score)`, `MAX(reality_score)`, and `COUNT(*)` for a city+industry combination. No org-level data is exposed. Read the RLS policies on `ai_scores` and `orgs` to confirm the aggregation query runs at service-role level only.

- **N4 `benchmarks` table vs. real-time aggregation:** Pre-computing benchmarks weekly (storing results in a `benchmarks` table) is the correct approach. Real-time aggregation on every dashboard load would be slow and expensive. The weekly cron stores the aggregate; the dashboard reads from `benchmarks`. Read timing conventions used in the SOV cron (`app/api/cron/sov/route.ts`) for the cron auth header pattern.

---

## 🏗️ Architecture — What to Build

---

### Feature N2: On-Demand AI Answer Preview

**The product moment this creates:** A new user opens LocalVector, types "best hookah lounge in Alpharetta" into the AI Answer Preview widget, and within 8 seconds sees exactly what ChatGPT, Perplexity, and Gemini say about their business. This is the product's most powerful live demo moment — more compelling than any static screenshot or chart. It makes the hallucination problem *visceral* instead of *abstract*.

#### Step 1: API route — `app/api/ai-preview/route.ts`

A server-side streaming endpoint that accepts a query and org context, fires 3 model calls in parallel, and streams results back. This must be a Route Handler, not a Server Action, because it streams.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkCredit, consumeCredit } from '@/lib/credits/credit-service';
import * as Sentry from '@sentry/nextjs';

/**
 * POST /api/ai-preview
 *
 * Body: { query: string }
 *
 * Requires: authenticated user with org context
 * Credit cost: 1 credit per call (regardless of how many models respond)
 * Rate-aware: if models respond at different speeds, results are streamed as each arrives
 *
 * Response: Server-Sent Events (SSE) stream
 * Each event: { model: string, status: 'streaming'|'complete'|'error', content: string }
 */
export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 2. Get org ID
  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single();
  if (!member?.org_id) return NextResponse.json({ error: 'no_org' }, { status: 403 });

  // 3. Credit check — BEFORE calling any model
  const credit = await checkCredit(member.org_id);
  if (!credit.ok) {
    return NextResponse.json(
      { error: 'credit_limit_reached', creditsUsed: (credit as any).creditsUsed, creditsLimit: (credit as any).creditsLimit },
      { status: 402 }
    );
  }

  // 4. Validate query
  const { query } = await req.json();
  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  if (query.trim().length > 200) {
    return NextResponse.json({ error: 'query_too_long', maxLength: 200 }, { status: 400 });
  }

  // 5. Get org business context for system prompt
  const { data: org } = await supabase
    .from('orgs')
    .select('name, industry')
    .eq('id', member.org_id)
    .single();

  const businessContext = org
    ? `The user's business is "${org.name}". When they ask about queries, they want to know if and how AI models mention their business.`
    : '';

  // 6. Stream SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // Fire all 3 model calls in parallel — results arrive as each completes
        await Promise.allSettled([
          queryOpenAI(query, businessContext).then(result => send({ model: 'chatgpt', ...result })),
          queryPerplexity(query, businessContext).then(result => send({ model: 'perplexity', ...result })),
          queryGemini(query, businessContext).then(result => send({ model: 'gemini', ...result })),
        ]);

        // 7. Consume 1 credit after all models have responded
        await consumeCredit(member.org_id);

        send({ type: 'done' });
      } catch (err) {
        Sentry.captureException(err, {
          tags: { route: 'ai-preview', sprint: 'F' },
          extra: { orgId: member.org_id, queryLength: query.length },
        });
        send({ type: 'error', message: 'Preview unavailable — please try again' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### Step 2: Model query functions — `lib/ai-preview/model-queries.ts`

Server-only. Three functions, each wrapping one AI SDK. Read `package.json` first to determine which SDKs are available — adapt the implementation to what's installed.

```typescript
/**
 * lib/ai-preview/model-queries.ts — server only
 *
 * Three functions that each query one AI model with the given search query.
 * Each returns { status: 'complete' | 'error', content: string }.
 *
 * IMPORTANT: Read the existing AI call patterns in app/dashboard/ai-assistant/
 * before implementing. Match the SDK import and call style already in use.
 *
 * These are NOT streaming internally — they return the full response after completion.
 * The streaming to the client happens in the route handler as each Promise resolves.
 */

interface ModelResult {
  status: 'complete' | 'error';
  content: string;
}

const SYSTEM_CONTEXT = (businessContext: string) => `
You are answering a local search query. Answer naturally and concisely as you would for a real user.
${businessContext}
Limit your answer to 150 words maximum. Be factual and specific.
`.trim();

export async function queryOpenAI(query: string, businessContext: string): Promise<ModelResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { status: 'error', content: 'OpenAI not configured' };
  }
  try {
    // Use the openai SDK if installed; adapt if using Vercel AI SDK
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',          // Cost-efficient; upgrade to gpt-4o if needed
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_CONTEXT(businessContext) },
        { role: 'user',   content: query },
      ],
    });
    return {
      status: 'complete',
      content: response.choices[0]?.message?.content ?? '(No response)',
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { model: 'chatgpt', sprint: 'F' } });
    return { status: 'error', content: 'ChatGPT is temporarily unavailable' };
  }
}

export async function queryPerplexity(query: string, businessContext: string): Promise<ModelResult> {
  if (!process.env.PERPLEXITY_API_KEY) {
    return { status: 'error', content: 'Perplexity not configured' };
  }
  try {
    // Perplexity uses OpenAI-compatible API — check if the existing codebase uses openai SDK pointed at Perplexity's base URL
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    });
    const response = await client.chat.completions.create({
      model: 'llama-3.1-sonar-small-128k-online',   // Perplexity's grounded model; verify model name in their docs
      max_tokens: 300,
      messages: [
        { role: 'system', content: SYSTEM_CONTEXT(businessContext) },
        { role: 'user',   content: query },
      ],
    });
    return {
      status: 'complete',
      content: response.choices[0]?.message?.content ?? '(No response)',
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { model: 'perplexity', sprint: 'F' } });
    return { status: 'error', content: 'Perplexity is temporarily unavailable' };
  }
}

export async function queryGemini(query: string, businessContext: string): Promise<ModelResult> {
  if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
    return { status: 'error', content: 'Gemini not configured' };
  }
  try {
    // Adapt to whichever Google AI SDK is installed: @google/generative-ai or @google-cloud/aiplatform
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? ''
    );
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent([
      SYSTEM_CONTEXT(businessContext),
      query,
    ]);
    return {
      status: 'complete',
      content: result.response.text(),
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { model: 'gemini', sprint: 'F' } });
    return { status: 'error', content: 'Gemini is temporarily unavailable' };
  }
}
```

**Critical SDK note:** Before writing these functions, run:
```bash
cat package.json | grep -E '"openai"|"@google|"perplexity|"ai":'
ls lib/ | grep -iE "openai|gemini|perplexity|ai"
grep -rn "openai\|GoogleGenerativeAI\|perplexity" app/dashboard/ai-assistant/ | head -10
```

Adapt to the exact SDK already installed. Do not install new packages if existing ones work. If a model SDK is absent, return `{ status: 'error', content: '[Model] is not configured in this environment' }` — never crash the whole widget because one model is missing.

#### Step 3: Create the widget — `app/dashboard/ai-responses/_components/AIAnswerPreviewWidget.tsx`

Place inside the `ai-responses` page (the partial foundation that already exists). This is the on-demand companion to the stored responses display.

```tsx
'use client';

/**
 * AIAnswerPreviewWidget — on-demand query → 3 AI model responses
 *
 * Fires a single POST to /api/ai-preview, reads the SSE stream,
 * and updates model response cards as each model completes.
 *
 * Credit cost: 1 credit per run (shown via CreditMeter from Sprint D TopBar).
 * Max query length: 200 characters.
 *
 * Placement: Top of /dashboard/ai-responses page, above stored responses.
 */

const MODELS = ['chatgpt', 'perplexity', 'gemini'] as const;
type ModelId = typeof MODELS[number];

const MODEL_LABELS: Record<ModelId, string> = {
  chatgpt:    'ChatGPT',
  perplexity: 'Perplexity',
  gemini:     'Gemini',
};

const MODEL_COLORS: Record<ModelId, string> = {
  chatgpt:    'border-emerald-200 bg-emerald-50',
  perplexity: 'border-blue-200 bg-blue-50',
  gemini:     'border-violet-200 bg-violet-50',
};

interface ModelState {
  status: 'idle' | 'loading' | 'complete' | 'error';
  content: string;
}

const INITIAL_MODEL_STATE: Record<ModelId, ModelState> = {
  chatgpt:    { status: 'idle', content: '' },
  perplexity: { status: 'idle', content: '' },
  gemini:     { status: 'idle', content: '' },
};

export function AIAnswerPreviewWidget() {
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [models, setModels] = useState<Record<ModelId, ModelState>>(INITIAL_MODEL_STATE);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const charCount = query.length;
  const maxChars = 200;
  const queryValid = query.trim().length >= 3 && charCount <= maxChars;

  async function handleRun() {
    if (!queryValid || running) return;
    setCreditError(null);
    setHasRun(true);
    setRunning(true);

    // Reset all models to loading state
    setModels({
      chatgpt:    { status: 'loading', content: '' },
      perplexity: { status: 'loading', content: '' },
      gemini:     { status: 'loading', content: '' },
    });

    try {
      const res = await fetch('/api/ai-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (res.status === 402) {
        const { creditsUsed, creditsLimit } = await res.json();
        setCreditError(`You've used ${creditsUsed} of ${creditsLimit} credits this month. Upgrade your plan for more.`);
        setModels(INITIAL_MODEL_STATE);
        return;
      }

      if (!res.ok || !res.body) {
        throw new Error(`API error: ${res.status}`);
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'done') break;
            if (event.type === 'error') {
              // Global error — mark all still-loading models as error
              setModels(prev => {
                const next = { ...prev };
                for (const m of MODELS) {
                  if (next[m].status === 'loading') {
                    next[m] = { status: 'error', content: event.message };
                  }
                }
                return next;
              });
              break;
            }

            // Model-specific event
            if (event.model && MODELS.includes(event.model)) {
              setModels(prev => ({
                ...prev,
                [event.model as ModelId]: {
                  status: event.status === 'error' ? 'error' : 'complete',
                  content: event.content ?? '',
                },
              }));
            }
          } catch {
            // Malformed event — skip
          }
        }
      }
    } catch (err) {
      // Network or parse error — mark all loading models as error
      setModels(prev => {
        const next = { ...prev };
        for (const m of MODELS) {
          if (next[m].status === 'loading') {
            next[m] = { status: 'error', content: 'Preview failed — please try again' };
          }
        }
        return next;
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mb-8 rounded-lg border border-border bg-card p-6" data-testid="ai-preview-widget">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">AI Answer Preview</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          See what AI models say about your business right now. Costs 1 credit per run.
        </p>
      </div>

      {/* Query input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRun()}
            placeholder="best hookah lounge in Alpharetta for a birthday party"
            maxLength={maxChars}
            disabled={running}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            data-testid="ai-preview-query-input"
          />
          <span className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums',
            charCount > maxChars - 20 ? 'text-amber-500' : 'text-muted-foreground/40',
          )}>
            {charCount}/{maxChars}
          </span>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={!queryValid || running}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="ai-preview-run-btn"
        >
          {running ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Running…</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5" />Run Preview</>
          )}
        </button>
      </div>

      {/* Credit error */}
      {creditError && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="ai-preview-credit-error">
          <span className="font-medium">Credit limit reached.</span>{' '}
          {creditError}{' '}
          <Link href="/dashboard/billing" className="underline hover:text-amber-900">View plans →</Link>
        </div>
      )}

      {/* Model response cards — only shown after first run */}
      {hasRun && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="ai-preview-results">
          {MODELS.map(modelId => (
            <ModelResponseCard
              key={modelId}
              modelId={modelId}
              label={MODEL_LABELS[modelId]}
              colorClass={MODEL_COLORS[modelId]}
              state={models[modelId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelResponseCard({
  modelId,
  label,
  colorClass,
  state,
}: {
  modelId: ModelId;
  label: string;
  colorClass: string;
  state: ModelState;
}) {
  return (
    <div
      className={cn('rounded-lg border p-4', colorClass)}
      data-testid={`ai-preview-card-${modelId}`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground/70">{label}</p>
      {state.status === 'idle'    && <p className="text-sm text-muted-foreground">—</p>}
      {state.status === 'loading' && (
        <div className="space-y-1.5" aria-label={`${label} loading`}>
          <div className="h-2.5 w-full animate-pulse rounded bg-foreground/10" />
          <div className="h-2.5 w-4/5 animate-pulse rounded bg-foreground/10" />
          <div className="h-2.5 w-3/5 animate-pulse rounded bg-foreground/10" />
        </div>
      )}
      {state.status === 'complete' && (
        <p className="text-sm leading-relaxed text-foreground">{state.content}</p>
      )}
      {state.status === 'error' && (
        <p className="text-sm text-destructive/80">{state.content}</p>
      )}
    </div>
  );
}
```

Import `useState` from `'react'`; `Loader2`, `Sparkles` from `'lucide-react'`; `Link` from `'next/link'`; `cn` from `'@/lib/utils'`. Add `'use client'` at the top.

#### Step 4: Wire into `app/dashboard/ai-responses/page.tsx`

Add `<AIAnswerPreviewWidget />` at the top of the page content, above the stored responses section. Also add the `FirstVisitTooltip` (Sprint E) if not already present:

```tsx
<FirstVisitTooltip
  pageKey="ai-responses"
  title="AI Says — Live & Stored"
  content="The AI Answer Preview at the top lets you run any query right now and see how AI models respond. The stored responses below are captured automatically by LocalVector's weekly scan."
/>
<AIAnswerPreviewWidget />
{/* existing stored responses content below */}
```

---

### Feature N3: Correction Follow-Up ("Did It Work?")

**The state machine:** When a user generates a correction brief, `hallucination_alerts.status` moves to `verifying`. The follow-up cron runs weekly, finds all alerts in `verifying` status where `verifying_since` (or `updated_at`) is at least 14 days ago, re-runs the original query against the original model, and updates status to `resolved` or `still_hallucinating` based on whether the wrong information is still present.

#### Step 1: DB schema additions

Read `prod_schema.sql` — specifically the `hallucination_alerts` table. Determine what columns already exist. You likely need to add:

```sql
-- Sprint F: Correction follow-up tracking on hallucination_alerts
ALTER TABLE public.hallucination_alerts
  ADD COLUMN IF NOT EXISTS correction_query     text,
    -- The query that originally detected this hallucination; used for re-check
  ADD COLUMN IF NOT EXISTS correction_model     text,
    -- The AI model that hallucinated; used to target the re-check
  ADD COLUMN IF NOT EXISTS verifying_since      timestamptz,
    -- When the alert moved to 'verifying' status; follow-up cron uses this
  ADD COLUMN IF NOT EXISTS follow_up_checked_at timestamptz,
    -- When the follow-up cron last checked this alert
  ADD COLUMN IF NOT EXISTS follow_up_result     text;
    -- 'resolved' | 'still_hallucinating' | null (not yet checked)

COMMENT ON COLUMN public.hallucination_alerts.correction_query IS
  'Original detection query used for the follow-up re-check. Sprint F.';
COMMENT ON COLUMN public.hallucination_alerts.verifying_since IS
  'Timestamp when alert entered verifying status. Follow-up cron triggers 14 days after this. Sprint F.';
```

**Check which columns already exist** before writing the migration — `prod_schema.sql` may have `correction_query` and `correction_model` from the correction brief generation code. Only `ADD COLUMN IF NOT EXISTS` for columns that are genuinely missing.

#### Step 2: Update `CorrectionPanel.tsx` — set `verifying_since` and store query/model

When the correction brief is generated and the alert moves to `verifying`, also set `verifying_since = NOW()`. If the original alert already records the query text and model (check `hallucination_alerts` schema), ensure these are passed through — the follow-up cron needs them.

Read `CorrectionPanel.tsx` fully. Find the Supabase update call that sets `status = 'verifying'`. Extend it:

```typescript
// In the server action that sets status → verifying:
await supabase
  .from('hallucination_alerts')
  .update({
    status: 'verifying',
    verifying_since: new Date().toISOString(),
    // Only set these if not already stored on the alert:
    correction_query: alert.detection_query ?? null,
    correction_model: alert.model ?? null,
  })
  .eq('id', alertId);
```

Also update the `CorrectionPanel` UI to show the follow-up status when available:

```tsx
{/* After the "Brief generated" confirmation: */}
{alert.status === 'verifying' && (
  <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800" data-testid="correction-verifying-notice">
    {alert.follow_up_result === null && (
      <>
        <span className="font-medium">Verification in progress.</span>{' '}
        LocalVector will automatically check if {MODEL_LABELS[alert.correction_model]} has updated its response in about 2 weeks.
      </>
    )}
    {alert.follow_up_result === 'resolved' && (
      <span className="text-emerald-700 font-medium">✓ Verified resolved — {MODEL_LABELS[alert.correction_model]} no longer shows incorrect information.</span>
    )}
    {alert.follow_up_result === 'still_hallucinating' && (
      <span className="text-amber-700 font-medium">Still showing incorrect information. Consider re-distributing your correction across more citation sources.</span>
    )}
  </div>
)}
```

#### Step 3: Follow-up cron — `app/api/cron/correction-follow-up/route.ts`

A new scheduled cron route. Read the existing cron routes (`sov/route.ts`, `weekly-digest/route.ts`) for the auth header pattern and `logCronStart/Success/Failure` usage.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { logCronStart, logCronSuccess, logCronFailure } from '@/lib/services/cron-logger';
import * as Sentry from '@sentry/nextjs';

/**
 * POST /api/cron/correction-follow-up
 *
 * Scheduled: daily (runs every day; only processes alerts where verifying_since was 14+ days ago)
 *
 * For each alert in 'verifying' status that is 14+ days old:
 *   1. Re-run the original detection query against the original AI model
 *   2. Check if the hallucinated content is still present
 *   3. Update status → 'resolved' or 'still_hallucinating'
 *   4. Set follow_up_checked_at = NOW()
 *
 * Auth: Bearer token from CRON_SECRET env var (same as other cron routes)
 */
export async function POST(req: NextRequest) {
  // Auth check — match existing cron auth pattern exactly
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const runId = await logCronStart('correction-follow-up');
  const supabase = createServiceRoleClient();

  let checkedCount = 0;
  let resolvedCount = 0;
  let stillHallucinatingCount = 0;
  let errorCount = 0;

  try {
    // Find all alerts in 'verifying' status that are 14+ days old and not yet checked
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: alerts, error } = await supabase
      .from('hallucination_alerts')
      .select('id, org_id, correction_query, correction_model, description, verifying_since')
      .eq('status', 'verifying')
      .is('follow_up_checked_at', null)           // Not yet checked
      .lt('verifying_since', fourteenDaysAgo)      // At least 14 days in verifying
      .not('correction_query', 'is', null)         // Has a query to re-run
      .not('correction_model', 'is', null)         // Has a model to check
      .limit(50);                                   // Process up to 50 per run — prevent runaway

    if (error) throw new Error(`Failed to fetch verifying alerts: ${error.message}`);
    if (!alerts?.length) {
      await logCronSuccess(runId, { orgs_processed: 0 });
      return NextResponse.json({ ok: true, checked: 0 });
    }

    for (const alert of alerts) {
      try {
        const result = await checkCorrectionStatus(alert);
        const newStatus = result.stillHallucinating ? 'still_hallucinating' : 'resolved';

        await supabase
          .from('hallucination_alerts')
          .update({
            status: newStatus,
            follow_up_result: newStatus,
            follow_up_checked_at: new Date().toISOString(),
          })
          .eq('id', alert.id);

        checkedCount++;
        if (newStatus === 'resolved') resolvedCount++;
        else stillHallucinatingCount++;
      } catch (err) {
        errorCount++;
        Sentry.captureException(err, {
          tags: { cron: 'correction-follow-up', sprint: 'F' },
          extra: { alertId: alert.id, orgId: alert.org_id },
        });
        // Mark as checked so we don't retry endlessly on permanent failures
        await supabase
          .from('hallucination_alerts')
          .update({ follow_up_checked_at: new Date().toISOString() })
          .eq('id', alert.id);
      }
    }

    const summary = { checked: checkedCount, resolved: resolvedCount, stillHallucinating: stillHallucinatingCount, errors: errorCount };
    console.log('[Correction Follow-Up]', summary);
    await logCronSuccess(runId, { orgs_processed: checkedCount });

    if (errorCount > 0) {
      Sentry.captureMessage(`Correction follow-up: ${errorCount} check errors`, {
        level: 'warning',
        tags: { cron: 'correction-follow-up' },
        extra: summary,
      });
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'correction-follow-up', sprint: 'F' } });
    await logCronFailure(runId, String(err));
    return NextResponse.json({ error: 'cron_failed' }, { status: 500 });
  }
}
```

#### Step 4: `checkCorrectionStatus` — `lib/services/correction-verifier.service.ts`

```typescript
/**
 * lib/services/correction-verifier.service.ts
 *
 * Re-runs the original detection query against the original AI model.
 * Returns { stillHallucinating: boolean } based on whether the wrong
 * information from the original alert is still present in the AI response.
 *
 * "Still hallucinating" detection strategy:
 * - Simple: check if any key phrase from the original wrong description
 *   appears in the new response (case-insensitive substring match).
 * - This is a heuristic — not perfect. If the wrong phrase ("closes at 10pm")
 *   no longer appears in the new response, we assume it's been corrected.
 *
 * Improvement path: use an LLM judge in a future sprint for more nuanced
 * verification. For Sprint F, substring match is sufficient and costs no credits.
 */

interface Alert {
  id: string;
  correction_query: string;
  correction_model: string;
  description: string;     // Original wrong description — used for substring check
}

export async function checkCorrectionStatus(alert: Alert): Promise<{ stillHallucinating: boolean }> {
  const { correction_query, correction_model, description } = alert;

  // Run the original query against the original model
  let aiResponse: string;
  try {
    aiResponse = await runSingleModelQuery(correction_query, correction_model);
  } catch {
    // If the model query fails, assume still hallucinating (conservative)
    return { stillHallucinating: true };
  }

  // Extract key wrong phrases from the original description
  // Strategy: take the most distinctive noun phrases (3+ words) from the description
  const wrongPhrases = extractKeyPhrases(description);

  // If ANY of the wrong phrases appear in the new response, still hallucinating
  const stillHallucinating = wrongPhrases.some(phrase =>
    aiResponse.toLowerCase().includes(phrase.toLowerCase())
  );

  return { stillHallucinating };
}

/**
 * Extracts 2–4 distinctive phrases from the hallucination description
 * to use for substring matching in the follow-up response.
 *
 * Examples:
 * "ChatGPT listed incorrect hours — showing 11am open instead of 5pm"
 *   → extracts: ["11am", "open at 11"]
 *
 * "Gemini shows outdated phone number 404-555-0100"
 *   → extracts: ["404-555-0100"]
 */
function extractKeyPhrases(description: string): string[] {
  // Extract phone numbers, times, addresses — the most distinctive wrong facts
  const patterns = [
    /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,    // Phone numbers
    /\b\d{1,2}(?:am|pm)\b/gi,               // Times
    /\b\d{1,5}\s+[A-Z][a-z]+\s+(?:St|Ave|Dr|Blvd|Rd|Way|Pkwy)\b/g,  // Addresses
  ];

  const phrases: string[] = [];
  for (const pattern of patterns) {
    const matches = description.match(pattern);
    if (matches) phrases.push(...matches);
  }

  // Fallback: if no structured data found, use the longest contiguous word sequence
  if (phrases.length === 0 && description.length > 10) {
    const words = description.split(/\s+/).filter(w => w.length > 4);
    if (words.length >= 2) phrases.push(words.slice(0, 3).join(' '));
  }

  return phrases.slice(0, 4); // At most 4 key phrases
}

async function runSingleModelQuery(query: string, model: string): Promise<string> {
  // Reuse the model query functions from lib/ai-preview/model-queries.ts
  const { queryOpenAI, queryPerplexity, queryGemini } = await import('@/lib/ai-preview/model-queries');

  const modelNormalized = model.toLowerCase();
  let result;

  if (modelNormalized.includes('openai') || modelNormalized.includes('chatgpt') || modelNormalized.includes('gpt')) {
    result = await queryOpenAI(query, '');
  } else if (modelNormalized.includes('perplexity')) {
    result = await queryPerplexity(query, '');
  } else if (modelNormalized.includes('gemini') || modelNormalized.includes('google')) {
    result = await queryGemini(query, '');
  } else {
    throw new Error(`Unknown model: ${model}`);
  }

  if (result.status === 'error') throw new Error(result.content);
  return result.content;
}
```

**Register the cron** in `vercel.json` (or wherever the other crons are scheduled). Read the existing cron schedule configuration before adding a new entry — match its format exactly.

```json
{
  "path": "/api/cron/correction-follow-up",
  "schedule": "0 10 * * *"
}
```

This runs daily at 10:00 UTC. Only alerts where `verifying_since` is 14+ days ago are processed — so most days it will find nothing and exit quickly.

---

### Feature N4: Benchmark Comparison

**The user moment:** A restaurant owner opens their dashboard and sees: "Your Reality Score: 62 — Alpharetta restaurants average: 51 — You're in the top 30%." Above average customers feel proud and stay. Below average customers feel motivated to fix their hallucinations. Both effects drive retention.

**The constraint:** This display requires at least 10 businesses in the same city+industry on LocalVector. Below that threshold, showing a "2-business average" would be statistically meaningless and potentially de-anonymizing. The card handles both states gracefully.

#### Step 1: DB migration — `benchmarks` table

```sql
-- Sprint F: Benchmark comparison — pre-computed city+industry averages
CREATE TABLE IF NOT EXISTS public.benchmarks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city            text NOT NULL,
  industry        text NOT NULL DEFAULT 'restaurant',
  org_count       integer NOT NULL,      -- Number of orgs in this city+industry
  avg_score       numeric(5,2) NOT NULL, -- Average reality_score (0–100)
  min_score       numeric(5,2) NOT NULL,
  max_score       numeric(5,2) NOT NULL,
  p25_score       numeric(5,2),          -- 25th percentile (optional; add if query is simple)
  p75_score       numeric(5,2),          -- 75th percentile
  computed_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT benchmarks_city_industry UNIQUE (city, industry)
    -- Only one row per city+industry; upserted by the weekly cron
);

-- RLS: any authenticated user can read benchmarks (aggregate data only — no org details)
ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read benchmarks"
  ON public.benchmarks FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.benchmarks IS
  'Pre-computed weekly city+industry benchmarks. Requires MIN_BENCHMARK_ORG_COUNT orgs to be meaningful. Sprint F.';
COMMENT ON COLUMN public.benchmarks.org_count IS
  'Number of orgs in this city+industry. Only displayed when >= 10.';
```

#### Step 2: Benchmark cron — `app/api/cron/benchmarks/route.ts`

Runs weekly (Sunday, after the main SOV scan). Computes averages per city+industry and upserts into `benchmarks`.

```typescript
/**
 * POST /api/cron/benchmarks
 *
 * Scheduled: weekly (Sunday, after SOV scan — e.g., 0 8 * * 0)
 *
 * Queries ai_scores joined to orgs (for city + industry).
 * Only includes orgs that have a non-null reality_score.
 * Groups by city + industry.
 * Upserts into benchmarks table.
 * Never exposes org-level data — only aggregates.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const runId = await logCronStart('benchmarks');
  const supabase = createServiceRoleClient();

  try {
    // Aggregate: avg/min/max reality_score grouped by city + industry
    // Only orgs with a non-null reality_score; only groups with 3+ orgs (privacy floor)
    // The MIN_DISPLAY threshold (10) is enforced at display time, not here.
    // Here we collect data for any city with 3+ orgs so we build the dataset early.
    const { data, error } = await supabase.rpc('compute_benchmarks');
    // See RPC definition below — this is the cleanest way to do grouped aggregation

    if (error) throw new Error(`Benchmark aggregation failed: ${error.message}`);

    let upsertCount = 0;
    for (const row of data ?? []) {
      const { error: upsertErr } = await supabase
        .from('benchmarks')
        .upsert({
          city:        row.city,
          industry:    row.industry,
          org_count:   row.org_count,
          avg_score:   row.avg_score,
          min_score:   row.min_score,
          max_score:   row.max_score,
          computed_at: new Date().toISOString(),
        }, { onConflict: 'city,industry' });

      if (!upsertErr) upsertCount++;
    }

    console.log(`[Benchmarks] Upserted ${upsertCount} city+industry rows`);
    await logCronSuccess(runId, { orgs_processed: upsertCount });
    return NextResponse.json({ ok: true, upserted: upsertCount });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: 'benchmarks', sprint: 'F' } });
    await logCronFailure(runId, String(err));
    return NextResponse.json({ error: 'cron_failed' }, { status: 500 });
  }
}
```

**The `compute_benchmarks` RPC function:**

```sql
-- Add to the benchmarks migration or a separate migration:
CREATE OR REPLACE FUNCTION public.compute_benchmarks()
RETURNS TABLE(
  city       text,
  industry   text,
  org_count  bigint,
  avg_score  numeric,
  min_score  numeric,
  max_score  numeric
) AS $$
  SELECT
    o.city,
    COALESCE(o.industry, 'restaurant') AS industry,
    COUNT(*)::bigint                    AS org_count,
    ROUND(AVG(s.reality_score)::numeric, 2) AS avg_score,
    MIN(s.reality_score)::numeric       AS min_score,
    MAX(s.reality_score)::numeric       AS max_score
  FROM public.orgs o
  JOIN public.ai_scores s ON s.org_id = o.id
  WHERE s.reality_score IS NOT NULL
    AND o.city IS NOT NULL
  GROUP BY o.city, COALESCE(o.industry, 'restaurant')
  HAVING COUNT(*) >= 3    -- Privacy floor: never aggregate fewer than 3 orgs
  ORDER BY COUNT(*) DESC;
$$ LANGUAGE sql SECURITY DEFINER;
```

**Verify column names:** Before writing this RPC, confirm the actual column names in `orgs` (`city`? `location_city`?) and `ai_scores` (`reality_score`? `score`?). Adjust the SQL to match reality.

#### Step 3: `BenchmarkComparisonCard` — `app/dashboard/_components/BenchmarkComparisonCard.tsx`

```tsx
/**
 * BenchmarkComparisonCard — shows org's Reality Score vs. city+industry average.
 *
 * Two states:
 * - "Collecting" (org_count < MIN_DISPLAY_THRESHOLD):
 *     Shows org's own score + progress toward benchmark threshold
 * - "Ready" (org_count >= MIN_DISPLAY_THRESHOLD):
 *     Shows org's score vs. avg, percentile band, min/max range bar
 *
 * Receives benchmark data as props (fetched in dashboard page server component).
 * Never fetches directly from this client component.
 */

const MIN_DISPLAY_THRESHOLD = 10;

interface BenchmarkData {
  city: string;
  industry: string;
  org_count: number;
  avg_score: number;
  min_score: number;
  max_score: number;
}

interface BenchmarkComparisonCardProps {
  orgScore: number | null;
  orgCity: string | null;
  orgIndustry: string | null;
  benchmark: BenchmarkData | null;
}

export function BenchmarkComparisonCard({
  orgScore,
  orgCity,
  orgIndustry,
  benchmark,
}: BenchmarkComparisonCardProps) {
  const industryLabel = getIndustryConfig(orgIndustry).label;
  const isReady = benchmark && benchmark.org_count >= MIN_DISPLAY_THRESHOLD;

  if (!orgCity) return null;   // No city = no benchmark context

  return (
    <div
      className="rounded-lg border border-border bg-card p-5"
      data-testid="benchmark-comparison-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-foreground">
            {orgCity} Benchmark
          </h3>
          <InfoTooltip
            content={{
              title: 'City Benchmark',
              what: `How your Reality Score compares to other ${industryLabel} businesses in ${orgCity} on LocalVector.`,
              how: `Computed weekly from anonymized scores of businesses in ${orgCity}. Requires at least ${MIN_DISPLAY_THRESHOLD} businesses.`,
              action: 'Improve your score by resolving open hallucination alerts.',
            }}
          />
        </div>
        {isReady && (
          <span className="text-xs text-muted-foreground">
            {benchmark.org_count} businesses
          </span>
        )}
      </div>

      {!isReady && (
        /* Collecting state */
        <div data-testid="benchmark-collecting-state">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {orgScore ?? '—'}
            </span>
            <span className="text-sm text-muted-foreground">your score</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Benchmark data is collecting. {benchmark?.org_count ?? 0} of {MIN_DISPLAY_THRESHOLD} {industryLabel.toLowerCase()} businesses needed in {orgCity}.
          </p>
          {/* Progress bar toward threshold */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/40 transition-all"
              style={{ width: `${Math.min(100, ((benchmark?.org_count ?? 0) / MIN_DISPLAY_THRESHOLD) * 100)}%` }}
              aria-label={`${benchmark?.org_count ?? 0} of ${MIN_DISPLAY_THRESHOLD} businesses`}
            />
          </div>
        </div>
      )}

      {isReady && orgScore !== null && (
        /* Comparison state */
        <div data-testid="benchmark-ready-state">
          <div className="flex items-center justify-between">
            {/* Left: org score */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">You</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{orgScore}</p>
            </div>
            {/* Center: vs */}
            <div className="text-sm font-medium text-muted-foreground">vs.</div>
            {/* Right: city average */}
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{orgCity} Avg</p>
              <p className="text-2xl font-bold tabular-nums text-muted-foreground">{benchmark.avg_score}</p>
            </div>
          </div>

          {/* Range bar — shows where org falls between min and max */}
          <div className="mt-4">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              {/* Average marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-foreground/30"
                style={{ left: `${positionOnRange(benchmark.avg_score, benchmark.min_score, benchmark.max_score)}%` }}
                aria-label="City average"
              />
              {/* Org score marker */}
              <div
                className={cn(
                  'absolute top-0 h-full w-1 rounded-full',
                  orgScore >= benchmark.avg_score ? 'bg-emerald-500' : 'bg-amber-500'
                )}
                style={{ left: `${positionOnRange(orgScore, benchmark.min_score, benchmark.max_score)}%` }}
                aria-label={`Your score: ${orgScore}`}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{benchmark.min_score}</span>
              <span className={cn('text-xs font-medium', orgScore >= benchmark.avg_score ? 'text-emerald-600' : 'text-amber-600')}>
                {orgScore >= benchmark.avg_score
                  ? `${(orgScore - benchmark.avg_score).toFixed(0)} above average`
                  : `${(benchmark.avg_score - orgScore).toFixed(0)} below average`}
              </span>
              <span>{benchmark.max_score}</span>
            </div>
          </div>
        </div>
      )}

      {isReady && orgScore === null && (
        <p className="text-sm text-muted-foreground">
          Your Reality Score will appear here after your first scan.
        </p>
      )}
    </div>
  );
}

function positionOnRange(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(2, Math.min(98, ((value - min) / (max - min)) * 100));
}
```

Import `InfoTooltip` from `'@/components/ui/InfoTooltip'` and `getIndustryConfig` from `'@/lib/industries/industry-config'`.

#### Step 4: Fetch benchmark data in `app/dashboard/page.tsx`

In the dashboard server component, add a benchmark fetch alongside the existing data fetches:

```typescript
// Fetch org's city and industry for benchmark lookup
const { data: orgMeta } = await supabase
  .from('orgs')
  .select('city, industry')
  .eq('id', orgId)
  .single();

// Fetch benchmark for this city+industry (may be null if not enough data yet)
const { data: benchmark } = await supabase
  .from('benchmarks')
  .select('city, industry, org_count, avg_score, min_score, max_score')
  .eq('city', orgMeta?.city ?? '')
  .eq('industry', orgMeta?.industry ?? 'restaurant')
  .maybeSingle();   // Returns null, not an error, when no row found
```

Then add the card to the dashboard grid in the appropriate position (after the existing MetricCards but before charts — it's a summary metric, not a chart):

```tsx
<BenchmarkComparisonCard
  orgScore={displayScores?.realityScore ?? null}
  orgCity={orgMeta?.city ?? null}
  orgIndustry={orgMeta?.industry ?? null}
  benchmark={benchmark}
/>
```

---

## 🧪 Testing

### Test File 1: `src/__tests__/unit/ai-preview-route.test.ts`

```
describe('/api/ai-preview route handler')
  Auth:
  1.  returns 401 when user is not authenticated
  2.  returns 403 when user has no org

  Credit gating:
  3.  returns 402 with creditsUsed + creditsLimit when credit check fails (insufficient_credits)
  4.  does NOT call any AI model when credit check fails
  5.  calls consumeCredit() after all models have responded successfully
  6.  does NOT call consumeCredit() if all models errored before responding

  Input validation:
  7.  returns 400 when query is fewer than 3 characters
  8.  returns 400 when query exceeds 200 characters
  9.  returns 400 when query is missing from request body

  Response streaming:
  10. response Content-Type is 'text/event-stream'
  11. SSE stream contains events for all 3 models (chatgpt, perplexity, gemini)
  12. each model event has { model, status, content } shape
  13. stream ends with { type: 'done' } event

  Error handling:
  14. if one model throws, that model emits { status: 'error' } — other models still respond
  15. if all models throw, stream emits { type: 'error' } and closes
```

**Target: 15 tests**

### Test File 2: `src/__tests__/unit/model-queries.test.ts`

```
describe('queryOpenAI()')
  1.  returns { status: 'error' } when OPENAI_API_KEY is not set
  2.  calls openai.chat.completions.create with correct model and messages
  3.  returns { status: 'complete', content: '...' } on success
  4.  returns { status: 'error' } when OpenAI API throws
  5.  captures exception to Sentry when API throws

describe('queryPerplexity()')
  6.  returns { status: 'error' } when PERPLEXITY_API_KEY is not set
  7.  uses correct Perplexity base URL (api.perplexity.ai)
  8.  returns { status: 'complete', content: '...' } on success
  9.  returns { status: 'error' } when Perplexity API throws

describe('queryGemini()')
  10. returns { status: 'error' } when neither GOOGLE_API_KEY nor GEMINI_API_KEY is set
  11. uses GEMINI_API_KEY preferentially when both are set
  12. returns { status: 'complete', content: '...' } on success
  13. returns { status: 'error' } when Gemini API throws
```

**Target: 13 tests** — all AI SDK calls mocked via `vi.mock`

### Test File 3: `src/__tests__/unit/ai-answer-preview-widget.test.tsx`

```
describe('AIAnswerPreviewWidget')
  Initial state:
  1.  renders query input with correct placeholder
  2.  renders "Run Preview" button disabled when query is empty
  3.  renders "Run Preview" button disabled when query < 3 chars
  4.  model response cards are NOT visible before first run
  5.  char counter shows 0/200

  Running:
  6.  button becomes disabled and shows "Running…" while request is in flight
  7.  model response cards appear after first run (even if still loading)
  8.  all 3 model cards visible with data-testid="ai-preview-card-{model}"
  9.  loading skeleton renders for each model in loading state
  10. model card shows content when status === 'complete'
  11. model card shows error text when status === 'error'

  Credit error:
  12. renders credit error message with data-testid="ai-preview-credit-error" on 402 response
  13. credit error includes link to /dashboard/billing

  Input constraints:
  14. pressing Enter in the input calls handleRun
  15. input maxLength is 200
  16. char counter shows warning color when near limit (> 180 chars)
```

**Target: 16 tests**

### Test File 4: `src/__tests__/unit/correction-verifier.test.ts`

```
describe('extractKeyPhrases()')
  1.  extracts phone numbers from description text
  2.  extracts times (e.g., "11am", "5pm") from description text
  3.  extracts addresses from description text
  4.  falls back to first 3 words when no structured data found
  5.  returns at most 4 phrases
  6.  handles empty description without throwing

describe('checkCorrectionStatus()')
  7.  returns { stillHallucinating: true } when wrong phrase appears in new response
  8.  returns { stillHallucinating: false } when wrong phrase NOT in new response
  9.  returns { stillHallucinating: true } when model query throws (conservative default)
  10. calls queryOpenAI for model names containing 'openai' or 'chatgpt' or 'gpt'
  11. calls queryPerplexity for model names containing 'perplexity'
  12. calls queryGemini for model names containing 'gemini'
  13. all model queries are mocked — no real API calls
  14. phrase matching is case-insensitive
```

**Target: 14 tests**

### Test File 5: `src/__tests__/unit/benchmark-comparison-card.test.tsx`

```
describe('BenchmarkComparisonCard — collecting state')
  1.  renders data-testid="benchmark-collecting-state" when org_count < 10
  2.  shows the org's own score
  3.  shows progress toward threshold: "X of 10 businesses needed"
  4.  progress bar width scales with org_count / 10
  5.  renders nothing when orgCity is null

describe('BenchmarkComparisonCard — ready state')
  6.  renders data-testid="benchmark-ready-state" when org_count >= 10
  7.  shows org score and city average side by side
  8.  shows "X above average" in emerald when orgScore > avg_score
  9.  shows "X below average" in amber when orgScore < avg_score
  10. range bar renders with org marker and average marker
  11. org marker is emerald when above average, amber when below
  12. shows min and max score at ends of range bar

describe('positionOnRange()')
  13. returns 50 when min === max (avoid division by zero)
  14. returns ~2 for minimum value
  15. returns ~98 for maximum value
  16. clamps values outside min/max to 2–98 range

describe('BenchmarkComparisonCard — no org score')
  17. renders fallback text when orgScore is null and benchmark is ready
```

**Target: 17 tests**

### Test File 6: `src/__tests__/unit/benchmarks-cron.test.ts`

```
describe('benchmarks cron route')
  1.  returns 401 when CRON_SECRET does not match
  2.  calls compute_benchmarks() RPC
  3.  upserts rows to benchmarks table for each result from RPC
  4.  uses onConflict: 'city,industry' for upsert (no duplicates)
  5.  logs cron start with logCronStart('benchmarks')
  6.  logs cron success with logCronSuccess after successful run
  7.  logs cron failure with logCronFailure when RPC throws
  8.  captures to Sentry when RPC throws
  9.  returns { ok: true, upserted: N } on success
  10. all Supabase calls use createServiceRoleClient (not user client)
```

**Target: 10 tests**

### E2E Test File: `src/__tests__/e2e/sprint-f-smoke.spec.ts`

```
describe('Sprint F — E2E Smoke Tests')

  N2 — AI Answer Preview:
  1.  ai-preview-widget is visible on the ai-responses page
  2.  run button is disabled when query is empty
  3.  run button is enabled when query has 3+ characters
  4.  typing in input and pressing Enter triggers a run (button shows "Running…")
  5.  after run completes: 3 model cards visible (chatgpt, perplexity, gemini)
  6.  each model card shows non-empty content or an error message (never blank)
  7.  credit error banner appears when mocked API returns 402

  N3 — Correction Follow-Up UI:
  8.  CorrectionPanel shows "Verification in progress" notice when alert.status === 'verifying'
  9.  notice is absent when alert.status === 'open'
  10. notice shows resolved state when follow_up_result === 'resolved'
  11. notice shows "still showing" state when follow_up_result === 'still_hallucinating'

  N4 — Benchmark Card:
  12. benchmark-comparison-card is present on the dashboard
  13. benchmark-collecting-state is shown when org has no benchmark data
  14. "X of 10 businesses needed" progress text is visible in collecting state
  15. benchmark-ready-state is shown when mock benchmark has org_count >= 10
  16. "above average" or "below average" label is visible in ready state
  17. InfoTooltip trigger is present on the benchmark card
```

**Total Playwright: 17 tests**

### Run commands:

```bash
npx vitest run src/__tests__/unit/ai-preview-route.test.ts
npx vitest run src/__tests__/unit/model-queries.test.ts
npx vitest run src/__tests__/unit/ai-answer-preview-widget.test.tsx
npx vitest run src/__tests__/unit/correction-verifier.test.ts
npx vitest run src/__tests__/unit/benchmark-comparison-card.test.tsx
npx vitest run src/__tests__/unit/benchmarks-cron.test.ts
npx vitest run                                              # All units — 0 regressions across A–F
npx playwright test src/__tests__/e2e/sprint-f-smoke.spec.ts
npx tsc --noEmit                                            # 0 new type errors
```

---

## 📂 Files to Create / Modify

| # | File | Action | Fix |
|---|------|--------|-----|
| 1 | `app/api/ai-preview/route.ts` | **CREATE** | N2 — SSE route: auth, credit check, parallel model calls |
| 2 | `lib/ai-preview/model-queries.ts` | **CREATE** | N2 — queryOpenAI, queryPerplexity, queryGemini |
| 3 | `app/dashboard/ai-responses/_components/AIAnswerPreviewWidget.tsx` | **CREATE** | N2 — Widget with query input + 3 model cards |
| 4 | `app/dashboard/ai-responses/page.tsx` | **MODIFY** | N2 — Wire widget + FirstVisitTooltip at top |
| 5 | `supabase/migrations/[ts]_hallucination_alerts_follow_up.sql` | **CREATE** | N3 — New columns: correction_query, correction_model, verifying_since, follow_up_checked_at, follow_up_result |
| 6 | `supabase/prod_schema.sql` | **MODIFY** | N3 + N4 — New columns + benchmarks table |
| 7 | `lib/supabase/database.types.ts` | **MODIFY** | N3 + N4 — New types |
| 8 | `app/dashboard/_components/CorrectionPanel.tsx` | **MODIFY** | N3 — Set verifying_since on status change; follow-up status UI |
| 9 | `lib/services/correction-generator.service.ts` | **MODIFY** | N3 — Store correction_query + correction_model on alert |
| 10 | `lib/services/correction-verifier.service.ts` | **CREATE** | N3 — checkCorrectionStatus, extractKeyPhrases, runSingleModelQuery |
| 11 | `app/api/cron/correction-follow-up/route.ts` | **CREATE** | N3 — Daily cron: process verifying alerts 14+ days old |
| 12 | `vercel.json` (or cron config) | **MODIFY** | N3 — Register correction-follow-up cron schedule |
| 13 | `supabase/migrations/[ts]_benchmarks.sql` | **CREATE** | N4 — benchmarks table + compute_benchmarks() RPC |
| 14 | `app/api/cron/benchmarks/route.ts` | **CREATE** | N4 — Weekly benchmark aggregation cron |
| 15 | `vercel.json` (or cron config) | **MODIFY** | N4 — Register benchmarks cron schedule |
| 16 | `app/dashboard/_components/BenchmarkComparisonCard.tsx` | **CREATE** | N4 — Collecting + ready states |
| 17 | `app/dashboard/page.tsx` | **MODIFY** | N4 — Fetch benchmark; add BenchmarkComparisonCard to grid |
| 18 | `src/__tests__/unit/ai-preview-route.test.ts` | **CREATE** | Tests — 15 |
| 19 | `src/__tests__/unit/model-queries.test.ts` | **CREATE** | Tests — 13 |
| 20 | `src/__tests__/unit/ai-answer-preview-widget.test.tsx` | **CREATE** | Tests — 16 |
| 21 | `src/__tests__/unit/correction-verifier.test.ts` | **CREATE** | Tests — 14 |
| 22 | `src/__tests__/unit/benchmark-comparison-card.test.tsx` | **CREATE** | Tests — 17 |
| 23 | `src/__tests__/unit/benchmarks-cron.test.ts` | **CREATE** | Tests — 10 |
| 24 | `src/__tests__/e2e/sprint-f-smoke.spec.ts` | **CREATE** | E2E — 17 |

---

## 🧠 Edge Cases to Handle

1. **N2 — one model slow, others fast.** `Promise.allSettled` fires all three in parallel and each sends an SSE event as it resolves. A slow Gemini response doesn't block the ChatGPT result from appearing. The client updates each card independently. Never `await` the three model calls sequentially.

2. **N2 — credit consumed even if one model fails.** The credit is consumed after `Promise.allSettled` — meaning after all three model calls have completed or errored. Even if Gemini errors, the user got value from the other two responses. Do not refund credits for partial failures. Only skip credit consumption if ALL three model calls failed before any response was received.

3. **N2 — SSE in Next.js App Router.** The route handler returns `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' ... } })`. Verify that the existing Next.js version supports this pattern — it does in Next.js 13.4+. Read `package.json` for the Next.js version. Do not use `NextResponse` for streaming responses — use the raw `Response` constructor.

4. **N2 — `'use client'` widget inside a Server Component page.** `AIAnswerPreviewWidget` is `'use client'`. Adding it to `app/dashboard/ai-responses/page.tsx` creates a client boundary at the widget level — the rest of the page stays server-rendered. This is correct and expected. Do not make the whole page a client component.

5. **N3 — `verifying_since` may already be set on existing alerts.** If `hallucination_alerts` already has a `updated_at` column that records when the status last changed, use that as a proxy for `verifying_since` for existing alerts. The migration adds `verifying_since` — for pre-existing alerts in `verifying` status, `verifying_since` will be `NULL`. The cron should handle `NULL verifying_since` gracefully: either skip those alerts or treat `updated_at` as the fallback. Document the decision in the DEVLOG.

6. **N3 — `extractKeyPhrases` on vague descriptions.** Some hallucination descriptions may not contain phone numbers, addresses, or times — they may say something like "ChatGPT described the cuisine incorrectly." In that case, the phrase extraction falls back to the first 3 words. This fallback is weak (the first 3 words might be "ChatGPT described the" — useless for matching). Add a secondary fallback: extract quoted strings from the description if present (e.g., `"casual dining"` → `casual dining`).

7. **N3 — `correction-follow-up` cron runs daily but most days finds nothing.** The `.limit(50)` and `follow_up_checked_at IS NULL` filter ensure the cron exits quickly on days with no due alerts. The `logCronStart/Success` calls still happen — this is intentional for System Health observability.

8. **N4 — `compute_benchmarks()` SQL — column names.** The RPC uses `o.city` and `o.industry` — these column names must match `prod_schema.sql` exactly. Also `s.reality_score` must match the column name in `ai_scores`. Verify before writing the migration. The most likely mismatches: `orgs.city` might be `orgs.location_city`; `ai_scores.reality_score` might be `ai_scores.score` or `ai_scores.overall_score`.

9. **N4 — benchmark card in sample mode.** When `isSampleMode() === true` (Sprint B), the dashboard shows sample data. The benchmark card should NOT show sample benchmark data — showing "Alpharetta average: 51" would be misleading to a new user whose real data doesn't exist yet. Add: `if (sampleMode) return null` inside `BenchmarkComparisonCard` — or pass `sampleMode` as a prop and return null at the top. Document this decision.

10. **N4 — privacy floor `3` vs. display threshold `10`.** The `compute_benchmarks()` RPC has `HAVING COUNT(*) >= 3` (data collection floor — we collect data once 3 orgs exist in a city). The display threshold is `MIN_DISPLAY_THRESHOLD = 10` (we show benchmarks to users only when 10+ orgs exist). This two-tier approach means the benchmark data is ready and accurate before we start showing it. Never show a 3-org average to users — it's statistically fragile and potentially de-anonymizing.

11. **N4 — org has no city set.** `orgCity === null` → `BenchmarkComparisonCard` returns null immediately. The dashboard page should not crash or show an empty card slot. Verify the fetch in `dashboard/page.tsx` handles a null `orgMeta?.city` gracefully.

12. **Both N3 and N4 croons must be registered in `vercel.json`.** Read the existing cron configuration carefully. If `vercel.json` has a `crons` array, append to it. If crons are configured elsewhere (e.g., a `cron.yaml`), match that format. Cron secrets must use the same `CRON_SECRET` env var pattern as existing crons.

---

## 🚫 What NOT to Do

1. **DO NOT await model calls sequentially in the AI Preview route.** Sequential calls would mean the user waits for ChatGPT, then Perplexity, then Gemini — potentially 15–20 seconds. Always use `Promise.allSettled` for parallel execution.
2. **DO NOT install new AI SDK packages** without first checking what's already in `package.json`. The Perplexity API is OpenAI-compatible — the `openai` SDK pointed at Perplexity's base URL works without a Perplexity-specific package.
3. **DO NOT consume credits for cron-initiated calls.** The `correction-verifier` calls `queryOpenAI/Perplexity/Gemini` from the cron context — these must NOT go through `checkCredit/consumeCredit`. Cron operations are not credit-gated (AI_RULES §50 from Sprint D).
4. **DO NOT expose org-level data in benchmark queries.** The `compute_benchmarks()` RPC returns only aggregates. No org name, org ID, or individual score appears in the `benchmarks` table. The RLS policy on `benchmarks` allows all authenticated users to read it — that's safe because there's no sensitive org data in it.
5. **DO NOT show the benchmark card in sample mode.** A fake benchmark number next to fake sample data is doubly misleading.
6. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).
7. **DO NOT use dynamic Tailwind class construction** (AI_RULES §12).
8. **DO NOT modify `middleware.ts`** (AI_RULES §6).
9. **DO NOT use `page.waitForTimeout()` in Playwright tests** — use event-driven waits.
10. **DO NOT mock the entire fetch API globally in unit tests** — mock only the specific module under test to avoid contaminating other tests.
11. **DO NOT set `follow_up_result` before `follow_up_checked_at`.** Update both columns in a single `supabase.update()` call to ensure atomicity — never a two-step update where `follow_up_result` is set but `follow_up_checked_at` is still null.
12. **DO NOT run `compute_benchmarks()` in the dashboard page server component at request time.** The benchmark data is pre-computed by the weekly cron — the dashboard reads from the `benchmarks` table, not from a live aggregation. A live aggregation over `orgs + ai_scores` on every dashboard load would be slow.

---

## ✅ Definition of Done (AI_RULES §13.5)

**N2 — AI Answer Preview:**
- [ ] `app/api/ai-preview/route.ts` — auth, credit check, 3 parallel model calls, SSE stream, consumeCredit after success
- [ ] `lib/ai-preview/model-queries.ts` — queryOpenAI, queryPerplexity, queryGemini — each returns `{ status, content }`, each has Sentry on error, each returns graceful error if API key missing
- [ ] `AIAnswerPreviewWidget` — query input, char counter, Run button, 3 model cards (idle/loading/complete/error), credit error banner with billing link
- [ ] Widget placed at top of `ai-responses` page, above stored responses
- [ ] `data-testid="ai-preview-widget"`, `data-testid="ai-preview-query-input"`, `data-testid="ai-preview-run-btn"`, `data-testid="ai-preview-card-{model}"`, `data-testid="ai-preview-credit-error"` all present
- [ ] Credit check integrated — 402 response shows credit error, no model call made
- [ ] consumeCredit called once per run (not three times)
- [ ] SSE stream sends `{ type: 'done' }` event to close the connection

**N3 — Correction Follow-Up:**
- [ ] Migration adds `correction_query`, `correction_model`, `verifying_since`, `follow_up_checked_at`, `follow_up_result` to `hallucination_alerts` (or confirms they already exist)
- [ ] `CorrectionPanel.tsx` sets `verifying_since = NOW()` when status → verifying
- [ ] `correction-generator.service.ts` stores `correction_query` and `correction_model` on alert creation
- [ ] `lib/services/correction-verifier.service.ts` — `checkCorrectionStatus()`, `extractKeyPhrases()`, `runSingleModelQuery()`
- [ ] `app/api/cron/correction-follow-up/route.ts` — processes alerts in `verifying` status 14+ days old, limit 50/run
- [ ] Cron marks `follow_up_checked_at` even on model query failures (prevents infinite retry)
- [ ] CorrectionPanel UI shows: "Verification in progress" / "✓ Verified resolved" / "Still showing" based on `follow_up_result`
- [ ] `data-testid="correction-verifying-notice"` on the notice element
- [ ] Cron registered in `vercel.json` (or equivalent) on daily schedule

**N4 — Benchmark Comparison:**
- [ ] `supabase/migrations/[ts]_benchmarks.sql` — `benchmarks` table + `compute_benchmarks()` RPC with `HAVING COUNT(*) >= 3` privacy floor
- [ ] `app/api/cron/benchmarks/route.ts` — calls `compute_benchmarks()`, upserts results, logs via cron-logger, Sentry on failure
- [ ] Cron registered on weekly schedule (Sunday, after SOV scan)
- [ ] `BenchmarkComparisonCard` — collecting state (org_count < 10) and ready state (org_count >= 10)
- [ ] Card returns null when `orgCity` is null
- [ ] Card returns null (or is hidden) when `sampleMode === true`
- [ ] `data-testid="benchmark-comparison-card"`, `"benchmark-collecting-state"`, `"benchmark-ready-state"` present
- [ ] Card added to dashboard page grid; benchmark fetched server-side from `benchmarks` table (not live aggregation)

**Tests:**
- [ ] `ai-preview-route.test.ts` — **15 tests passing**
- [ ] `model-queries.test.ts` — **13 tests passing**
- [ ] `ai-answer-preview-widget.test.tsx` — **16 tests passing**
- [ ] `correction-verifier.test.ts` — **14 tests passing**
- [ ] `benchmark-comparison-card.test.tsx` — **17 tests passing**
- [ ] `benchmarks-cron.test.ts` — **10 tests passing**
- [ ] `sprint-f-smoke.spec.ts` — **17 E2E tests passing**
- [ ] `npx vitest run` — ALL tests across Sprints A–F passing, zero regressions
- [ ] `npx tsc --noEmit` — 0 new type errors

---

## 📓 DEVLOG Entry Format (AI_RULES §13.2)

```markdown
## [DATE] — Sprint F: Engagement & Retention — AI Preview, Correction Follow-Up & Benchmarks (Completed)

**Goal:** Three engagement features that make LocalVector sticky: on-demand AI preview (wow factor), correction follow-up (closed-loop proof), and benchmark comparison (city-level context).

**Scope:**
- `app/api/ai-preview/route.ts` — **NEW.** SSE route: auth + credit check (402 on limit) + 3 parallel model calls + consumeCredit after success.
- `lib/ai-preview/model-queries.ts` — **NEW.** queryOpenAI (gpt-4o-mini), queryPerplexity (sonar-small-online), queryGemini (gemini-1.5-flash). Each gracefully handles missing API key and API errors via Sentry.
- `AIAnswerPreviewWidget.tsx` — **NEW.** 3 model cards (idle/loading/complete/error), SSE reader, credit error banner. Placed at top of ai-responses page.
- `hallucination_alerts` migration — added: correction_query, correction_model, verifying_since, follow_up_checked_at, follow_up_result. [Note any columns that already existed.]
- `CorrectionPanel.tsx` — **MODIFIED.** Sets verifying_since on status → verifying. Renders follow-up status notice with resolved/still-hallucinating states.
- `correction-generator.service.ts` — **MODIFIED.** Stores correction_query + correction_model on correction brief generation.
- `lib/services/correction-verifier.service.ts` — **NEW.** extractKeyPhrases (phone/time/address regex + 3-word fallback), checkCorrectionStatus (substring match), runSingleModelQuery (reuses model-queries.ts).
- `app/api/cron/correction-follow-up/route.ts` — **NEW.** Daily cron: processes verifying alerts 14+ days old (limit 50/run). Marks follow_up_checked_at even on model failure. cron-logger + Sentry integrated.
- `supabase/migrations/[ts]_benchmarks.sql` — **NEW.** benchmarks table (city+industry UNIQUE, org_count, avg/min/max score) + compute_benchmarks() RPC (HAVING COUNT >= 3 privacy floor).
- `app/api/cron/benchmarks/route.ts` — **NEW.** Weekly cron: calls compute_benchmarks() RPC, upserts results. cron-logger + Sentry integrated.
- `BenchmarkComparisonCard.tsx` — **NEW.** Collecting state (progress bar, "X of 10 needed") + ready state (org vs avg, range bar, above/below label). Returns null in sample mode and when orgCity is null.
- `app/dashboard/page.tsx` — **MODIFIED.** Fetches benchmark from benchmarks table (server-side). BenchmarkComparisonCard added to dashboard grid.
- vercel.json — **MODIFIED.** correction-follow-up (daily 10:00 UTC) + benchmarks (weekly Sunday 08:00 UTC) registered.

**Tests added:**
- ai-preview-route.test.ts — 15 tests
- model-queries.test.ts — 13 tests
- ai-answer-preview-widget.test.tsx — 16 tests
- correction-verifier.test.ts — 14 tests
- benchmark-comparison-card.test.tsx — 17 tests
- benchmarks-cron.test.ts — 10 tests
- sprint-f-smoke.spec.ts — 17 E2E tests
- Sprint F total: 85 Vitest + 17 Playwright

**Cumulative totals (Sprints A–F):**
- Vitest: [N] total
- Playwright: [N] total

**Before/After:**
- Before: users waited until Sunday's cron to see AI responses. After: on-demand preview in < 10 seconds on the ai-responses page.
- Before: correction brief marked 'verifying' and nothing happened. After: daily follow-up cron closes the loop; CorrectionPanel shows resolved/still-hallucinating status 14+ days later.
- Before: no city-level context for scores. After: BenchmarkComparisonCard shows "62 vs. Alpharetta avg 51 — 11 above average" when 10+ orgs in city. Collecting state shows progress until threshold reached.

**Edge cases documented:**
- N3: NULL verifying_since on pre-existing verifying alerts → [handled via updated_at fallback / skipped — document actual decision]
- N4: benchmark card hidden in sample mode (Sprint B isSampleMode guard)
- N4: compute_benchmarks() SQL verified against prod_schema.sql column names before migration written
```

---

## 🔮 AI_RULES Update (Add to `AI_RULES.md`)

```markdown
## 55. ⚡ AI Answer Preview — Credit + Parallel Execution Rules (Sprint F)

`/api/ai-preview` and `lib/ai-preview/model-queries.ts` govern the on-demand AI preview.

* **Parallel execution:** Always use Promise.allSettled for the 3 model calls. Never await them sequentially.
* **Credit cost:** 1 credit per preview run — consumed AFTER all model calls complete (success or error). Not consumed if all 3 models error before any response.
* **Cron exemption:** correction-verifier.service.ts calls model-queries.ts functions from the cron context. These calls do NOT go through checkCredit/consumeCredit (AI_RULES §50).
* **Missing API key:** Each model query returns { status: 'error', content: '[Model] not configured' } gracefully — never throws. The widget still renders the error state for that model.
* **SSE format:** Each event is `data: JSON\n\n`. The stream closes with `data: {"type":"done"}\n\n`.

## 56. 🔄 Correction Follow-Up — State Machine Rules (Sprint F)

The hallucination_alerts status machine after correction brief generation:
  open → verifying (CorrectionPanel generates brief; verifying_since = NOW())
  verifying → resolved (correction-follow-up cron; follow_up_result = 'resolved')
  verifying → still_hallucinating (correction-follow-up cron; follow_up_result = 'still_hallucinating')

* **Cron safety:** Always set follow_up_checked_at even when model query fails — prevents infinite retry on permanent failures.
* **limit(50):** The follow-up cron processes at most 50 alerts per run. This prevents runaway on backlog.
* **No credit consumption:** correction-verifier is cron-invoked — not credit-gated.

## 57. 📊 Benchmark Data — Privacy and Display Rules (Sprint F)

`benchmarks` table contains pre-computed city+industry aggregates only.

* **Privacy floor:** compute_benchmarks() RPC has HAVING COUNT(*) >= 3. Never aggregate fewer than 3 orgs.
* **Display threshold:** BenchmarkComparisonCard only shows comparison data when org_count >= 10. Below 10, show collecting state.
* **No live aggregation:** Dashboard reads from benchmarks table (pre-computed weekly). Never run live GROUP BY against orgs+ai_scores on dashboard load.
* **Sample mode:** BenchmarkComparisonCard returns null when isSampleMode() === true (Sprint B).
* **Org data isolation:** benchmarks table contains no org-level fields — only city, industry, aggregates, org_count.
```

---

## 📚 Document Sync + Git Commit

### Step 1: Update `MEMORY.md`

```markdown
## AI Answer Preview — Architecture (Sprint F — 2026-[DATE])
- Route: POST /api/ai-preview → SSE stream
- 3 models in parallel via Promise.allSettled: queryOpenAI, queryPerplexity, queryGemini
- 1 credit per run consumed after all models respond
- Cron correction verifier reuses model-queries.ts without credit gating
- Model SDK: [document which SDK was used and why]

## Correction Follow-Up — State Machine (Sprint F — 2026-[DATE])
- verifying_since column: set when alert moves to verifying in CorrectionPanel
- Cron: daily at 10:00 UTC; processes alerts where verifying_since < 14 days ago
- Pre-existing null verifying_since handled by: [document actual decision]
- extractKeyPhrases: regex for phones/times/addresses + word fallback + quoted-string fallback

## Benchmark Comparison — Architecture (Sprint F — 2026-[DATE])
- benchmarks table: UNIQUE(city, industry); upserted weekly by benchmarks cron
- compute_benchmarks() RPC: HAVING COUNT >= 3 privacy floor; aggregates only
- Display threshold: 10 orgs; below threshold shows collecting state with progress bar
- Column names verified: orgs.[city_column] and ai_scores.[score_column] — [document actual names]
```

### Step 2: Update `CLAUDE.md`

```markdown
### Sprint F — Engagement & Retention (2026-[DATE]) — FINAL SPRINT (A–F complete)
- app/api/ai-preview/route.ts — SSE: credit check + 3 parallel model calls + consumeCredit
- lib/ai-preview/model-queries.ts — queryOpenAI, queryPerplexity, queryGemini
- AIAnswerPreviewWidget — 3 model cards, SSE reader, credit error → billing link
- hallucination_alerts: +correction_query, correction_model, verifying_since, follow_up_checked_at, follow_up_result
- correction-verifier.service.ts — extractKeyPhrases + checkCorrectionStatus
- correction-follow-up cron — daily; processes verifying alerts 14+ days old
- benchmarks table + compute_benchmarks() RPC (HAVING COUNT >= 3)
- benchmarks cron — weekly Sunday; upserts city+industry aggregates
- BenchmarkComparisonCard — collecting (< 10 orgs) + ready (>= 10 orgs) states
- AI_RULES: 55 (preview parallel/credit), 56 (correction state machine), 57 (benchmark privacy)
- Tests: 85 Vitest + 17 Playwright
- Cumulative (A–F): [N] Vitest + [N] Playwright
```

### Step 3: Git Commit

```bash
git add -A
git commit -m "Sprint F: Engagement & Retention — AI Preview, Correction Follow-Up & Benchmarks

- app/api/ai-preview: SSE route (auth + 1-credit check + 3 parallel models + consumeCredit)
- lib/ai-preview/model-queries.ts: queryOpenAI/Perplexity/Gemini (graceful error, Sentry)
- AIAnswerPreviewWidget: 3 model cards (idle/loading/complete/error), credit error banner
- hallucination_alerts: +verifying_since, follow_up_checked_at, follow_up_result columns
- CorrectionPanel: sets verifying_since; renders resolved/still-hallucinating follow-up status
- correction-verifier.service.ts: extractKeyPhrases + checkCorrectionStatus (substring heuristic)
- correction-follow-up cron: daily 10:00 UTC; 50-alert limit; marks checked_at even on failure
- benchmarks table: UNIQUE(city, industry); compute_benchmarks() RPC (HAVING COUNT >= 3)
- benchmarks cron: weekly Sunday 08:00 UTC; upserts city+industry aggregates
- BenchmarkComparisonCard: collecting state (progress bar) + ready state (vs avg, range bar)
- BenchmarkComparisonCard: hidden in sample mode; hidden when orgCity null
- tests: 85 Vitest + 17 Playwright; 0 regressions across all sprints (A–F)
- AI_RULES: 55 (preview rules), 56 (correction state machine), 57 (benchmark privacy)

Fixes: N2 (on-demand AI preview), N3 (correction follow-up), N4 (benchmark comparison)

This completes all 24 findings from the February 2026 LocalVector code analysis.
Sprints A–F: every Critical, High, Medium, Low, and Nice-to-have finding resolved."

git push origin main
```

---

## 🏁 Final Sprint Outcome

**Sprint F completes the February 2026 code analysis resolution.** Every finding across all 6 sprints has been addressed. Here is the final scorecard:

| Sprint | Theme | Findings Resolved |
|--------|-------|-------------------|
| A — Stop the Bleeding | Observability, trust, UX | C1, C3, H3, H4, H5, L4 |
| B — First Impressions | Sample data, tooltips, settings, plan comparison | C4, H1, H2, M3 |
| C — Hardening | Honest listings, test coverage, digest guard, seat cost | C2, M1, L2, H6, L3 |
| D — Operate & Protect | Admin dashboard, credits, revenue defaults, positioning | L1, N1, M4, M6 |
| E — Grow the Product | Medical/dental vertical, tour depth | M5, M2 |
| F — Engagement & Retention | AI preview, correction follow-up, benchmarks | N2, N3, N4 |

**What the product looks like now, from the outside:**
- A new restaurant customer signs up on a Monday, sees a populated sample dashboard (Sprint B), understands every metric via InfoTooltips (Sprint B), gets a positioning banner explaining why this is different from Yext (Sprint D), runs the AI Answer Preview to see what ChatGPT says about them right now (Sprint F), and gets their real data Sunday night
- A dental practice signs up with Medical/Dental selected at onboarding, sees "Magic Services" instead of "Magic Menu," gets dental-specific SOV query seeds monitoring "best dentist in Alpharetta" queries, and sees a Physician schema generated for their practice (Sprint E)
- A Growth plan customer who generates a correction brief sees "Verification in progress" in the CorrectionPanel, and 2 weeks later sees "✓ Verified resolved — ChatGPT no longer shows incorrect information" — the loop is closed, the product proved its value (Sprint F)
- Once 10 restaurant customers are in Alpharetta, every one of them sees "Your Reality Score: 62 vs. Alpharetta average: 51 — you're above average" — a powerful retention moment that appears automatically (Sprint F)

**As the operator (you):**
- `/admin` shows every customer, their plan, MRR, API usage, and cron health in real time (Sprint D)
- No customer can silently burn $100 in API calls — credits cap manual LLM triggers per plan (Sprint D)
- Sentry has full visibility into every production error across all 42+ catch blocks that were previously silent (Sprint A)
- The correction follow-up cron and benchmark cron log to `cron_run_log` — visible in System Health (Sprint F)
