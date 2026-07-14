-- providers, provider_metrics, and platform_admins were never given RLS policies in
-- 0001_init.sql — fine as long as Supabase's "expose new tables" setting is off, but this
-- closes the gap regardless of that project setting. These tables should only ever be read via
-- the engine's service-role key (which bypasses RLS entirely), never by the portal's anon/
-- authenticated client — provider identity and cost data must stay hidden from customers
-- (see Section 2.5 of the concept doc).

alter table providers enable row level security;
alter table provider_metrics enable row level security;
alter table platform_admins enable row level security;

-- No select/insert/update policies are created for the anon/authenticated roles on purpose —
-- with RLS enabled and zero policies, every row is denied by default to those roles. The
-- engine's service-role key still has full access, since RLS doesn't apply to it.
