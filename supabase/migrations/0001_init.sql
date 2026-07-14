-- Messaging platform: initial schema
-- Run against a Supabase Postgres project (SQL editor or `supabase db push`).

create extension if not exists "pgcrypto";

-- ============================================================================
-- Accounts (customers of the platform)
-- ============================================================================
create table accounts (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_email text not null unique,
  agreed_rate_per_sms numeric(10, 4) not null,   -- what THIS customer is billed per SMS (e.g. 5.00 NGN)
  currency text not null default 'NGN',
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

-- Links a Supabase Auth user to an account, with a role for that account.
create table account_users (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

-- Platform staff (admin dashboard access) — separate from customer accounts.
create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Providers (the SMS gateways the platform routes through)
-- ============================================================================
create table providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- 'twilio' | 'infobip' | 'africastalking' | 'termii'
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Rolling pricing + performance data per provider, used by the routing engine's scorer.
-- A new row is inserted whenever pricing changes or performance is re-measured, so this
-- doubles as a history table (query the latest row per provider for current state).
create table provider_metrics (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers(id) on delete cascade,
  country_code text,                              -- null = default/global rate
  cost_per_sms numeric(10, 4) not null,            -- actual cost the platform pays
  delivery_rate numeric(5, 4),                     -- 0.0000–1.0000, rolling window
  failure_rate numeric(5, 4),                      -- 0.0000–1.0000, rolling window
  avg_latency_ms integer,
  measured_at timestamptz not null default now()
);
create index on provider_metrics (provider_id, measured_at desc);

-- ============================================================================
-- Senders (Sender IDs / short codes provisioned per account)
-- ============================================================================
create table senders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  label text not null,                 -- e.g. "MyBrand"
  provider_id uuid references providers(id),  -- which provider this sender ID is registered with, if provider-specific
  status text not null default 'active' check (status in ('active', 'pending', 'disabled')),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Messages (every message sent through the platform, API or portal)
-- ============================================================================
create table messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  sender_id uuid references senders(id),
  provider_id uuid references providers(id),      -- which provider actually handled it
  source text not null default 'api' check (source in ('api', 'portal_single', 'portal_blast')),
  to_number text not null,
  body text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed', 'undelivered')),
  provider_message_id text,             -- provider's own message/reference id, for DLR matching
  agreed_cost numeric(10, 4),           -- what the customer is billed for this message
  actual_cost numeric(10, 4),           -- what the platform actually paid the provider
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on messages (account_id, created_at desc);
create index on messages (provider_message_id);

-- Raw delivery report events per message (a message can have multiple status updates).
create table delivery_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  provider_id uuid not null references providers(id),
  raw_status text not null,             -- provider's own status string, unnormalized
  normalized_status text not null
    check (normalized_status in ('sent', 'delivered', 'failed', 'undelivered')),
  raw_payload jsonb,                    -- full webhook payload, for debugging
  received_at timestamptz not null default now()
);

-- ============================================================================
-- Billing ledger — agreed rate vs. actual cost vs. margin, the core of Section 4.3
-- ============================================================================
create table billing_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  provider_id uuid references providers(id),
  agreed_cost numeric(10, 4) not null,
  actual_cost numeric(10, 4) not null,
  margin numeric(10, 4) generated always as (agreed_cost - actual_cost) stored,
  billed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on billing_ledger (account_id, created_at desc);

-- ============================================================================
-- Row Level Security — every account only sees its own data
-- ============================================================================
alter table accounts enable row level security;
alter table account_users enable row level security;
alter table senders enable row level security;
alter table messages enable row level security;
alter table delivery_reports enable row level security;
alter table billing_ledger enable row level security;

-- Helper: is the current auth user a platform admin?
create or replace function is_platform_admin()
returns boolean language sql stable as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

-- Accounts: members see their own account; admins see all.
create policy "account members can view their account"
  on accounts for select
  using (
    is_platform_admin()
    or exists (
      select 1 from account_users
      where account_users.account_id = accounts.id
      and account_users.user_id = auth.uid()
    )
  );

-- Senders / messages / delivery_reports / billing_ledger: scoped by account_id via account_users.
create policy "account members can view their senders"
  on senders for select
  using (
    is_platform_admin()
    or exists (
      select 1 from account_users
      where account_users.account_id = senders.account_id
      and account_users.user_id = auth.uid()
    )
  );

create policy "account members can view their messages"
  on messages for select
  using (
    is_platform_admin()
    or exists (
      select 1 from account_users
      where account_users.account_id = messages.account_id
      and account_users.user_id = auth.uid()
    )
  );

create policy "account members can view their billing ledger"
  on billing_ledger for select
  using (
    is_platform_admin()
    or exists (
      select 1 from account_users
      where account_users.account_id = billing_ledger.account_id
      and account_users.user_id = auth.uid()
    )
  );

-- Note: INSERT/UPDATE on messages, billing_ledger, delivery_reports is done exclusively by the
-- engine service using the Supabase service-role key (bypasses RLS), never by the portal's
-- client-side Supabase key. Only SELECT policies are defined here for the anon/authenticated role.

-- ============================================================================
-- Seed the four initial providers
-- ============================================================================
insert into providers (code, display_name) values
  ('twilio', 'Twilio'),
  ('infobip', 'Infobip'),
  ('africastalking', 'Africa''s Talking'),
  ('termii', 'Termii');
