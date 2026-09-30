# Postly deploy runbook

Django + Next.js, first deploy. Eight phases from your laptop to a URL you can
open on your phone. Phases 1-6 get you live on free hosting; 7 and 8 are for when
real writers show up.

## Contents

- [Phase 0 — Where you're starting from](#phase-0--where-youre-starting-from)
- [Phase 1 — Push what's on your machine](#phase-1--push-whats-on-your-machine)
- [Phase 2 — Postgres and Django on Render](#phase-2--postgres-and-django-on-render)
- [Phase 3 — Give yourself a login](#phase-3--give-yourself-a-login)
- [Phase 4 — Frontend on Vercel](#phase-4--frontend-on-vercel)
- [Phase 5 — Close the loop](#phase-5--close-the-loop)
- [Phase 6 — Smoke test the live product](#phase-6--smoke-test-the-live-product)
- [Phase 7 — Your own domain](#phase-7--your-own-domain)
- [Phase 8 — Before real writers arrive](#phase-8--before-real-writers-arrive)

---

## Phase 0 — Where you're starting from

| | |
|---|---|
| repo | `github.com/Sagar-Raturi/postly` · branch `main` |
| backend | Django 5.2 + DRF in `postly-backend/` — gunicorn, WhiteNoise, psycopg and `DATABASE_URL` already wired |
| frontend | Next.js App Router at the repo root |
| checked | `manage.py check --deploy` passes clean against `config.settings.prod` |
| routing | Blogs serve at `/<slug>` today — no wildcard DNS or wildcard certificate needed for this deploy |

---

## Phase 1 — Push what's on your machine

**~5 min**

Render and Vercel build from GitHub, not from your disk. The deployment prep —
WhiteNoise, the overridable `MEDIA_ROOT`, media serving under `DEBUG=False` — is
currently uncommitted, and so is the dashboard sidebar. None of it would ship.

### 1.1 Check what's uncommitted

```bash
git status --short
```

Expect the three backend files plus the dashboard changes. Confirm `db.sqlite3`
and `.env` are **not** listed — they're gitignored, and they should stay that way.

### 1.2 Commit and push to `main`

```bash
git add -A
git commit -m "prepare for first production deploy"
git push origin main
```

Review the `git add -A` result before committing — it's broad, and a stray secret
is much harder to remove once it's on GitHub.

---

## Phase 2 — Postgres and Django on Render

**~25 min**

Render gives you all four things this app needs in one place: a web service,
managed Postgres, cron jobs for the email outbox, and a disk for uploaded
avatars. Do the backend first — the frontend can't be configured until you know
its URL.

### 2.1 Create the Postgres database

New → Postgres. Name it `postly-db`. When it's ready, copy the **Internal
Database URL** — the internal one, not the external: it's faster and doesn't
leave Render's network.

### 2.2 Generate a real `SECRET_KEY`

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Keep this out of the repo. It only ever lives in Render's environment settings.

### 2.3 Create the web service

New → Web Service → connect `Sagar-Raturi/postly`. The settings that matter:

| Field | Value |
| --- | --- |
| Root Directory | `postly-backend` |
| Runtime | Python |
| Build Command | `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate` |
| Start Command | `gunicorn config.wsgi:application` |

Root Directory is the one people miss. Without it Render looks for
`requirements.txt` at the repo root, where there isn't one.

### 2.4 Set the environment variables

`config/settings/prod.py` deliberately has no defaults — it raises on anything
missing, so a half-configured deploy fails loudly instead of running insecurely.

| Variable | Value |
| --- | --- |
| PYTHON_VERSION | `3.14` — matches what requirements.txt is pinned against |
| DJANGO_SETTINGS_MODULE | `config.settings.prod` |
| DJANGO_SECRET_KEY | the value you just generated |
| DATABASE_URL | the Internal Database URL |
| DJANGO_ALLOWED_HOSTS | your `*.onrender.com` hostname |
| CORS_ALLOWED_ORIGINS | `https://example.com` — placeholder, fixed in phase 5 |
| CSRF_TRUSTED_ORIGINS | `https://example.com` — same |
| FRONTEND_URL | `https://example.com` — same |
| ACCOUNT_DEFAULT_HTTP_PROTOCOL | `https` |
| EMAIL_HOST | `smtp.resend.com` |
| EMAIL_PORT | `587` |
| EMAIL_USE_TLS | `True` |

The three placeholder origins are a chicken-and-egg fix: the backend needs the
frontend's URL, and the frontend needs the backend's. You'll replace them in
phase 5. `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` default to empty, so you can
leave them unset until phase 8 — phase 3 gets you a login without sending any mail.

### 2.5 Deploy, then open `/admin/`

The check that matters: the admin login page must render **styled**. Unstyled CSS
means `collectstatic` or WhiteNoise didn't run, and you want to find that now
rather than after DNS is in play.

> **Free tier, two limits.** A free web service spins down after 15 minutes idle
> and takes about a minute to wake — the first request after a pause looks like a
> hang but isn't. Free Postgres holds 1 GB and *expires 30 days after creation*,
> with a 14-day grace period. Fine for a first look; put the database on a paid
> plan before you keep anything you care about.

> **Free services can't attach a disk.** Uploaded avatars land on the container
> filesystem, which is rebuilt on every deploy — they will disappear. Posts and
> accounts are safe in Postgres. When you upgrade, attach a disk and point
> `DJANGO_MEDIA_ROOT` at its mount path.

> ### GATE
> Don't continue until `https://<your-service>.onrender.com/admin/` loads with
> styling. Everything after this assumes a working API.

---

## Phase 3 — Give yourself a login

**~10 min**

This is the step that traps people. `ACCOUNT_EMAIL_VERIFICATION` is `"mandatory"`,
so a fresh signup cannot log in until its address is verified — and you have no
working outbound mail yet. Create the account server-side instead and mark it
verified directly.

### 3.1 Create a superuser

```bash
python manage.py createsuperuser
```

Run this from Render's Shell tab. If your plan doesn't include shell access,
temporarily append it to the Build Command using `--noinput` with
`DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_DISPLAY_NAME` and
`DJANGO_SUPERUSER_PASSWORD` set, deploy once, then remove it.

### 3.2 Mark the address verified

```bash
python manage.py shell -c "
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
u = get_user_model().objects.get(email='you@example.com')
EmailAddress.objects.update_or_create(
    user=u, email=u.email,
    defaults={'verified': True, 'primary': True})
print('verified:', u.email)"
```

Swap in your own address. `createsuperuser` doesn't create the allauth
`EmailAddress` row that login checks, which is why this second command exists.

### 3.3 Optional — seed a populated blog to look at

```bash
python manage.py seed_sagar
```

Creates a writer with ten posts, eight published. Useful for seeing a
real-looking blog in production rather than an empty state.

> **Its password is in your repo.** The seed account uses a known password.
> Change it or delete the account before you give the URL to anyone.

---

## Phase 4 — Frontend on Vercel

**~10 min**

Same repository, root directory this time. Vercel detects Next.js on its own; the
only thing it needs from you is where the API lives.

### 4.1 Import the repo, leave Root Directory at the repo root

The Next.js app is at the top level — `src/app/`. Don't point it at
`postly-backend`.

### 4.2 Set `NEXT_PUBLIC_API_URL`

```
NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com/api
```

Include the `/api` suffix and no trailing slash — that's the shape `.env.example`
documents.

> **`NEXT_PUBLIC_*` is baked in at build time.** It isn't read at runtime, so
> changing this value later means triggering a fresh deploy, not just saving the
> setting.

### 4.3 Deploy and note your `*.vercel.app` URL

Expect API calls to fail at this point — the backend is still trusting a
placeholder origin. That's phase 5.

---

## Phase 5 — Close the loop

**~5 min**

Now that both halves have URLs, point the backend at the real frontend. Postly
authenticates with a session cookie, so all three of these have to agree or login
fails in confusing ways.

### 5.1 Replace the placeholder origins on Render

| Variable | Value |
| --- | --- |
| CORS_ALLOWED_ORIGINS | `https://<project>.vercel.app` |
| CSRF_TRUSTED_ORIGINS | `https://<project>.vercel.app` |
| FRONTEND_URL | `https://<project>.vercel.app` |

Scheme included, no trailing slash. Leave `SESSION_COOKIE_DOMAIN` unset — the two
halves are on unrelated domains for now, and a scoped cookie would only cause
problems.

### 5.2 Redeploy the backend

Environment changes need a restart to take effect.

---

## Phase 6 — Smoke test the live product

**~10 min**

In this order — each one exercises a different piece, so the first failure tells
you where to look.

### 6.1 Log in on the Vercel URL

Proves CORS, CSRF and the session cookie all line up. A 403 on login is almost
always `CSRF_TRUSTED_ORIGINS`.

### 6.2 Write a post and publish it

Proves the database is writable and autosave is reaching the API.

### 6.3 Open the public blog at `/<your-slug>`

Proves server-side rendering can reach the API, which is a different network path
from the browser's calls.

### 6.4 Upload an avatar in Settings

Proves `MEDIA_ROOT` is writable and `/media/` is being served.

### 6.5 Turn subscriptions on and submit the subscribe form

The row should land in `/dashboard/subscribers` as *Awaiting confirmation*. It
stays there until phase 8 — no mail is going out yet, and that's expected.

> ### YOU'RE LIVE
> A real URL, on real infrastructure, that you can open on your phone and build
> features against.

---

## Phase 7 — Your own domain

**~2 hours of work, spread over a day or two of waiting on DNS**

Two domains, not one. Writers publish their own HTML, so blogs must not share a
registrable domain with the dashboard — the same split GitHub makes between
`github.com` and `github.io`. It is also what settles 8.5.

| | Example | Serves | DNS lives at |
| --- | --- | --- | --- |
| App domain | `yourapp.com` | homepage, login, dashboard, `/api/*` (proxied to Render) | Cloudflare (free) |
| Blog domain | `yourblogs.com` | `*.yourblogs.com` — one subdomain per writer | Vercel nameservers |

There is no `api.` subdomain: `next.config.ts` proxies `/api/*` to Render, so
the browser only ever talks to the app domain and every cookie stays
first-party. Keep it that way.

Two stages. **Stage A** (7.1–7.7) puts the app on its own domain with working
mail and needs no code beyond 7.4 — blogs keep serving at `yourapp.com/<slug>`.
**Stage B** (7.8–7.9) moves blogs to `<slug>.yourblogs.com` and needs code
first.

### Tools and services

| Service | For | Cost |
| --- | --- | --- |
| Registrar — Hostinger India (or GoDaddy India) | Buying both domains in INR over UPI | ~₹800–1,500 per domain per year; check the *renewal* price |
| Cloudflare (free plan) | DNS for the app domain, Email Routing for `contact@` | ₹0 |
| Vercel (existing, Hobby) | Serves both domains, issues the HTTPS certificates | ₹0 |
| Render (existing) | Only environment variables change | ₹0 |
| Resend (free plan) | Sending mail — 3 domains, 3,000/month, **100/day** | ₹0 until the daily cap bites; Pro is $20/month |
| Gmail (existing) | Inbox for `contact@`, via forwarding and "Send mail as" | ₹0 |
| An authenticator app | 2FA on the registrar, Cloudflare and Resend | ₹0 |
| dnschecker.org, mail-tester.com | Watching DNS spread; scoring a test email | ₹0 |

Not needed: the registrar's email, hosting, "SSL certificate" or site-builder
add-ons, Google Workspace, Cloudflare Registrar (bills in USD only).

### 7.1 Buy both domains

At the registrar: search, add both to the cart, remove every add-on, pay by UPI.
Buying 2–3 years up front avoids a failed renewal payment — an expired domain
takes every writer's blog offline. Then in the registrar account: auto-renew
**on**, domain/transfer lock **on**, WHOIS privacy **on**, 2FA **on**.

Register with a free work Gmail (separate from your personal one), and keep it
as the registrar's login and recovery address for good — never move it to an
address *on the domain*. If the domain ever lapses or its DNS breaks, mail to
that address stops arriving, including the renewal warnings and the password
reset you would need to fix it. The same Gmail is where 7.5 forwards `contact@`.

### 7.2 Put the app domain's DNS on Cloudflare

1. Cloudflare dashboard → **Add a domain** → `yourapp.com` → **Free** plan.
2. Cloudflare shows two nameservers (`xxx.ns.cloudflare.com`). At the registrar,
   replace its nameservers with those two.
3. Wait for Cloudflare to mark the domain **Active** — minutes to a few hours.
   Nothing below works until then.

Every record added in Cloudflare below is **DNS only (grey cloud)**, never
proxied. Vercel and Resend both need to see the real traffic.

### 7.3 Point the app domain at Vercel

1. Vercel → project → **Settings → Domains** → add `yourapp.com`, plus `www`.
   One of the two becomes the main address and the other 308-redirects to it;
   Vercel's default makes `www` the main one, which is fine. Whichever is main
   is the exact origin `FRONTEND_URL` and `CSRF_TRUSTED_ORIGINS` must use in 7.7.
2. Copy the records Vercel's domain card shows into Cloudflare — an `A` record
   for `@` and a `CNAME` for `www`. Use the card's values, not ones from a blog
   post.
3. Wait for both to show **Valid Configuration** with a certificate issued, then
   open `https://yourapp.com` and log in.

Skip CAA records for now. They are optional, and a wrong one stops certificates
issuing or renewing.

### 7.4 Make the domain configurable (code)

`postly.com` is hardcoded in `blog/models.py` (`Site.domain`),
`blog/onboarding.py` and `src/app/layout.tsx` (`metadataBase`), and three tests
assert on it. Replace it with a setting before 7.7, or the dashboard shows every
writer an address that doesn't resolve.

### 7.5 Receiving mail — `contact@yourapp.com`

1. Cloudflare → `yourapp.com` → **Email → Email Routing** → enable. Let it add
   its MX and SPF records.
2. Add a destination address (your Gmail) and click the link Cloudflare emails
   there.
3. Routing rule: `contact@yourapp.com` → that Gmail.
4. Send a test from another account; it should land in Gmail.

To *reply* as `contact@`: Gmail → Settings → Accounts → **Send mail as** → add
`contact@yourapp.com`, SMTP server `smtp.resend.com`, port `465` (SSL), username
`resend`, password a separate Resend API key with **Sending access** only —
created after 7.6 verifies the domain, entered in Gmail by you, stored nowhere
else.

### 7.6 Sending mail — verify two domains in Resend

Account mail and subscriber mail go out on separate domains, so readers marking
one writer's posts as spam cannot push password-reset mail into junk.

| Resend domain | Sends | Render variable |
| --- | --- | --- |
| `yourapp.com` | Verification, password reset | `DEFAULT_FROM_EMAIL=Postly <hello@yourapp.com>` |
| `mail.yourapp.com` | New-post mail to subscribers | `SUBSCRIPTION_FROM_EMAIL=Postly <posts@mail.yourapp.com>` |

1. Resend → **Domains → Add domain** for each. Region: pick the one nearest the
   Render service.
2. Copy every record Resend lists (DKIM `TXT`, the `send` subdomain's `MX` and
   SPF `TXT`) into Cloudflare. They live on subdomains, so they don't collide
   with Email Routing's records on the apex.
3. Add one DMARC record: `TXT` at `_dmarc` →
   `v=DMARC1; p=none; rua=mailto:contact@yourapp.com`. Tighten `p=` to
   `quarantine` after a few weeks of clean reports.
4. Click **Verify** on both. Then send one real email to the address
   mail-tester.com gives you and aim for 9/10 or better.
5. Webhook: Resend → **Webhooks** → endpoint
   `https://yourapp.com/api/webhooks/resend/`, events `email.bounced` and
   `email.complained`. Put its signing secret in `RESEND_WEBHOOK_SECRET` on
   Render. The endpoint refuses every request without it, by design.

### 7.7 Switch the settings over, redeploy both

Render (web service **and** the 8.1 cron job, which shares its environment):

| Variable | Value |
| --- | --- |
| `FRONTEND_URL` | `https://yourapp.com` |
| `CSRF_TRUSTED_ORIGINS` | `https://yourapp.com,https://<project>.vercel.app` — keep the old one until nobody uses it |
| `DEFAULT_FROM_EMAIL` / `SUBSCRIPTION_FROM_EMAIL` | from 7.6 |
| `RESEND_WEBHOOK_SECRET` | from 7.6 |
| `POSTLY_POSTAL_ADDRESS` | a real postal address, PO box or mail-forwarding address (CAN-SPAM) |

`DJANGO_ALLOWED_HOSTS` does **not** change — requests still arrive at the
Render host through the proxy. Leave `SESSION_COOKIE_DOMAIN` unset so the
session cookie stays host-only on the app domain.

Vercel: `NEXT_PUBLIC_CONTACT_EMAIL=contact@yourapp.com`. `NEXT_PUBLIC_API_URL`
stays `/api` and `POSTLY_API_ORIGIN` stays the Render URL. `NEXT_PUBLIC_` values
are baked in at build time, so redeploy after changing them.

Smoke test: sign up with an address that is **not** the Resend account's, click
the verification link, reset the password, subscribe to a blog from a third
address. Then update the placeholder table in `CLAUDE.md` and bump
`LEGAL_UPDATED` in `src/lib/operator.ts`.

**Stage A done: Postly is launchable.**

### 7.8 Blogs on their own domain (code first)

Before any DNS: middleware that rewrites `<slug>.yourblogs.com/...` to the
existing `/[siteSlug]/...` routes, and every blog link built from
`FRONTEND_URL` (`blog/emails.py`, `Site.domain`, the dashboard's "view blog")
switched to the blog domain. Old `yourapp.com/<slug>` URLs redirect to the new
ones. Set `NEXT_PUBLIC_MARKETING_URL=https://yourapp.com` so a blog's "Published
with Postly" credit points home.

### 7.9 Wire the blog domain to Vercel

1. Vercel → **Settings → Domains** → add `*.yourblogs.com` (and `yourblogs.com`,
   redirecting to the app's homepage).
2. Vercel switches the domain to its own nameservers and lists them. At the
   registrar, set the blog domain's nameservers to those. A wildcard
   certificate needs Vercel to answer DNS challenges; this is the simplest way.
3. When the wildcard shows **Valid Configuration**, open two writers' blogs on
   their subdomains in a private window.

The blog domain sends and receives no mail.

### 7.10 Hold off on HSTS preload

`prod.py` already sets `SECURE_HSTS_PRELOAD`, which is harmless. *Submitting* to
the preload list is the irreversible part — don't, until wildcard TLS actually
works, or every future subdomain must serve valid HTTPS forever.

---

## Phase 8 — Before real writers arrive

**pre-launch**

None of this blocks your own testing. All of it blocks other people using the
product.

### 8.1 Add the outbox cron job

```bash
python manage.py send_pending_post_emails
```

A Render Cron Job on `* * * * *`, root directory `postly-backend`, same
environment as the web service. Until this exists, publishing a post queues mail
into `PostEmail` that never sends — and it fails silently, which is the worst kind.

### 8.2 Verify a sending domain and set the mail variables

Covered step by step in 7.5–7.7. Mail goes over Resend's HTTPS API
(django-anymail) when `RESEND_API_KEY` is set — Render's free tier blocks SMTP —
so `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` are not needed on Render. Until a
domain is verified, Resend only delivers to the Resend account's own address, so
nobody else can finish signing up.

### 8.3 Move off the free tier and turn on backups

A paid web service stops the spin-down and lets you attach the disk that keeps
avatars. A paid database stops the 30-day clock. Enable Postgres backups the same
day.

### 8.4 Add CI before you have users

You have roughly a dozen backend test files and nothing running them. A GitHub
Actions workflow on `pytest`, or `pytest` in Render's build command, stops a red
test from reaching production.

### 8.5 Decide the tenant-isolation question

Blogs currently share an origin with the dashboard, which is why
`blog/sanitize.py` exists. Before strangers can publish HTML on your domain, move
tenant sites to a separate registrable domain — or serve the API under the app's
own host so the session cookie stays host-only.

---

*Built against the repo as of the session that produced this runbook. Line
references point at `Sagar-Raturi/postly` on `main`.*