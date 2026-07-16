-- Structured application logs, tagged per account where applicable (account_id is null for
-- platform-wide events with no single owner, e.g. a provider metrics refresh).
create table logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  level text not null check (level in ('info', 'warn', 'error')),
  event text not null,           -- short machine-readable tag, e.g. 'message.send.failed'
  message text not null,
  meta jsonb,                    -- structured extra context (provider, error codes, etc.)
  created_at timestamptz not null default now()
);
create index on logs (account_id, created_at desc);
create index on logs (level, created_at desc);

alter table logs enable row level security;

-- Same pattern as messages/billing_ledger: account members can see their own account's logs
-- (useful for a future "activity log" screen), admins see everything. Only the engine's
-- service-role key writes to this table.
create policy "account members can view their own logs"
  on logs for select
  using (
    is_platform_admin()
    or (
      account_id is not null
      and exists (
        select 1 from account_users
        where account_users.account_id = logs.account_id
        and account_users.user_id = auth.uid()
      )
    )
  );
