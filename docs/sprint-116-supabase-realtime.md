# Sprint 116 — Supabase Realtime

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/membership/types.ts`,
> `middleware.ts`, `app/dashboard/layout.tsx`

---

## 🎯 Objective

Build the **Supabase Realtime** layer — presence tracking, draft co-editing locks, cross-user notification toasts, and automatic dashboard refresh when background cron jobs complete.

**What this sprint answers:** "When someone else on my team is editing something, how do I know? And when the AI finishes running, why do I have to manually refresh to see it?"

**What Sprint 116 delivers:**
- `usePresence()` hook — tracks which org members are currently online, using Supabase Realtime Presence
- Team presence indicator in the dashboard header — avatars/initials of currently-online teammates
- `useDraftLock()` hook — soft co-editing lock on `content_drafts` rows; shows "Editing in progress" banner when another user has a draft open
- `draft_locks` table — lightweight lock registry (who is editing what draft, with heartbeat TTL)
- `useRealtimeNotifications()` hook — subscribes to a Supabase channel for org-scoped toast notifications
- `notifyOrg()` server utility — called by any API route to broadcast a notification to all org members
- Auto-refresh: when the SOV cron, audit cron, or content-audit cron completes, it calls `notifyOrg()` which triggers a dashboard data refresh (no manual reload needed)
- `useOrgChannel()` — base hook that manages the Supabase Realtime channel lifecycle (subscribe, cleanup, reconnect)

**What this sprint does NOT build:** full real-time collaborative editing (operational transforms, conflict resolution — future), push notifications to mobile, chat or messaging between team members.

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                                 — All rules (53 rules as of Sprint 115)
Read CLAUDE.md                                   — Full implementation inventory
Read lib/membership/types.ts                     — MemberRole, OrgMember
Read supabase/prod_schema.sql
  § FIND: content_drafts — exact columns, especially id and org_id
  § FIND: organizations — id, name, slug
  § FIND: any existing Supabase Realtime or channel configuration
Read app/dashboard/layout.tsx                    — Dashboard layout to add presence to
Read app/dashboard/_components/                  — Existing dashboard components
Read lib/supabase/client.ts (or similar)         — How browser Supabase client is created
Read lib/supabase/server.ts                      — How server Supabase client is created
Read app/api/cron/                               — All cron routes — add notifyOrg() calls
Read lib/supabase/database.types.ts             — All current types
Read src/__fixtures__/golden-tenant.ts           — All existing fixtures
```

**Specifically understand before writing code:**

1. **Supabase Realtime client initialization.** The browser Supabase client (`createBrowserClient`) must be initialized once per app, not per hook. Read how `lib/supabase/client.ts` currently creates the browser client. All hooks must reuse the same client instance — do not call `createClient()` inside every hook. Use a singleton pattern or a React context provider.

2. **Supabase Realtime channel naming convention.** All org-scoped channels follow the pattern `org:{org_id}`. Presence is tracked on a sub-channel or via the presence API of the same channel. Read the Supabase Realtime docs pattern: one channel per org, multiple listeners on it.

3. **Presence vs Broadcast vs Postgres Changes.** Sprint 116 uses all three:
   - **Presence**: who is online right now (usePresence)
   - **Broadcast**: one-time notifications (useRealtimeNotifications)
   - **Postgres Changes**: listen to `content_drafts` changes for lock state (useDraftLock)
   This distinction matters for how each hook subscribes.

4. **Draft locks are soft, not hard.** `draft_locks` is a heartbeat table — the client writes a lock on draft open, refreshes it every 30 seconds, and removes it on unmount. If the heartbeat stops (tab closed, crash), the lock expires via a TTL. There is NO hard enforcement — two users can technically edit simultaneously. The lock is a courtesy warning only.

5. **`notifyOrg()` runs server-side.** It uses the Supabase service role client to broadcast a message to the org's Realtime channel. This is called from API routes (cron completions, invite accepted) — never from the browser directly.

6. **Cron routes already exist.** Read `app/api/cron/` to find the SOV cron, audit cron, and content-audit cron. Add `notifyOrg()` calls at the END of each cron route, after all work is done. Do not change any existing cron logic.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/realtime/
  index.ts                      — barrel export
  types.ts                      — PresenceUser, DraftLock, RealtimeNotification, NotificationPayload
  channel-manager.ts            — Singleton channel registry (one channel per org per browser tab)
  notify-org.ts                 — Server-side broadcast utility

hooks/
  useOrgChannel.ts              — Base hook: channel lifecycle management
  usePresence.ts                — Who is online in the org
  useDraftLock.ts               — Soft co-editing lock for content_drafts
  useRealtimeNotifications.ts   — Toast notification subscriber
  useAutoRefresh.ts             — DOM event → data refetch bridge

app/dashboard/
  _components/
    PresenceAvatars.tsx          — Online team member indicators in header
    RealtimeNotificationToast.tsx — Toast renderer for realtime notifications
    DraftLockBanner.tsx          — "Someone is editing this draft" warning

app/api/cron/
  sov/route.ts                  — MODIFY: add notifyOrg() on completion
  audit/route.ts                — MODIFY: add notifyOrg() on completion
  content-audit/route.ts        — MODIFY: add notifyOrg() on completion
```

---

### Component 1: Types — `lib/realtime/types.ts`

```typescript
import type { MemberRole } from '@/lib/membership/types';

/**
 * A user currently present in the org's Realtime channel.
 * Tracked via Supabase Presence.
 */
export interface PresenceUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: MemberRole;
  // Page the user is currently viewing (optional — for future routing awareness)
  current_page: string;
  // ISO timestamp of when they joined the channel
  online_at: string;
}

/**
 * A soft draft lock entry.
 * Written to draft_locks table on draft open, removed on close.
 */
export interface DraftLock {
  id: string;
  draft_id: string;       // references content_drafts.id
  org_id: string;
  user_id: string;
  user_email: string;     // denormalized for display
  user_name: string | null;
  locked_at: string;
  expires_at: string;     // locked_at + 90 seconds (3 heartbeat cycles)
}

/**
 * A realtime notification broadcast to all org members.
 */
export type NotificationEventType =
  | 'cron_sov_complete'
  | 'cron_audit_complete'
  | 'cron_content_audit_complete'
  | 'member_joined'           // someone accepted an invitation
  | 'member_removed'          // someone was removed
  | 'draft_published'         // content draft approved
  | 'hallucination_detected'; // new hallucination found by audit

export interface NotificationPayload {
  event: NotificationEventType;
  message: string;            // human-readable, shown in toast
  // Optional: trigger a data refresh for specific dashboard sections
  refresh_keys?: string[];    // e.g. ['sov', 'hallucinations', 'team']
  // Optional: link to navigate to
  action_url?: string;
  action_label?: string;
  // Timestamp for deduplication
  sent_at: string;
}

export interface RealtimeNotification extends NotificationPayload {
  id: string;  // client-generated UUID for toast key
  received_at: string;
}

/**
 * Channel names follow a consistent pattern.
 * All org-scoped channels: 'org:{org_id}'
 */
export function buildOrgChannelName(orgId: string): string {
  return `org:${orgId}`;
}

export const DRAFT_LOCK_TTL_SECONDS = 90;
export const DRAFT_LOCK_HEARTBEAT_INTERVAL_MS = 30_000; // 30s
export const PRESENCE_CLEANUP_DELAY_MS = 5_000; // 5s grace before removing presence
export const MAX_VISIBLE_PRESENCE_AVATARS = 5;
export const MAX_NOTIFICATIONS_QUEUE = 10;
```

---

### Component 2: Migration — `supabase/migrations/[timestamp]_draft_locks.sql`

```sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 116: Supabase Realtime — Draft Locks
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. draft_locks table (heartbeat-based soft locks)
CREATE TABLE IF NOT EXISTS public.draft_locks (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id     uuid         NOT NULL REFERENCES public.content_drafts(id) ON DELETE CASCADE,
  org_id       uuid         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id      uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email   text         NOT NULL,
  user_name    text,
  locked_at    timestamptz  NOT NULL DEFAULT NOW(),
  expires_at   timestamptz  NOT NULL DEFAULT (NOW() + INTERVAL '90 seconds'),
  -- One active lock per draft per user
  UNIQUE (draft_id, user_id)
);

COMMENT ON TABLE public.draft_locks IS
  'Soft co-editing lock registry for content_drafts. Sprint 116. '
  'Client writes lock on draft open, refreshes heartbeat every 30s, '
  'removes on unmount. Expired locks (expires_at < NOW()) are soft-deleted '
  'by the query pattern — no cron needed. Locks are advisory only.';

CREATE INDEX IF NOT EXISTS idx_draft_locks_draft_id
  ON public.draft_locks (draft_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_draft_locks_org_id
  ON public.draft_locks (org_id);

-- 2. RLS
ALTER TABLE public.draft_locks ENABLE ROW LEVEL SECURITY;

-- All org members can read locks (to show the "editing" banner)
CREATE POLICY "draft_locks: org members can read"
  ON public.draft_locks FOR SELECT
  USING (org_id = public.current_user_org_id());

-- Any org member can insert their own lock
CREATE POLICY "draft_locks: user can insert own lock"
  ON public.draft_locks FOR INSERT
  WITH CHECK (
    org_id = public.current_user_org_id()
    AND user_id = auth.uid()
  );

-- User can only update their own lock (heartbeat refresh)
CREATE POLICY "draft_locks: user can update own lock"
  ON public.draft_locks FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND user_id = auth.uid()
  );

-- User can delete own lock; owner/admin can delete any lock (force-unlock)
CREATE POLICY "draft_locks: user or admin can delete"
  ON public.draft_locks FOR DELETE
  USING (
    org_id = public.current_user_org_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id  = public.current_user_org_id()
          AND om.user_id = auth.uid()
          AND om.role    IN ('owner', 'admin')
      )
    )
  );

-- Service role full access
CREATE POLICY "draft_locks: service role full access"
  ON public.draft_locks
  USING (auth.role() = 'service_role');

-- 3. Enable Realtime for draft_locks (Postgres Changes listener)
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_locks;

-- 4. Enable Realtime for content_drafts if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'content_drafts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_drafts;
  END IF;
END $$;
```

---

### Component 3: Channel Manager — `lib/realtime/channel-manager.ts`

```typescript
/**
 * 'use client'
 * Singleton channel registry for the browser.
 * Ensures one Supabase Realtime channel per org per browser tab.
 * Prevents duplicate subscriptions when multiple hooks mount.
 *
 * Module-level state (Map) — shared across all imports in one browser tab.
 * This is intentional and correct for Next.js App Router client components.
 *
 * acquireOrgChannel(supabase, orgId): RealtimeChannel
 *   Increments ref count. Returns existing channel or creates new one.
 *   New channels are created with:
 *     supabase.channel('org:{orgId}', {
 *       config: {
 *         presence: { key: orgId },
 *         broadcast: { self: false },
 *       }
 *     })
 *   Channel is subscribed on first acquire.
 *
 * releaseOrgChannel(supabase, orgId): void
 *   Decrements ref count. When count reaches 0:
 *   supabase.removeChannel(channel) and remove from registry.
 *
 * getOrgChannel(orgId): RealtimeChannel | undefined
 *   Read-only lookup. Used internally.
 */
```

---

### Component 4: Base Hook — `hooks/useOrgChannel.ts`

```typescript
/**
 * 'use client'
 * Base hook that manages channel lifecycle for a single org.
 * All other realtime hooks call this hook.
 *
 * useOrgChannel(orgId: string | null): RealtimeChannel | null
 *
 * - If orgId is null: return null immediately (no channel)
 * - On mount: acquireOrgChannel(supabase, orgId)
 * - On unmount: releaseOrgChannel(supabase, orgId)
 * - Returns the channel or null if CHANNEL_ERROR
 *
 * Channel subscription errors are logged as warnings.
 * The hook never throws — all errors degrade to null channel.
 */
```

---

### Component 5: Presence Hook — `hooks/usePresence.ts`

```typescript
/**
 * 'use client'
 *
 * usePresence(orgId: string, currentUser: PresenceUser): {
 *   onlineUsers: PresenceUser[];   // other users online (self excluded)
 *   isSubscribed: boolean;
 * }
 *
 * On mount:
 *   channel.track({ ...currentUser })
 *   channel.on('presence', { event: 'sync' }, handler)
 *   channel.on('presence', { event: 'join' }, handler)
 *   channel.on('presence', { event: 'leave' }, handler)
 *
 * On sync: flatten presenceState, deduplicate by user_id (latest online_at wins),
 *   exclude currentUser.user_id, set onlineUsers.
 *
 * On unmount: channel.untrack()
 *
 * Pure helper (exported for testing):
 *   deduplicatePresenceUsers(
 *     state: Record<string, PresenceUser[]>,
 *     excludeUserId: string
 *   ): PresenceUser[]
 *   Returns deduplicated array sorted by online_at ASC.
 */
```

---

### Component 6: Draft Lock Hook — `hooks/useDraftLock.ts`

```typescript
/**
 * 'use client'
 *
 * useDraftLock(draftId: string, orgId: string, currentUser: {
 *   user_id: string; email: string; full_name: string | null;
 * }): {
 *   activeLocks: DraftLock[];
 *   othersEditing: DraftLock[];
 *   hasConflict: boolean;
 *   acquireLock: () => Promise<void>;
 *   releaseLock: () => Promise<void>;
 * }
 *
 * Lifecycle:
 * 1. Mount → acquireLock() (UPSERT into draft_locks)
 * 2. setInterval(acquireLock, 30_000) — heartbeat
 * 3. Postgres Changes listener on draft_locks WHERE draft_id = $draftId
 *    On change → re-fetch: SELECT * WHERE draft_id=$draftId AND expires_at > NOW()
 * 4. Unmount → releaseLock() (DELETE) + clearInterval
 *
 * othersEditing = activeLocks.filter(l => l.user_id !== currentUser.user_id)
 * hasConflict = othersEditing.length > 0
 *
 * Lock acquire failure: log warning, do NOT throw. Edit continues.
 */
```

---

### Component 7: Notifications Hook — `hooks/useRealtimeNotifications.ts`

```typescript
/**
 * 'use client'
 *
 * useRealtimeNotifications(orgId: string): {
 *   notifications: RealtimeNotification[];
 *   dismissNotification: (id: string) => void;
 *   clearAll: () => void;
 * }
 *
 * On mount:
 *   channel.on('broadcast', { event: 'notification' }, (payload) => {
 *     const notif = { ...payload.payload, id: crypto.randomUUID(), received_at: ... }
 *     // Dedup: skip if same event + sent_at already seen
 *     // Cap: keep only last MAX_NOTIFICATIONS_QUEUE (10)
 *     // If refresh_keys present: dispatch 'localvector:refresh' CustomEvent
 *     setNotifications(prev => [notif, ...prev].slice(0, 10))
 *   })
 *
 * Auto-dismiss: per-notification setTimeout(8000) → dismissNotification(id)
 *   Clear timeout on manual dismiss or unmount.
 *
 * Dedup tracking: Set<`${event}:${sent_at}`> — module-level or ref.
 */
```

---

### Component 8: Auto Refresh Hook — `hooks/useAutoRefresh.ts`

```typescript
/**
 * 'use client'
 *
 * useAutoRefresh(keys: string[], onRefresh: () => void): void
 *
 * Listens for 'localvector:refresh' CustomEvent on window.
 * Calls onRefresh() when event.detail.keys includes any of `keys`.
 *
 * useEffect cleanup removes the event listener.
 * onRefresh should be wrapped in useCallback at the call site to be stable.
 *
 * Never call window outside useEffect (SSR safety).
 */
```

---

### Component 9: Server Notify Utility — `lib/realtime/notify-org.ts`

```typescript
/**
 * Server-side only. Uses service role client.
 * Never import in browser code.
 *
 * notifyOrg(orgId: string, payload: NotificationPayload): Promise<void>
 *   Broadcasts via supabase.channel('org:{orgId}').send({
 *     type: 'broadcast', event: 'notification', payload
 *   })
 *   Never throws. On error: console.warn only.
 *
 * buildCronNotification(
 *   event: NotificationEventType,
 *   message: string,
 *   refresh_keys: string[]
 * ): NotificationPayload
 *   Pure factory. Sets sent_at = new Date().toISOString().
 */
```

---

### Component 10: Cron Route Updates

Add to each cron, fire-and-forget, at end of successful completion block:

**`app/api/cron/sov/route.ts`** — read file first to find orgId variable name:
```typescript
void notifyOrg(orgId, buildCronNotification(
  'cron_sov_complete',
  'AI visibility scan complete. Your scores have been updated.',
  ['sov', 'visibility_analytics']
));
```

**`app/api/cron/audit/route.ts`**:
```typescript
void notifyOrg(orgId, buildCronNotification(
  'cron_audit_complete',
  'Hallucination audit complete. New results are ready.',
  ['hallucinations']
));
```

**`app/api/cron/content-audit/route.ts`**:
```typescript
void notifyOrg(orgId, buildCronNotification(
  'cron_content_audit_complete',
  'Content audit complete. Review the latest recommendations.',
  ['content_drafts', 'page_audits']
));
```

Rules: `void` only — never await. Change nothing else. If cron loops over orgs, call inside the loop per org.

---

### Component 11: PresenceAvatars — `app/dashboard/_components/PresenceAvatars.tsx`

```typescript
/**
 * 'use client'
 * Props: { orgId: string; currentUser: PresenceUser }
 * Uses usePresence(orgId, currentUser).
 *
 * Renders up to MAX_VISIBLE_PRESENCE_AVATARS (5) avatar circles in dashboard header.
 * Each shows user initials on a deterministic background color:
 *   AVATAR_COLORS = ['bg-indigo-500','bg-violet-500','bg-emerald-500',
 *                    'bg-amber-500','bg-rose-500','bg-cyan-500'] (static array)
 *   colorIndex = sumOfCharCodes(user_id) % AVATAR_COLORS.length
 * Overflow: "+N" circle when more than 5.
 * Tooltip: title="{full_name} ({role})"
 * Hidden when onlineUsers.length === 0.
 * Hidden when channel is null (Realtime degraded).
 *
 * data-testid: "presence-avatars", "presence-avatar-{userId}", "presence-overflow-count"
 */
```

---

### Component 12: DraftLockBanner — `app/dashboard/_components/DraftLockBanner.tsx`

```typescript
/**
 * 'use client'
 * Props: { draftId: string; orgId: string; currentUser: {...} }
 * Uses useDraftLock().
 *
 * Only renders when hasConflict = true.
 * "⚠️ {name} is currently editing this draft. Your changes may conflict."
 * Multiple: "⚠️ {name1} and {n} others are editing this draft."
 * Amber warning bar above the draft editor.
 *
 * data-testid: "draft-lock-banner", "draft-lock-user-name"
 */
```

---

### Component 13: RealtimeNotificationToast — `app/dashboard/_components/RealtimeNotificationToast.tsx`

```typescript
/**
 * 'use client'
 * Props: { orgId: string }
 * Uses useRealtimeNotifications(orgId).
 *
 * Fixed bottom-right, z-50. Max 3 toasts visible at once.
 * Each toast: icon (by event type) + message + optional [View →] + [✕].
 * Event icons:
 *   cron_*   → 🔄
 *   member_* → 👋
 *   hallucination_detected → ⚠️
 *   draft_published → ✅
 * [View →] navigates to action_url and dismisses.
 * [✕] dismisses.
 * Fade-out CSS transition on dismiss.
 *
 * data-testid: "notification-toast-container", "notification-toast-{id}",
 *   "notification-toast-dismiss-{id}", "notification-toast-action-{id}"
 */
```

---

### Component 14: Dashboard Layout Update — `app/dashboard/layout.tsx`

```typescript
/**
 * MODIFY to add:
 * 1. <PresenceAvatars> in the header right side (before user avatar/menu)
 * 2. <RealtimeNotificationToast> once at the root level
 *
 * Both are 'use client' — wrap in a client boundary if the layout is a server component.
 * orgId: read from existing session resolution in the layout.
 * currentUser for PresenceAvatars: build from session.user + org_members role lookup.
 * Minimize changes — only add these two components.
 */
```

---

### Component 15: Golden Tenant Fixtures

```typescript
// Sprint 116 — realtime fixtures
import type { PresenceUser, DraftLock, RealtimeNotification } from '@/lib/realtime/types';

export const MOCK_PRESENCE_USER_OWNER: PresenceUser = {
  user_id: 'golden-user-id',
  email: 'aruna@charcoalnchill.com',
  full_name: 'Aruna Babu',
  role: 'owner',
  current_page: '/dashboard',
  online_at: '2026-03-01T10:00:00.000Z',
};

export const MOCK_PRESENCE_USER_ADMIN: PresenceUser = {
  user_id: 'mock-admin-user-id',
  email: 'admin@charcoalnchill.com',
  full_name: 'Test Admin',
  role: 'admin',
  current_page: '/dashboard/content',
  online_at: '2026-03-01T10:05:00.000Z',
};

export const MOCK_DRAFT_LOCK: DraftLock = {
  id: 'lock-001',
  draft_id: 'draft-golden-001',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  user_id: 'mock-admin-user-id',
  user_email: 'admin@charcoalnchill.com',
  user_name: 'Test Admin',
  locked_at: '2026-03-01T10:05:00.000Z',
  expires_at: '2026-03-01T10:06:30.000Z',
};

export const MOCK_NOTIFICATION_SOV_COMPLETE: RealtimeNotification = {
  id: 'notif-001',
  event: 'cron_sov_complete',
  message: 'AI visibility scan complete. Your scores have been updated.',
  refresh_keys: ['sov', 'visibility_analytics'],
  action_url: '/dashboard/visibility',
  action_label: 'View Scores',
  sent_at: '2026-03-01T10:10:00.000Z',
  received_at: '2026-03-01T10:10:01.000Z',
};

export const MOCK_NOTIFICATION_MEMBER_JOINED: RealtimeNotification = {
  id: 'notif-002',
  event: 'member_joined',
  message: 'newmember@example.com has joined your organization.',
  refresh_keys: ['team'],
  sent_at: '2026-03-01T09:00:00.000Z',
  received_at: '2026-03-01T09:00:01.000Z',
};
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/realtime-types.test.ts`

```
describe('buildOrgChannelName — pure')
  1.  'a0eebc99-...' → 'org:a0eebc99-...'
  2.  always prefixed with 'org:'

describe('deduplicatePresenceUsers — pure (exported from usePresence.ts)')
  3.  deduplicates by user_id — one entry per user
  4.  takes latest online_at per user_id
  5.  sorts by online_at ASC (longest-online first)
  6.  excludes the given excludeUserId from results
  7.  handles empty state → returns []
  8.  handles multiple presences per channel key (multiple tabs)
```

**8 tests.**

---

### Test File 2: `src/__tests__/unit/notify-org.test.ts`

```
describe('buildCronNotification — pure')
  1.  returns NotificationPayload with correct event type
  2.  sent_at is a valid ISO string
  3.  refresh_keys correctly included

describe('notifyOrg — Supabase service role mocked')
  4.  calls supabase.channel() with 'org:{orgId}'
  5.  calls .send() with type='broadcast', event='notification'
  6.  payload matches the NotificationPayload argument
  7.  does NOT throw when Supabase broadcast fails
  8.  uses service role client (not user-scoped)
```

**8 tests.**

---

### Test File 3: `src/__tests__/unit/use-presence.test.ts`

**Supabase Realtime mocked via vi.mock.**

```
describe('usePresence — Supabase Realtime mocked')
  1.  initializes with empty onlineUsers
  2.  calls channel.track() with currentUser on mount
  3.  calls channel.untrack() on unmount
  4.  updates onlineUsers on 'presence' sync event
  5.  excludes currentUser from onlineUsers list
  6.  deduplicates multiple tabs for same user
  7.  handles 'join' event → user added
  8.  handles 'leave' event → user removed
  9.  returns isSubscribed=false when channel is null
  10. does not crash when channel status is CHANNEL_ERROR
```

**10 tests.**

---

### Test File 4: `src/__tests__/unit/use-draft-lock.test.ts`

**Supabase mocked.**

```
describe('useDraftLock — Supabase mocked')
  1.  calls UPSERT into draft_locks on mount
  2.  sets heartbeat interval on mount
  3.  calls DELETE from draft_locks on unmount
  4.  clears heartbeat interval on unmount
  5.  othersEditing excludes currentUser's own lock
  6.  hasConflict = true when another user has active lock
  7.  hasConflict = false when only current user has lock
  8.  filters out expired locks (expires_at < NOW())
  9.  lock acquire failure does NOT throw (advisory)
  10. Postgres Changes event triggers re-fetch of active locks
```

**10 tests.**

---

### Test File 5: `src/__tests__/unit/use-realtime-notifications.test.ts`

**Supabase Realtime mocked.**

```
describe('useRealtimeNotifications — Supabase Realtime mocked')
  1.  initializes with empty notifications
  2.  adds notification on broadcast 'notification' event
  3.  assigns unique id to each received notification
  4.  caps at MAX_NOTIFICATIONS_QUEUE (10)
  5.  dismissNotification(id) removes correct item
  6.  clearAll() empties array
  7.  deduplicates: same event + sent_at ignored on repeat
  8.  dispatches 'localvector:refresh' CustomEvent when refresh_keys present
  9.  CustomEvent detail.keys matches payload refresh_keys
  10. auto-dismiss: notification removed after 8 seconds
```

**10 tests.**

---

### Test File 6: `src/__tests__/unit/use-auto-refresh.test.ts`

```
describe('useAutoRefresh — DOM event')
  1.  calls onRefresh when event keys match component keys
  2.  does NOT call onRefresh when keys don't match
  3.  any match in keys array triggers refresh
  4.  removes event listener on unmount
  5.  stable callback — does not re-add listener on every render
```

**5 tests.**

---

### Test File 7: `src/__tests__/e2e/realtime.spec.ts` — Playwright

```
1.  Presence avatars visible with online teammates
2.  No presence avatars when solo (no other users)
3.  Overflow count "+N" when > 5 online
4.  Draft lock banner shown when hasConflict=true
5.  Draft lock banner hidden when no conflict
6.  Notification toast appears on SOV cron complete broadcast
7.  Toast action button navigates and dismisses
8.  Toast dismiss button removes toast
9.  Auto-refresh: SOV data refetches on 'localvector:refresh' event with keys=['sov']
```

**9 Playwright tests.**

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/realtime-types.test.ts               # 8 tests
npx vitest run src/__tests__/unit/notify-org.test.ts                   # 8 tests
npx vitest run src/__tests__/unit/use-presence.test.ts                 # 10 tests
npx vitest run src/__tests__/unit/use-draft-lock.test.ts               # 10 tests
npx vitest run src/__tests__/unit/use-realtime-notifications.test.ts   # 10 tests
npx vitest run src/__tests__/unit/use-auto-refresh.test.ts             # 5 tests
npx vitest run                                                           # ALL — zero regressions
npx playwright test src/__tests__/e2e/realtime.spec.ts                 # 9 Playwright tests
npx tsc --noEmit                                                         # 0 type errors
```

**Total: 51 Vitest + 9 Playwright = 60 tests**

---

## 📂 Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/realtime/types.ts` | **CREATE** | All types, constants, buildOrgChannelName() |
| 2 | `lib/realtime/channel-manager.ts` | **CREATE** | Singleton channel registry with ref counting |
| 3 | `lib/realtime/notify-org.ts` | **CREATE** | Server-side broadcast + buildCronNotification() |
| 4 | `lib/realtime/index.ts` | **CREATE** | Barrel export |
| 5 | `hooks/useOrgChannel.ts` | **CREATE** | Base channel lifecycle hook |
| 6 | `hooks/usePresence.ts` | **CREATE** | Online user tracking + deduplicatePresenceUsers() |
| 7 | `hooks/useDraftLock.ts` | **CREATE** | Soft lock: UPSERT + heartbeat + Postgres Changes |
| 8 | `hooks/useRealtimeNotifications.ts` | **CREATE** | Broadcast listener + auto-dismiss + dedup |
| 9 | `hooks/useAutoRefresh.ts` | **CREATE** | DOM event → refetch bridge |
| 10 | `app/dashboard/_components/PresenceAvatars.tsx` | **CREATE** | Online teammate avatars |
| 11 | `app/dashboard/_components/DraftLockBanner.tsx` | **CREATE** | Co-editing warning banner |
| 12 | `app/dashboard/_components/RealtimeNotificationToast.tsx` | **CREATE** | Toast stack |
| 13 | `app/dashboard/layout.tsx` | **MODIFY** | Add PresenceAvatars + NotificationToast |
| 14 | `app/api/cron/sov/route.ts` | **MODIFY** | void notifyOrg() at completion |
| 15 | `app/api/cron/audit/route.ts` | **MODIFY** | void notifyOrg() at completion |
| 16 | `app/api/cron/content-audit/route.ts` | **MODIFY** | void notifyOrg() at completion |
| 17 | `supabase/migrations/[timestamp]_draft_locks.sql` | **CREATE** | Table + RLS + publication |
| 18 | `supabase/prod_schema.sql` | **MODIFY** | Append draft_locks |
| 19 | `lib/supabase/database.types.ts` | **MODIFY** | Add draft_locks types |
| 20 | `supabase/seed.sql` | **MODIFY** | Comment only (no seed for ephemeral table) |
| 21 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 4 realtime fixtures |
| 22 | `src/__tests__/unit/realtime-types.test.ts` | **CREATE** | 8 tests |
| 23 | `src/__tests__/unit/notify-org.test.ts` | **CREATE** | 8 tests |
| 24 | `src/__tests__/unit/use-presence.test.ts` | **CREATE** | 10 tests |
| 25 | `src/__tests__/unit/use-draft-lock.test.ts` | **CREATE** | 10 tests |
| 26 | `src/__tests__/unit/use-realtime-notifications.test.ts` | **CREATE** | 10 tests |
| 27 | `src/__tests__/unit/use-auto-refresh.test.ts` | **CREATE** | 5 tests |
| 28 | `src/__tests__/e2e/realtime.spec.ts` | **CREATE** | 9 Playwright tests |

**Total: 28 files**

---

## 🚫 What NOT to Do

1. **DO NOT create a Supabase client inside hooks** — reuse the existing singleton from `lib/supabase/client.ts`. Multiple clients = duplicate connections and presence conflicts.

2. **DO NOT `await notifyOrg()`** in cron routes — always `void`. Broadcast is fire-and-forget. The cron response must not wait for it.

3. **DO NOT use Postgres Changes for presence** — presence (who is online) uses Supabase Realtime Presence API exclusively. Postgres Changes is only for `draft_locks` table events.

4. **DO NOT hard-block edits on lock conflict** — draft locks are advisory. `hasConflict = true` shows a warning banner. The editor remains fully functional. Never gate a save action on lock state.

5. **DO NOT let `useDraftLock` throw on acquire failure** — log a warning. The edit proceeds. Locking is best-effort.

6. **DO NOT call `window` outside `useEffect`** — SSR safety. `useAutoRefresh` and `useRealtimeNotifications` must only touch `window` inside `useEffect`.

7. **DO NOT create more than one channel per org per tab** — enforce via `acquireOrgChannel()` / `releaseOrgChannel()`. Never call `supabase.channel()` directly in hooks.

8. **DO NOT use dynamic Tailwind class construction for avatar colors** (AI_RULES §12) — `AVATAR_COLORS` is a static array of full class strings. Index deterministically.

9. **DO NOT edit `middleware.ts`** (AI_RULES §6). No middleware changes in Sprint 116.

10. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

11. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.

---

## ✅ Definition of Done

- [ ] `lib/realtime/types.ts` — PresenceUser, DraftLock, NotificationEventType (7 values), NotificationPayload, RealtimeNotification, buildOrgChannelName(), all 5 constants
- [ ] `channel-manager.ts` — module-level Map + ref count Map, acquireOrgChannel() + releaseOrgChannel()
- [ ] `notify-org.ts` — notifyOrg() (never throws), buildCronNotification() (pure)
- [ ] `useOrgChannel` — acquire on mount, release on unmount, null on error
- [ ] `usePresence` — track/untrack, sync/join/leave handlers, deduplicatePresenceUsers() exported, self excluded
- [ ] `useDraftLock` — UPSERT on mount, 30s heartbeat, DELETE on unmount, Postgres Changes listener, expired locks filtered, advisory-only (never throws)
- [ ] `useRealtimeNotifications` — broadcast listener, dedup, 10-item cap, auto-dismiss 8s, dispatches `localvector:refresh` CustomEvent with refresh_keys
- [ ] `useAutoRefresh` — DOM event listener, key matching, stable cleanup
- [ ] `PresenceAvatars` — max 5 avatars, overflow, deterministic color (static array), title tooltip, hidden when empty
- [ ] `DraftLockBanner` — shows only on hasConflict, amber, correct user names
- [ ] `RealtimeNotificationToast` — fixed bottom-right, max 3 visible, icon by event type, action + dismiss, fade-out
- [ ] `app/dashboard/layout.tsx` MODIFIED — PresenceAvatars in header, RealtimeNotificationToast at root
- [ ] All 3 cron routes MODIFIED — `void notifyOrg(...)` added, existing logic unchanged
- [ ] Migration: draft_locks table, 5 RLS policies, `ALTER PUBLICATION supabase_realtime ADD TABLE draft_locks`
- [ ] prod_schema.sql updated
- [ ] database.types.ts updated
- [ ] golden-tenant.ts: 4 realtime fixtures
- [ ] `npx vitest run ...` — **51 Vitest tests passing**
- [ ] `npx playwright test ...` — **9 Playwright tests passing**
- [ ] `npx vitest run` — ALL tests, zero regressions
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 54 written
- [ ] roadmap.md Sprint 116 marked ✅

---

## ⚠️ Edge Cases

1. **User opens two tabs** — two tab instances each have their own channel (module state is per-tab). Presence will show the user twice in raw state. `deduplicatePresenceUsers()` collapses to one entry per user_id. Correct behavior.

2. **Draft lock heartbeat missed (network blip)** — lock expires after 90s. Next successful heartbeat (30s interval) re-acquires. Other users see banner for up to 90s after network loss. Acceptable for advisory lock.

3. **Realtime disconnects and reconnects** — Supabase auto-reconnects. Presence re-syncs on 'sync' event. Postgres Changes listener re-attaches. No manual reconnect code needed.

4. **SOV cron loops over 50 orgs** — `notifyOrg()` called once per org inside the loop. 50 fire-and-forget calls. Minimal overhead.

5. **`ALTER PUBLICATION supabase_realtime ADD TABLE`** — may fail in some local dev environments. Log error and proceed — presence and broadcast still work. Only Postgres Changes for draft_locks is affected.

6. **`localvector:refresh` CustomEvent in SSR** — `useAutoRefresh` is a client hook inside `useEffect`. Window is never accessed at import or render time. Safe.

7. **Notification received during channel subscription handshake** — may be missed (Supabase doesn't buffer broadcast). Acceptable — notifications are best-effort. Dashboard data always accessible manually.

---

## 🔮 AI_RULES Update (Add Rule 54)

```markdown
## 54. ⚡ Supabase Realtime in `lib/realtime/` + `hooks/` (Sprint 116)

* **One channel per org per tab:** acquireOrgChannel() / releaseOrgChannel()
  from channel-manager.ts. Never call supabase.channel() directly in hooks.
* **Three channel features:**
  - Presence: usePresence() → who is online
  - Broadcast: useRealtimeNotifications() → server → client notifications
  - Postgres Changes: useDraftLock() → live lock state
* **notifyOrg() never throws.** `void notifyOrg(...)` in all call sites.
  Never await in a response path.
* **Draft locks are advisory.** Never block edits or saves on hasConflict.
  useDraftLock() failures are silent warnings.
* **deduplicatePresenceUsers() excludes self.** Export this for testing.
* **useAutoRefresh pattern:** 'localvector:refresh' CustomEvent with
  detail.keys. Dashboard sections listen independently. Decoupled.
* **Client-only hooks:** usePresence, useDraftLock, useRealtimeNotifications,
  useAutoRefresh must only appear in 'use client' components.
```

---

## 🗺️ What Comes Next

**Sprint 117 — Retention & Onboarding + Weekly Digest Email:** Sample data mode for new users (no empty dashboard on first login), guided tour completion tracking, onboarding interstitial polish, and the complete weekly digest email template (SOV trends + occasion alerts + content recommendations) that has been a scaffold since the initial codebase.
