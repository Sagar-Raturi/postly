# Deploy state

Ticked as each task is confirmed done. The `← current` marker is the single next
thing to do.

**Render service URL:** https://postly-f8ch.onrender.com
**Vercel project URL:** https://postly-acer-b8f4.vercel.app

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
- [x] 5.2 Redeploy — `352857f` live; POST login through proxy returns Django 400 (not CSRF 403)

## Phase 6 — Smoke test the live product
- [x] 6.1 Log in on the Vercel URL — confirmed by user; proxy + first-party cookies working
- [x] 6.2 Write a post — first test post written
- [x] 6.3 Open the public blog — `/producttech` renders
- [x] 6.4 Upload an avatar — stored as 512x512 JPEG after the draft() fix (`2ea41e2`); free tier: lost on next Render deploy
- [ ] 6.5 Subscribe form lands as *Awaiting confirmation*  ← current
- [ ] **LIVE**

## Phase 7 — Your own domain
- [ ] 7.1 Make the domain configurable (3 files + 3 tests)
- [ ] 7.2 Point DNS through Cloudflare, add CAA
- [ ] 7.3 Update every origin setting, redeploy both
- [ ] 7.4 HSTS preload: deliberately not submitted

## Phase 8 — Before real writers arrive
- [ ] 8.1 Add the outbox cron job
- [ ] 8.2 Verify a sending domain, set the mail variables
- [ ] 8.3 Move off the free tier, turn on backups
- [ ] 8.4 Add CI
- [ ] 8.5 Decide the tenant-isolation question