# Deploy state

Ticked as each task is confirmed done. The `← current` marker is the single next
thing to do.

**Render service URL:** _not set yet_
**Vercel project URL:** _not set yet_

## Phase 1 — Push what's on your machine
- [ ] 1.1 Check what's uncommitted (`git status --short`)  ← current
- [ ] 1.2 Commit and push to `main`

## Phase 2 — Postgres and Django on Render
- [ ] 2.1 Create the Postgres database `postly-db`, copy the Internal Database URL
- [ ] 2.2 Generate a real `SECRET_KEY`
- [ ] 2.3 Create the web service (Root Directory `postly-backend`)
- [ ] 2.4 Set the environment variables
- [ ] 2.5 Deploy, then confirm `/admin/` loads **styled**
- [ ] **GATE** — nothing below is valid until 2.5 passes

## Phase 3 — Give yourself a login
- [ ] 3.1 Create a superuser
- [ ] 3.2 Mark the address verified
- [ ] 3.3 (optional) `seed_sagar` — remember the known password

## Phase 4 — Frontend on Vercel
- [ ] 4.1 Import the repo, Root Directory at repo root
- [ ] 4.2 Set `NEXT_PUBLIC_API_URL`
- [ ] 4.3 Deploy, note the `*.vercel.app` URL

## Phase 5 — Close the loop
- [ ] 5.1 Replace the three placeholder origins on Render
- [ ] 5.2 Redeploy the backend

## Phase 6 — Smoke test the live product
- [ ] 6.1 Log in on the Vercel URL
- [ ] 6.2 Write a post and publish it
- [ ] 6.3 Open the public blog at `/<your-slug>`
- [ ] 6.4 Upload an avatar in Settings
- [ ] 6.5 Subscribe form lands as *Awaiting confirmation*
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