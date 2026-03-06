# Runtime Safety Audit — Comprehensive Sweep

**Date:** 2026-03-06
**Scope:** All `app/`, `components/`, `lib/` directories
**Focus:** Null/undefined access, JSONB nullability, unsafe array/string methods, destructuring, Supabase data handling, component prop safety, division by zero, fetch `.json()` safety, `new Date()` on invalid values

---

## Wave 1 — JSONB Null Guards + String Safety (CRITICAL/HIGH)

### 1. MenuCoachHero — propagation_events null on JSONB column (FIXED)
**File:** `app/dashboard/magic-menus/_components/MenuCoachHero.tsx:91,109`
**Issue:** `menu.propagation_events.some(...)` — JSONB column typed as `PropagationEvent[]` but could be null at runtime.
**Fix:** `(menu.propagation_events ?? []).some(...)`

### 2. PresenceAvatars — empty email string crash (FIXED)
**File:** `app/dashboard/_components/PresenceAvatars.tsx:22`
**Issue:** `email[0].toUpperCase()` — crashes if email is empty string.
**Fix:** `(email[0] ?? '?').toUpperCase()`

### 3. ListingVerificationRow — non-null assertions (FIXED)
**File:** `app/dashboard/integrations/_components/ListingVerificationRow.tsx:93,202`
**Fix:** Replace `result!` with `result?.discrepancies ?? []`

### 4. Chat.tsx — items from AI tool response (FIXED)
**File:** `app/dashboard/ai-assistant/_components/Chat.tsx:131`
**Fix:** `(data.items ?? []).map(...)`

### 5. PlaybooksPageClient — actions from JSONB (FIXED)
**File:** `app/dashboard/playbooks/PlaybooksPageClient.tsx:133`
**Fix:** `(activePlaybook.actions ?? []).map(...)`

### 6. ReviewInboxPanel — avg_rating null (FIXED)
**File:** `app/dashboard/_components/ReviewInboxPanel.tsx:167`
**Fix:** `(stats.avg_rating ?? 0).toFixed(1)`

### 7. TopIssuesPanel — blindSpots undefined (FIXED)
**File:** `app/dashboard/_components/TopIssuesPanel.tsx:45`
**Fix:** `(crawlerSummary.blindSpots ?? []).slice(0, 2)`

### 8. MissionCard — voice_gaps/top_content_issues null (FIXED)
**File:** `app/dashboard/vaio/_components/MissionCard.tsx:271,273`
**Fix:** `(profile.voice_gaps ?? []).length > 0` and `(profile.top_content_issues ?? []).some(...)`

### 9. Menu public page — price undefined vs null (FIXED)
**File:** `app/m/[slug]/page.tsx:232`
**Fix:** `if (item.price != null)` (loose equality catches both)

### 10. hallucinations/actions.ts — claim_text null cast (FIXED)
**File:** `app/dashboard/hallucinations/actions.ts:223`
**Fix:** `((hallucination.claim_text as string) ?? '').toLowerCase()`

---

## Wave 2 — Component Props + Clipboard + Display (MEDIUM)

### 11. SimulationResultsModal — JSONB fields null (FIXED)
**File:** `app/dashboard/_components/SimulationResultsModal.tsx:164,169`
**Fix:** `(q.facts_hallucinated ?? []).length` and `(q.simulated_answer ?? '').slice()`

### 12. SchemaHealthPanel — embed_snippet + clipboard (FIXED)
**File:** `app/dashboard/_components/SchemaHealthPanel.tsx:262`
**Fix:** `page.embed_snippet && navigator.clipboard?.writeText(page.embed_snippet)`

### 13. response-generator — reviewer_name null (FIXED)
**File:** `lib/review-engine/response-generator.ts:226`
**Fix:** `(review.reviewer_name ?? '').split(' ')[0] || 'there'`

### 14. invite page — inviterName undefined (FIXED)
**File:** `app/(public)/invite/[token]/page.tsx:91`
**Fix:** Added final fallback `?? 'Your teammate'`

---

## Wave 3 — JSON.parse + new URL() try-catch (HIGH/MEDIUM)

### 15. settings/actions.ts — JSON.parse on user input (FIXED)
**File:** `app/dashboard/settings/actions.ts:195`
**Fix:** Wrapped in try-catch with `[]` fallback

### 16. competitor-intercept.service.ts — JSON.parse on AI response (FIXED)
**File:** `lib/services/competitor-intercept.service.ts:78`
**Fix:** `try { parsed = JSON.parse(text); } catch (_err) { parsed = {}; }`

### 17. content-audit-cron.ts — new URL() on DB URLs (FIXED)
**File:** `lib/inngest/functions/content-audit-cron.ts:47`
**Fix:** Wrapped in try-catch with `'other'` fallback

### 18. content-audit route — same new URL() pattern (FIXED)
**File:** `app/api/cron/content-audit/route.ts:47`
**Fix:** Same try-catch wrapper

### 19. indexnow.ts — new URL() on env var (FIXED)
**File:** `lib/indexnow.ts:33`
**Fix:** try-catch with `'schema.localvector.ai'` fallback

### 20. publish-wordpress.ts — new URL() on user config (FIXED)
**File:** `lib/autopilot/publish-wordpress.ts:63`
**Fix:** try-catch with descriptive error message

---

## Wave 4 — Division by Zero, JSONB Array.isArray(), fetch Safety, Arithmetic (NEW)

### 21. api-usage page — division by zero (FIXED)
**File:** `app/admin/api-usage/page.tsx:61`
**Issue:** `row.credits_used / row.credits_limit` — `credits_limit` could be 0 (trial org), producing `Infinity`.
**Fix:** `row.credits_limit > 0 ? Math.round((...) * 100) : 0`

### 22. onboarding select page — JSONB cast without Array.isArray (FIXED)
**File:** `app/onboarding/connect/select/page.tsx:41`
**Issue:** `pending.locations_data as unknown as GBPLocation[]` — if JSONB is not an array, `.length` crashes.
**Fix:** `Array.isArray(pending.locations_data) ? (...) : []`

### 23. onboarding actions — same JSONB cast (FIXED)
**File:** `app/onboarding/connect/actions.ts:73`
**Fix:** Same `Array.isArray()` guard

### 24. SimulationResultsModal — JSONB cast without Array.isArray (FIXED)
**File:** `app/dashboard/_components/SimulationResultsModal.tsx:192`
**Issue:** `(gaps.recommended_additions as ContentAddition[]).length` — truthiness check passes for `{}`.
**Fix:** `Array.isArray(gaps.recommended_additions) && gaps.recommended_additions.length > 0`

### 25. faq.ts — JSONB cast without Array.isArray (FIXED)
**File:** `app/actions/faq.ts:248`
**Issue:** `(data.faq_cache as unknown as FAQPair[]) ?? []` — if JSONB is non-array, `.map()` crashes.
**Fix:** `Array.isArray(data.faq_cache) ? (...) : []`

### 26. faq.ts — faq_excluded_hashes same pattern (FIXED)
**File:** `app/actions/faq.ts:250`
**Fix:** `Array.isArray(data.faq_excluded_hashes) ? (...) : []`

### 27. VAIOPageClient — res.json() without .ok check (FIXED)
**File:** `app/dashboard/vaio/VAIOPageClient.tsx:137`
**Issue:** `res.json()` throws SyntaxError on non-JSON error responses (502 proxy, HTML error page).
**Fix:** Added `if (!res.ok) return null;` before `.json()`

### 28. SandboxPanel — res.json() before .ok check (FIXED)
**File:** `app/dashboard/_components/SandboxPanel.tsx:114`
**Issue:** `.json()` called before `.ok` check — throws on non-JSON error body.
**Fix:** Check `.ok` first with safe `.json().catch(() => ({}))`, then parse success body separately

### 29. VulnerabilityAlertCard — new Date() on null expires_at (FIXED)
**File:** `app/dashboard/compete/_components/VulnerabilityAlertCard.tsx:33`
**Issue:** `new Date(undefined)` → Invalid Date → `getTime()` returns NaN → arithmetic produces NaN in UI.
**Fix:** `alert.expires_at ? new Date(alert.expires_at) : new Date()` + `isNaN()` guard

### 30. SeatUsageCard — .toFixed() on undefined cents (FIXED)
**File:** `app/dashboard/billing/_components/SeatUsageCard.tsx:70-71`
**Issue:** If `monthly_seat_cost_cents` is undefined, arithmetic produces NaN, `.toFixed(2)` shows "NaN".
**Fix:** `((state.monthly_seat_cost_cents ?? 0) / 100).toFixed(2)`

### 31. InvoiceHistoryCard — amountDue undefined (FIXED)
**File:** `app/dashboard/billing/_components/InvoiceHistoryCard.tsx:64`
**Fix:** `((inv.amountDue ?? 0) / 100).toFixed(2)`

### 32. ClusterInterpretationPanel — sov undefined arithmetic (FIXED)
**File:** `app/dashboard/cluster-map/_components/ClusterInterpretationPanel.tsx:40`
**Issue:** `selfPoint.sov * 100` — `sov` could be undefined, producing NaN in UI.
**Fix:** `Math.round((selfPoint.sov ?? 0) * 100)`

### 33. Menu public page — faq_cache/faq_excluded_hashes JSONB cast (FIXED)
**File:** `app/m/[slug]/page.tsx:355-356`
**Issue:** JSONB casts without Array.isArray() — same pattern as #25.
**Fix:** `Array.isArray(loc?.faq_cache) ? (...) : []`

---

## Patterns Verified SAFE

- `BotActivityCard.tsx` — null guard at line 12 before `.bots.filter()`
- `AuthorityPanel.tsx` — `profile` check before nested access
- `EntityHealthCard.tsx` — null check at line 24
- `lib/services/sov-engine.service.ts:142` — JSON.parse wrapped in try/catch
- `app/dashboard/magic-menus/actions.ts:134` — JSON.parse wrapped in try/catch
- Most `lib/data/*.ts` files — consistent `?? []` fallback on Supabase `.data`
- `GBPLocationCard.tsx` — proper `?.` chaining throughout
- `ai-health-score.service.ts` — division by zero guards on `totalAuditCount` and `totalWeight`
- All fetch `.json()` calls inside `.catch(() => {})` chains — swallowed safely
- `SOV actions JSON.parse` (lines 110, 155) — caller wraps in try/catch

---

## Not Fixed (Low Priority)

- `setTimeout` without cleanup in 18+ components — React 18+ tolerates this
- `useDraftLock` missing channel `.off()` cleanup — listener leak, not a crash
- `billing/actions.ts` using `getAuthContext()` instead of `getSafeAuthContext()` — low crash risk
- 8 unchecked Supabase mutations (fire-and-forget) — silent data loss, not crashes

---

## Summary

| Wave | Fixes | Severity | Category |
|------|-------|----------|----------|
| Wave 1 | 10 | CRITICAL/HIGH | JSONB null, string methods, non-null assertions |
| Wave 2 | 4 | MEDIUM | Component props, clipboard, display strings |
| Wave 3 | 6 | HIGH/MEDIUM | JSON.parse, new URL() try-catch |
| Wave 4 | 13 | HIGH/MEDIUM | Division by zero, Array.isArray(), fetch safety, arithmetic |
| **Total** | **33** | | **across 29 files** |

All 6630 tests pass (427 test files). No regressions.
