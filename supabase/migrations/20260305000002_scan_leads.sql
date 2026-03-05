-- ---------------------------------------------------------------------------
-- scan_leads — viral scanner email capture (Sprint P2-7b)
--
-- Insert-only from server action using service role (bypasses RLS).
-- No client-facing policies — public cannot read or update.
-- ---------------------------------------------------------------------------

create table public.scan_leads (
  id            uuid        primary key default gen_random_uuid(),
  email         text        not null,
  business_name text        not null,
  scan_status   text        not null check (scan_status in ('fail', 'pass', 'not_found')),
  created_at    timestamptz not null default now()
);

-- Enable RLS — no policies added = deny all client access.
-- Service role bypasses RLS, so server action inserts still work.
alter table public.scan_leads enable row level security;
