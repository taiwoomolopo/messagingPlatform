-- service_role bypasses RLS (row-level checks), but still needs the ordinary Postgres
-- table-level GRANT to access a table at all — those are two separate permission layers.
-- Supabase normally auto-grants this to every table for anon/authenticated/service_role, but
-- that didn't take for this project's tables (confirmed via the exact Postgres error: 42501
-- permission denied, with a hint suggesting this exact GRANT). Setting it explicitly here
-- rather than relying on that default behavior.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- anon/authenticated still need the base SELECT grant for RLS policies (0001/0002) to have
-- anything to filter — RLS restricts rows, it doesn't substitute for the underlying grant.
grant select on all tables in schema public to anon, authenticated;

-- Make sure this applies automatically to any table added in a future migration too, so this
-- gap can't silently reappear.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;
