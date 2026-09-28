@AGENTS.md

# Postly

A multi-tenant blogging platform. Writers sign up, get one blog at `/{siteSlug}` (moving to `{slug}.postly.com` in "Phase 3"), write in a TipTap editor, and readers can subscribe by email.

Two apps in one repo:

| | Where | Stack |
| --- | --- | --- |
| Frontend | repo root (`src/`) | Next.js 16.3 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui (on `@base-ui/react`), Framer Motion, TipTap v3 |
| Backend | `postly-backend/` | Django 5.2 + DRF, django-allauth + dj-rest-auth, SQLite locally / Postgres via `DATABASE_URL`, Python 3.14 |

Deploy target: Vercel (frontend) + Render (backend). The `deploy` skill in `.claude/skills/deploy/` holds the runbook and current deploy state — use it for anything deploy-related.

The long-form docs are `README.md` (frontend) and `postly-backend/README.md` (backend, full API table). Read the relevant section before changing auth, theming, the public API or the editor.

## Commands

```bash
# Frontend (repo root) — http://localhost:3000
npm run dev
npm run build
npm run lint

# Backend (postly-backend/, venv at postly-backend/.venv) — http://localhost:8000
python manage.py migrate
python manage.py seed_sagar            # demo writer: sagar@example.com / postly1234, blog at /sagar
python manage.py seed_dummy_posts      # filler; --count 15 crosses the 20/page boundary, --delete removes
python -u manage.py runserver 8000     # -u so console emails show when backgrounded
python manage.py verification_link [email] [--reset]   # print verify/reset links
python manage.py send_pending_post_emails              # drains the subscriber-mail outbox (cron in prod)
pytest                                  # run from postly-backend/
```

`.claude/launch.json` has preview configs: `postly-dev` (Next), `postly-api` / `postly-api-venv` (Django). Both servers must be running for the app to work.

Dev email uses the console backend — verification/reset links print in the `runserver` terminal.

## Frontend layout

- `src/app/(app)/` — Postly itself: marketing homepage, auth flows (`login`, `signup`, `verify-email`, `forgot-password`, `reset-password/[token]`, `onboarding`), and `dashboard/` (posts, `posts/[id]` editor, `settings`, `subscribers`). Its `layout.tsx` owns `AuthProvider` + `ThemeProvider`.
  Also `privacy/` and `terms/` (built on `components/site/legal-page.tsx`, written from what the code actually does — update them when data handling changes).
- `src/app/[siteSlug]/` — published blogs. Server Components, **no auth, no providers, no Postly chrome** — this separation is why the product sits in the `(app)` route group. Includes `subscription/confirm` and `subscription/unsubscribe`.
- `src/app/{not-found,error,global-error}.tsx` — root 404 and error boundaries, on `components/status-page.tsx` (needs no provider). This Next passes `retry`, not `reset`, to error boundaries. A single unknown segment is a blog slug and gets `[siteSlug]/not-found.tsx` instead.
- **Any new top-level app route must also be added to `RESERVED_SLUGS`** in `postly-backend/blog/subdomains.py`, or a writer can claim that slug and have their blog shadowed.
- `src/components/{auth,dashboard,public,site,ui,mockups,motion}` — `site/` is the marketing page, `public/` is the blog shell, `ui/` is shadcn.
- `src/middleware.ts` — UX-only redirect for `/dashboard` based on the `postly_auth` hint cookie (not `sessionid`). Never put a real security check here.

### The API clients (`src/lib/`) — pick the right one

- `api.ts` — dashboard/private API. `credentials: "include"`, copies `csrftoken` into `X-CSRFToken`, typed `ApiError`, global 401 handler. The only place session/CSRF logic lives.
- `public-api.ts` — server-only reads of `/api/public/`. No cookies, wrapped in React `cache()`, fetches tagged `blogTag(slug)` with 60s revalidate. Every function takes the site slug first (the Phase 3 seam).
- `subscribe-api.ts` — browser-side subscribe/confirm/unsubscribe. No credentials, never cached.
- `blog-refresh.ts` (Server Action) + `request-blog-refresh.ts` — expire the writer's own blog cache after dashboard edits. Takes no arguments on purpose; the session decides which blog.
- `blog-theme.ts` — the only place blog colours exist. `content.ts` — all homepage copy.
- `operator.ts` — operator name, location, contact email and the legal pages' "last updated" date. `marketing-url.ts` — `marketingPath()` for links from a blog back to the marketing site.

## Backend layout

- `config/settings/{base,dev,prod}.py` — `manage.py` defaults to dev, wsgi/asgi to prod.
- `accounts/` — custom `User` (email is the identifier, no username), 401-not-403 session auth, `AuthHintCookieMiddleware` (sets `postly_auth`), avatar upload/resize, and account deletion (`POST /api/auth/user/delete/` with the current password; cascades to blog, posts, subscribers and queued emails, and deletes the avatar file explicitly).
- `blog/` — `Site`, `Post`, `Subscriber`, `PostEmail` models.
  - Private API: `views.py` / `serializers.py` / `urls.py` under `/api/`.
  - Public API: `public_views.py` / `public_serializers.py` / `public_urls.py` under `/api/public/`.
  - `sanitize.py` (nh3 allowlist on output), `subscriptions.py`, `emails.py` (reader-facing mail), `webhooks.py` (Resend bounces/complaints, `/api/webhooks/`), `csv_safety.py`, `onboarding.py`, `subdomains.py` (reserved slugs).
- Tests live in `accounts/tests/` and `blog/tests/`.

## Rules that are easy to break

- **Tenancy:** every private queryset is filtered by `request.user`; another user's row is a **404, never 403**. `owner`/`author` come from the session in `perform_create()`, never the request body.
- **Public serializers are allowlists.** Name fields explicitly; never expose ids, `status`, timestamps, owner email (email appears only if `show_email_publicly`, and the key is *removed* otherwise, not nulled), or `unsubscribe_token` (also excluded from every writer-facing payload).
- **Drafts don't exist publicly** — filtered in one place, `public_views.published_posts()`; a draft slug 404s.
- **Post HTML is sanitised on the way out**, not on save. The frontend renders it with `dangerouslySetInnerHTML` relying on that.
- **Blog appearance is enums + a hue int (0–360)**, never a raw colour/CSS string from users. Inside `/[siteSlug]` use only the blog theme tokens (`--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--brand`/`--ring`) — other Tailwind colours like `text-destructive` fall back to the app palette and break contrast on dark blogs.
- **Auth is httpOnly session cookies — never store a token in the browser.** `lib/api.ts` must keep `credentials: "include"` + CSRF header.
- **Trailing slashes:** Django needs them; `next.config.ts` sets `skipTrailingSlashRedirect` and proxies `/api/:path(.*)` to `POSTLY_API_ORIGIN` in deployed envs so cookies stay first-party. Don't "simplify" either.
- **Email subscriptions:** double opt-in, the unsubscribe path, `List-Unsubscribe` headers and the reserved `subscription` slug are load-bearing (shared sending reputation). No bulk-import of subscribers, no writer-side delete of subscriber rows. Mail goes via a `PostEmail` outbox drained by cron — not Celery.
- **TipTap:** keep `immediatelyRender: false`; fetch the post keyed on `postId`, not on the editor instance. Autosave PATCHes 2s after the last change.
- Don't import from `dj_rest_auth.registration.*` (drags in allauth socialaccount); password reset uses the custom serializer in `accounts/serializers.py`.
- **The homepage only claims what's built.** No invented stats, testimonials or logos; planned features (custom domains, RSS, image uploads, scheduling, Markdown export, paid plans) appear only under `COMING_NEXT` in `src/lib/content.ts`. When one ships, move it from there into `FEATURES` / `FREE_PLAN_FEATURES`. Mockups in `components/mockups/` may show made-up blogs but not features that don't exist.

## Placeholders to replace before launch

The owner is buying a domain and email address soon. Until then these are stand-ins. When the real values exist, replace them, then update this section:

| Placeholder | Current value | Where | Replace with |
| --- | --- | --- | --- |
| Contact email | `contact@postly.example` (reserved domain, can never receive mail) | `src/lib/operator.ts`, overridable by `NEXT_PUBLIC_CONTACT_EMAIL` on Vercel | the real mailbox. Shown in the footer, Privacy Policy and Terms |
| Postal address in subscriber email | `New Delhi, India` (a city, not a valid CAN-SPAM address) | `POSTLY_POSTAL_ADDRESS` in `config/settings/base.py` (env var on Render) and `OPERATOR_LOCATION` in `src/lib/operator.ts` | a full postal address, PO box or mail-forwarding address. The owner will provide it |
| Operator | `Sagar Raturi`, an individual | `OPERATOR_NAME` in `src/lib/operator.ts` | a company name if one is registered; then also revisit the Terms' governing law (India / New Delhi courts) |
| Sending address | `hello@postly.com` default for `DEFAULT_FROM_EMAIL` | `config/settings/base.py`, env on Render | an address on the owned domain, verified in Resend (runbook 8.2) |
| Domain | `postly.com` hard-coded | `blog/models.py` (`Site.domain`), `blog/onboarding.py`, `src/app/layout.tsx` (`metadataBase`), 3 tests, and the illustrative URLs in `src/lib/content.ts` / `components/mockups/` | the bought domain (runbook 7.1) |

The legal pages were drafted without a lawyer. Have them reviewed before real users arrive, and bump `LEGAL_UPDATED` in `src/lib/operator.ts` whenever they change.

## Conventions

- Comments explain *why*, often at length, in docstrings at the top of modules/functions. Match that style; keep existing rationale comments intact.
- Next.js here is newer than training data — check `node_modules/next/dist/docs/` before using framework APIs (see AGENTS.md). `middleware.ts` still uses the deprecated name deliberately.
- Env: frontend `.env.example` → `.env.local` (`NEXT_PUBLIC_API_URL`); backend `postly-backend/.env.example` → `.env`.
