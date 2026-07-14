# Messaging Platform

SMS-first messaging aggregation platform. Unified API for customers, smart routing across
multiple SMS providers (Twilio, Infobip, Africa's Talking, Termii — extensible to more), a
customer web portal, and an admin dashboard.

See `/mnt/user-data/outputs/SMS_Platform_Concept.docx` (the working concept doc) for the full
product write-up. This repo is the code scaffold that implements it.

**Deploying this to GitHub, Supabase, Vercel, and Railway? See `DEPLOYMENT.md` for the full
step-by-step.** The rest of this file covers running everything locally.

## Structure

```
messaging-platform/
├── services/
│   └── engine/          # Unified API + routing engine (Node.js, always-on service)
│       ├── src/
│       │   ├── adapters/    # One file per SMS provider, all implementing ProviderAdapter
│       │   ├── routing/     # Scoring + provider selection logic
│       │   ├── routes/      # Express routes: send, reports, webhooks
│       │   ├── db/          # Supabase client + queries
│       │   └── types/       # Shared TypeScript types
│       └── .env.example
├── apps/
│   └── portal/           # Next.js customer + admin portal (deploys to Vercel)
├── supabase/
│   └── migrations/       # SQL schema (accounts, senders, messages, billing ledger, etc.)
└── README.md
```

## Why this split

- **`services/engine`** is a persistent Node.js service (deploy to Railway / Fly.io / Render).
  It owns the routing engine, provider adapters, webhook ingestion, and the customer-facing
  REST API. This does NOT run on Vercel — the routing engine needs to hold state and process
  webhooks continuously, which Vercel's serverless functions aren't built for.
- **`apps/portal`** is the Next.js customer + admin dashboard, deployed on Vercel. It talks to
  the engine's API and to Supabase directly for reads (via RLS-scoped queries).
- **`supabase`** holds the Postgres schema: accounts, senders, messages, provider configs,
  pricing/performance history, and the billing ledger (agreed rate vs. actual cost vs. margin).

## Getting started (local)

### 1. Supabase
Create a Supabase project, then run the migration in `supabase/migrations/0001_init.sql`
against it (via the SQL editor or `supabase db push`).

### 2. Engine (routing engine + API)
```bash
cd services/engine
cp .env.example .env   # fill in Supabase + provider credentials
npm install
npm run dev
```

The routing engine won't have anything to score until `provider_metrics` has data. Set a
starting cost for each provider you're not yet live on (Infobip, Africa's Talking, Termii have
no public pricing API, so this is manual):
```sql
update providers set manual_cost_per_sms = 4.50 where code = 'infobip';
update providers set manual_cost_per_sms = 4.20 where code = 'africastalking';
update providers set manual_cost_per_sms = 3.90 where code = 'termii';
-- twilio pulls live pricing automatically via its Pricing API (see src/adapters/twilio.ts)
```
Then trigger a metrics refresh so `provider_metrics` gets its first row per provider:
```bash
npm run job:metrics
```
This also runs automatically on startup and every `METRICS_REFRESH_INTERVAL_MS` (default 5 min)
while the engine is running.

### 3. Issue an API key for a customer account
Customers authenticate to `/v1/messages` with a Bearer API key, not a Supabase session. Create
an account row first (directly in Supabase, or once the admin portal screen exists), then:
```bash
npm run create-key -- <accountId> "some label"
```
This prints the raw key once — store it, it can't be retrieved again (only its hash is kept).

### 4. Bootstrap your first platform admin
There's no self-service way to become a platform admin (intentionally). After creating your
own login via the portal's signup form (or directly in Supabase Auth), add yourself:
```sql
insert into platform_admins (user_id) values ('<your-supabase-auth-user-id>');
```
Find your user id in Supabase → Authentication → Users.

### 5. Portal
```bash
cd apps/portal
cp .env.example .env.local
npm install
npm run dev
```

## How an account actually gets from signup to sending

1. A business signs up at `/signup` → creates a Supabase Auth user, then calls the engine's
   `POST /v1/signup`, which creates an `accounts` row with `status = 'pending_approval'` and no
   agreed rate yet.
2. You (as a platform admin) log in at `/admin`, see it under **Pending sign-ups**, set their
   agreed rate per SMS, and approve — this flips `status` to `'active'`.
3. They can now log in at `/login` and use `/dashboard` — send, blast, pull reports, manage
   senders. All of it (portal and API) authenticates and prices identically, since both paths
   go through the same `sendMessage` service on the engine.

Admin can also skip step 1 entirely and provision an account directly (`POST /v1/admin/accounts`
with a rate included creates it pre-activated) — this is the "we create an account for a
business that signed up through us directly" path from Section 4.2 of the concept doc.

## Connecting this to GitHub

From inside this folder on your machine:
```bash
git init
git add .
git commit -m "Initial scaffold: engine, portal, supabase schema"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```
(Create the empty repo on GitHub first, without a README/license, so there's no merge conflict
on first push.)

## Status

Both `services/engine` (`tsc --noEmit`) and `apps/portal` (`next build`) compile clean as of
this scaffold.

**Done:**
- Unified send API (`/v1/messages`, API-key auth) and portal send (`/v1/portal/messages`,
  `/v1/portal/messages/blast`), both going through one shared `sendMessage` service so pricing
  and routing behave identically regardless of entry point
- Routing/scoring engine, all four provider adapters (send + delivery-report parsing)
- Scheduled job refreshing each provider's real delivery/failure rate (from message history)
  and cost (live for Twilio, manual entry for the rest) into `provider_metrics`
- Webhook ingestion with verification: real HMAC signature check for Twilio, secret-path-segment
  check for the other three (see `src/middleware/webhookVerification.ts` for why the split)
- Self-signup → pending account → admin approval (sets pricing) → active, plus direct
  admin-provisioned account creation
- Admin dashboard: approve sign-ups, view all accounts/users, total platform traffic, cost/margin
  breakdown
- Customer portal: login, signup, traffic overview with delivery/failure rate, single send,
  blast send, CSV report export, sender request/list

**Not done / known gaps — worth tackling before this goes anywhere near production:**
- **Nothing has been tested against a real provider account.** Every adapter's request/response
  shape is my best reading of each provider's public docs, not confirmed against a live sandbox.
  Do this before trusting any of it.
- **Blast sending is synchronous** — a large recipient list ties up one HTTP request for the
  whole send. Fine for testing, wrong for real volume; move it to a background queue
  (see the comment in `src/routes/portal.ts`) before using it for real campaigns.
- **`provider_metrics` needs real seed data** — the scorer has nothing to rank until at least
  one metrics row exists per provider (`manual_cost_per_sms` + running `npm run job:metrics`
  gets you started; see step 2 in Getting Started).
- No rate limiting anywhere (API, portal, or blast) — someone with a valid key could currently
  send unlimited volume in a loop.
- No account-level sender ID approval workflow beyond a status field — a sender request from
  the portal sits at `status = 'pending'` with nothing currently reviewing or activating it.
- Portal has no styling system — it's plain inline styles to keep the scaffold's logic clear;
  a real design pass is a separate piece of work.
- Admin bootstrap is manual SQL (see step 4 above) — fine for one or two admins, not a real
  admin-invite flow.

