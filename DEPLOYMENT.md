# Deployment Guide — Laptop → GitHub → Supabase / Vercel / Railway

This walks through going from the zip file to a live, deployed platform: local setup in VS Code,
pushing to GitHub, then deploying each piece to the service it actually belongs on.

Reminder of the split (from the concept doc): the **portal** (Next.js) deploys to **Vercel**.
The **engine** (routing engine + unified API) needs to run continuously, so it does NOT go on
Vercel — it goes on **Railway** (used in this guide; Render or Fly.io work the same way).
**Supabase** holds the database for both.

---

## 0. Prerequisites (install these first if you don't have them)

- **Node.js 20+** — https://nodejs.org (LTS version)
- **Git** — https://git-scm.com
- **VS Code** — https://code.visualstudio.com
- Accounts (all free to start): **GitHub**, **Supabase**, **Vercel**, **Railway**

Check Node and Git are installed:
```bash
node -v
git -v
```

---

## 1. Unzip and open in VS Code

1. Extract `messaging-platform.zip` to `C:\Users\Taiwo\OneDrive\Desktop\Messaging platform`
2. Open VS Code → File → Open Folder → select that folder
3. Open a terminal in VS Code: Terminal → New Terminal

---

## 2. Push it to GitHub first

Do this before touching Supabase/Vercel — every deploy step below connects to this repo.

1. Go to github.com → New repository → name it (e.g. `messaging-platform`) → **do not**
   initialize with a README/license (avoids a merge conflict on first push) → Create
2. In the VS Code terminal, at the project root:
```bash
git init
git add .
git commit -m "Initial scaffold"
git branch -M main
git remote add origin https://github.com/<your-username>/messaging-platform.git
git push -u origin main
```
3. Refresh the GitHub page — you should see all the folders (`apps`, `services`, `supabase`, etc.)

From now on, after any change:
```bash
git add .
git commit -m "describe the change"
git push
```

---

## 3. Supabase — the database

1. supabase.com → New project → pick a name, region (choose one close to Nigeria/Europe for
   lower latency), and a strong database password (save it somewhere)
2. Once it's provisioned: left sidebar → **SQL Editor** → New query
3. Run each migration file **in order** — copy-paste the contents of each into the editor and
   click Run:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_auth_and_pricing.sql`
   - `supabase/migrations/0003_pending_accounts.sql`
   - `supabase/migrations/0004_traffic_rpc.sql`
4. Left sidebar → **Project Settings → API**. Copy these three values, you'll need them below:
   - **Project URL**
   - **anon public** key
   - **service_role** key (⚠️ keep this one secret — it bypasses all security rules; it goes
     on the engine's host only, never in the portal or in GitHub)

---

## 4. Deploy the engine to Railway

1. railway.app → New Project → **Deploy from GitHub repo** → pick your `messaging-platform` repo
2. Railway will ask for a root directory — set it to `services/engine` (this repo has two
   deployable apps in one repo, so each needs to know which folder is its own)
3. Settings → Build:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
4. Settings → Variables — add every variable from `services/engine/.env.example`, filled in:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from Step 3)
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PRICING_COUNTRY`
   - `INFOBIP_BASE_URL`, `INFOBIP_API_KEY` (once you have that account)
   - `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_BASE_URL`
   - `TERMII_API_KEY`, `TERMII_BASE_URL`
   - `INTERNAL_ADMIN_SECRET` — make up a long random string
   - `WEBHOOK_SECRET_INFOBIP`, `WEBHOOK_SECRET_AFRICASTALKING`, `WEBHOOK_SECRET_TERMII` — a
     long random string each (e.g. generate with `openssl rand -hex 24` in your terminal)
   - `TWILIO_WEBHOOK_BASE_URL` — leave this until after your first deploy, see step 4b
5. Deploy. Railway will give you a public URL like `https://messaging-engine-production.up.railway.app`
6. **4b.** Go back to Variables and set `TWILIO_WEBHOOK_BASE_URL` to that exact URL, then
   redeploy (Railway does this automatically when you change a variable)
7. Test it's alive: visit `https://your-engine-url.up.railway.app/health` — should return `{"ok":true}`

### If you're starting on Railway's free plan

Free plan services are serverless — they sleep between requests instead of running
continuously. That's fine for send/portal/admin requests (those are request/response anyway),
but it means the engine can't rely on an in-process timer to keep `provider_metrics` fresh.

Instead, this repo triggers that refresh externally via GitHub Actions (already set up in
`.github/workflows/refresh-metrics.yml`, runs every 10 minutes). Turn it on:

1. GitHub repo → Settings → Secrets and variables → Actions → New repository secret, add:
   - `ENGINE_URL` — your Railway URL from step 5 above
   - `INTERNAL_ADMIN_SECRET` — the same value you set on Railway
2. That's it — the workflow is already committed and will start running on its schedule.
   Check it under the repo's **Actions** tab; you can also click **Run workflow** there to
   trigger it manually and confirm it works.

If you later move to an always-on Railway plan and would rather not depend on GitHub Actions,
set `ENABLE_INTERNAL_SCHEDULER=true` in Railway's variables instead — that switches the engine
back to refreshing metrics on its own internal timer.

---

## 5. Deploy the portal to Vercel

1. vercel.com → Add New → Project → import your `messaging-platform` GitHub repo
2. Vercel will ask for a root directory — set it to `apps/portal`
3. Framework preset should auto-detect as **Next.js**
4. Environment Variables — add:
   - `NEXT_PUBLIC_SUPABASE_URL` — from Step 3
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Step 3 (the anon key, NOT the service role key)
   - `NEXT_PUBLIC_ENGINE_API_URL` — the Railway URL from Step 4
5. Deploy. Vercel gives you a URL like `https://messaging-platform.vercel.app`

---

## 6. Create your platform admin account

1. Visit your deployed portal → **Sign up** → create your own login
2. In Supabase → Authentication → Users, find your user and copy its ID
3. Supabase → SQL Editor:
```sql
insert into platform_admins (user_id) values ('<your-user-id>');
```
4. Visit `/admin` on your deployed portal — you should now see the admin dashboard

---

## 7. Configure Twilio's webhook

Twilio Console → Phone Numbers → your number → Messaging configuration → set the status
callback URL to:
```
https://your-engine-url.up.railway.app/webhooks/twilio
```

(Infobip/Africa's Talking/Termii webhook URLs follow the pattern
`https://your-engine-url.up.railway.app/webhooks/<provider>/<WEBHOOK_SECRET_...>` — set these
in each provider's dashboard once you have those accounts.)

---

## 8. End-to-end test

1. Get your test account active and get an API key (see the engine README's "Getting started"
   section — same steps as local, just pointed at your live Supabase project via
   `npm run create-key` from your laptop, using the same `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
   you put on Railway, in a local `.env`)
2. Send a real test message via `curl` against your Railway URL instead of `localhost:4000`
3. Or: log in to your deployed portal, go to Send, send yourself a message

---

## Local development going forward

You don't need to redeploy to test changes. Run both locally against the same (live) Supabase
project:
```bash
cd services/engine && cp .env.example .env   # fill in the same values as Railway
npm install && npm run dev

# separate terminal
cd apps/portal && cp .env.example .env.local  # NEXT_PUBLIC_ENGINE_API_URL=http://localhost:4000
npm install && npm run dev
```
Push to `main` when ready — Vercel and Railway both auto-redeploy on push by default.
