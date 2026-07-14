-- Adds: API key auth for the engine, and a manual cost override per provider
-- (used as a fallback when a provider has no live pricing API to poll).

-- ============================================================================
-- API keys — one account can have multiple (e.g. for rotation)
-- ============================================================================
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  key_prefix text not null,          -- first few chars of the raw key, shown in UI so users can
                                      -- tell keys apart without ever re-seeing the full value
  key_hash text not null unique,     -- sha256 hash of the full raw key — the raw key itself is
                                      -- never stored, only ever shown once at creation time
  label text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index on api_keys (key_hash) where status = 'active';

alter table api_keys enable row level security;

create policy "account members can view their own api keys"
  on api_keys for select
  using (
    is_platform_admin()
    or exists (
      select 1 from account_users
      where account_users.account_id = api_keys.account_id
      and account_users.user_id = auth.uid()
    )
  );

-- Note: creating/revoking keys goes through the engine's service-role key (see
-- src/scripts/createApiKey.ts), not directly from the portal — the portal only ever reads
-- key_prefix/label/status, never key_hash.

-- ============================================================================
-- Manual cost override per provider
-- ============================================================================
-- Most providers (Infobip, Africa's Talking, Termii) don't expose a public live pricing API,
-- so cost has to be entered/updated manually when a provider changes their rates. Twilio does
-- have a pricing API (see adapters/twilio.ts getCost), so this column is only used as its
-- fallback if that call fails.
alter table providers add column manual_cost_per_sms numeric(10, 4);

comment on column providers.manual_cost_per_sms is
  'Admin-entered cost per SMS, used by the metrics refresh job for providers without a live pricing API, and as a fallback for providers that do have one.';
