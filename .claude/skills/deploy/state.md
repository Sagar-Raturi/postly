# Deploy state

Ticked as each task is confirmed done. The `← current` marker is the single next
thing to do.

**Render service URL:** https://postly-f8ch.onrender.com
**Vercel project URL:** https://postly-acer-b8f4.vercel.app — but the project's Domains page (2026-09-30) lists only `postly-kappa-flame.vercel.app` as the production domain (`acer-b8f4` is the team slug). Check which one `CSRF_TRUSTED_ORIGINS` / `FRONTEND_URL` on Render hold before 7.7.

## Phase 1 — Push what's on your machine
- [x] 1.1 Check what's uncommitted (`git status --short`)
- [x] 1.2 Commit and push to `main` — `d37dc68`, local and `origin/main` in sync, tree clean

## Phase 2 — Postgres and Django on Render
- [x] 2.1 Create the Postgres database `postly-db`, copy the Internal Database URL — confirmed working: `migrate` reports "No migrations to apply", so the schema is already in Postgres
- [x] 2.2 Generate a real `SECRET_KEY`
- [x] 2.3 Create the web service (Root Directory `postly-backend`) — builds clean, 156 static files copied
- [x] 2.4 Set the environment variables — secret key name was misspelled; `DJANGO_ALLOWED_HOSTS` was empty
- [x] 2.5 Deploy, then confirm `/admin/` loads **styled** — confirmed 2026-09-23, admin renders styled at `/admin/login/`
- [x] **GATE PASSED**

## Phase 3 — Give yourself a login
- [x] 3.1 Create a superuser — bootstrapped via a temporary Build Command step + `ADMIN_BOOTSTRAP_PASSWORD`
- [x] 3.2 Mark the address verified — same command wrote the allauth `EmailAddress` row
- [x] 3.3 `seed_sagar` — 8 published posts live in prod. **Its password is still the one in the repo — change it**

## Phase 4 — Frontend on Vercel
- [x] 4.1 Import the repo, Root Directory at repo root
- [x] 4.2 Set `NEXT_PUBLIC_API_URL` — had to be saved as Vercel **Config** (public), not a secret env var
- [x] 4.3 Deploy — frontend reachable 2026-09-23

## Phase 5 — Close the loop

**Vercel now proxies `/api/*` to Render** (`next.config.ts`), so the browser
only ever talks to the Vercel origin. CORS is no longer load-bearing;
`CSRF_TRUSTED_ORIGINS` and `FRONTEND_URL` still are.

- [x] 5.1 Origins on Render — `CSRF_TRUSTED_ORIGINS` + `FRONTEND_URL` set; CORS unneeded behind the proxy
- [x] 5.2 Redeploy — `352857f` live; POST login through proxy returns Django 400
  - **Correction (2026-09-30):** that 400 did *not* prove CSRF works. DRF only
    checked CSRF for signed-in sessions, so anonymous login/signup/reset
    answered the same 400 even with `Origin: https://evil.example`. Fixed by
    `EnforceCsrfMixin` (`postly-backend/accounts/csrf.py`). The real check
    after deploy: a login POST through the proxy with a foreign `Origin`, or
    with no `csrftoken` cookie, must return **403 `CSRF Failed`**; the app's
    own login must still work.

## Phase 6 — Smoke test the live product
- [x] 6.1 Log in on the Vercel URL — confirmed by user; proxy + first-party cookies working
- [x] 6.2 Write a post — first test post written
- [x] 6.3 Open the public blog — `/producttech` renders
- [x] 6.4 Upload an avatar — stored as 512x512 JPEG after the draft() fix (`2ea41e2`); free tier: lost on next Render deploy
- [x] 6.5 Subscribe form lands as *Awaiting confirmation* — confirmed by user 2026-09-28
- [x] **LIVE** — 2026-09-28, on the Vercel and Render URLs

## Phase 7 — Your own domain
Two domains: app domain (DNS on Cloudflare) + blog domain (`*.` wildcard, Vercel nameservers). Registrar: Hostinger/GoDaddy India, paid in INR over UPI — Cloudflare Registrar and USD cards were a problem. App domain: `codomain.in`, bought at Hostinger 2026-09-29, 1-year term (renews ₹899/yr). Blog domain: `codomain.blog` preferred, `codomainblogs.in` fallback — not yet bought, not needed until 7.9.
Stage A — app on its own domain, mail working (blogs stay at `/<slug>`):
- [ ] 7.1 Buy both domains; auto-renew, lock, privacy, 2FA on — `codomain.in` bought; blog domain still to buy
- [x] 7.2 App domain's nameservers → Cloudflare (free) — registry and public resolvers show Cloudflare NS; Cloudflare dashboard "Active" not yet confirmed
  - Cloudflare zone added (Free), Hostinger parking A/CNAME deleted. Assigned NS: `rene.ns.cloudflare.com`, `savanna.ns.cloudflare.com` (replacing `aurora`/`nebula.dns-parking.com`). Hostinger blocked NS changes for the first ~24h after registration; by 2026-09-30 the `.in` registry shows the Cloudflare NS, DNSSEC off. Waiting on Cloudflare to show Active
- [x] 7.3 App domain → Vercel — two CNAMEs (`@` and `www` → `dcbaa0499d45fffd.vercel-dns-017.com`), DNS only. Verified 2026-09-30: `https://www.codomain.in` 200 with a Let's Encrypt cert, `codomain.in` 308 → www, `/sagar` 200, `/api/auth/user/` 401 through the proxy
  - Both added to the Vercel project 2026-09-30. **Main address is `www.codomain.in`**; `codomain.in` 308-redirects to it. So `FRONTEND_URL` / `CSRF_TRUSTED_ORIGINS` = `https://www.codomain.in`
- [x] 7.4 Make the domain configurable — merged in PR #7 (`0a85a10`) with the Postly → Codomain rename; production shows "Codomain" titles 2026-09-30. `BLOG_DOMAIN` stays unset until 7.9
- [x] 7.5 Cloudflare Email Routing: `contact@` → Gmail — enabled 2026-10-01 (3 MX `route1-3.mx.cloudflare.net`, SPF `include:_spf.mx.cloudflare.net`, DKIM `cf2024-1._domainkey`), catch-all left disabled. Test mail arrived but in Gmail spam (new domain + new Gmail + forwarding); no DMARC record yet
- [ ] 7.6 Resend: verify app domain + `mail.` subdomain, DMARC, webhook  ← current
  - `codomain.in` **Verified** in Resend 2026-10-01 (region Tokyo/ap-northeast-1; Receiving off). Records: TXT `resend._domainkey`, CNAME `rsend` → `rsend-apne1.forge.rmta.net`, CNAME `send` → `send.forge.rmta.net` (Resend now uses CNAMEs, not MX+TXT on `send`). Still to do: `mail.codomain.in`, webhook
  - 2026-10-01: `DEFAULT_FROM_EMAIL=Codomain <hello@codomain.in>` added on Render. Signup still 503'd: Render log shows `django.core.mail.backends.smtp` → `TimeoutError` — **`RESEND_API_KEY` was never set on Render**, so it fell back to SMTP (blocked on free tier). Fix: create a sending key scoped to codomain.in, add `RESEND_API_KEY`; then `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_USE_TLS` can go
  - DMARC done early 2026-10-01: `_dmarc.codomain.in` = `v=DMARC1; p=none; rua=mailto:contact@codomain.in` (live). Forwarded test mail now handled (Not spam + Gmail filter)
- [ ] 7.7 Switch Render/Vercel settings, redeploy both, smoke test with a non-Resend address
  - Origin half done 2026-09-30: user set `CSRF_TRUSTED_ORIGINS` (+ `https://www.codomain.in`) and `FRONTEND_URL=https://www.codomain.in` on Render. Logged-out requests can't prove CSRF (DRF skips it for anonymous users) — user to confirm by logging in on www.codomain.in, saving a post edit, and logging out. Mail settings wait for 7.5–7.6
Stage B — blogs on `<slug>.<blog domain>`:
- [ ] 7.8 Host-based routing + blog links (code)
- [ ] 7.9 `*.<blog domain>` on Vercel nameservers, wildcard certificate issued
- [ ] 7.10 HSTS preload: deliberately not submitted

## Phase 8 — Before real writers arrive
- [ ] 8.1 Add the outbox cron job — independent of the domain; do alongside Phase 7
- [ ] 8.2 Verify a sending domain, set the mail variables — done as part of 7.5–7.7
  - Mail now goes over Resend's **HTTPS API** (django-anymail) when `RESEND_API_KEY` is set — Render free blocks SMTP 25/465/587. Until a domain is verified: `DEFAULT_FROM_EMAIL=Codomain <onboarding@resend.dev>`, and Resend only delivers to the Resend account's own address (so other people's signups fail).
- [ ] 8.3 Move off the free tier, turn on backups
- [x] 8.4 Add CI — `.github/workflows/ci.yml`; first green run on `main` at `953c71e` (2026-09-28), after adding `next typegen` before the type-check. Branch protection on `main` not yet confirmed
- [ ] 8.5 Decide the tenant-isolation question