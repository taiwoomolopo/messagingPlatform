-- A business signing up doesn't have a negotiated rate yet — that's set by an admin at
-- approval time (see POST /v1/admin/accounts/:id/approve). Relax the NOT NULL so signup can
-- create the account row before that happens.
alter table accounts alter column agreed_rate_per_sms drop not null;
