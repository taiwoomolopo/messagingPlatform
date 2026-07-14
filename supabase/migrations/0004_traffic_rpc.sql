-- Used by GET /v1/admin/traffic to break total platform traffic down by account.
create or replace function messages_per_account()
returns table (account_id uuid, business_name text, message_count bigint)
language sql stable as $$
  select a.id as account_id, a.business_name, count(m.id) as message_count
  from accounts a
  left join messages m on m.account_id = a.id
  group by a.id, a.business_name
  order by message_count desc;
$$;
