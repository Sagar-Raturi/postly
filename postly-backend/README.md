# Postly backend — Phase 2

Django + DRF API behind the Postly writing dashboard: accounts, blogs and
posts. Phase 2 added authentication and locked the API down — every endpoint
now requires a signed-in user and only ever returns that user's own rows.

If you are coming from Phase 1, read [MIGRATION.md](MIGRATION.md) first: the
user model changed and the development database was reset.

---

## Authentication

**Session cookies, not JWTs.** django-allauth owns signup, email verification
and password reset; dj-rest-auth exposes those flows as REST endpoints; the
frontend holds nothing.

The reasoning, since it constrains everything else here: a token in
`localStorage` is readable by any script on the page, so a single XSS bug is a
stolen session. An httpOnly cookie cannot be read by JavaScript at all. Both
halves of Postly are first-party, so there is no cross-origin requirement that
would justify the trade.

What that means in practice:

| Setting | Value | Why |
| --- | --- | --- |
| `SESSION_COOKIE_HTTPONLY` | `True` | The credential is unreadable from JS. |
| `SESSION_COOKIE_SAMESITE` | `Lax` | :3000 and :8000 are the same site, so the cookie still travels. |
| `SESSION_COOKIE_SECURE` | `False` dev, `True` prod | Demanding it over plain http would mean nothing ever logs in locally. |
| `CSRF_COOKIE_HTTPONLY` | `False` | `lib/api.ts` reads it into `X-CSRFToken`. It is not a credential. |
| `CORS_ALLOW_CREDENTIALS` | `True` | Without it the browser sends no cookies. |
| `CORS_ALLOWED_ORIGINS` | explicit list | Never a wildcard — it is incompatible with credentials, and would hand any site a logged-in caller. |

Every frontend request sends `credentials: "include"`; unsafe methods also
send `X-CSRFToken`.

### The flow

```
POST /api/auth/signup/     → account created, confirmation email sent
                             (login is refused until the address is confirmed)
GET  /api/auth/verify-email/{key}/
                           → address confirmed
POST /api/auth/login/      → 204, plus a session cookie
POST /api/onboarding/site/ → the writer's first blog
```

`ACCOUNT_EMAIL_VERIFICATION = "mandatory"`, so a fresh account exists but
cannot be used. `is_active` stays `True` — what blocks the login is the
unverified `EmailAddress`, which is allauth's own notion of "not yet usable"
and keeps password reset working. dj-rest-auth's login serializer enforces it.

### Reading verification and reset emails in development

`config/settings/dev.py` uses `django.core.mail.backends.console.EmailBackend`,
so **no email provider is needed to work on auth locally**. Every message is
printed to the terminal running `runserver`, plaintext and HTML both.

Sign up, then look in that terminal for:

```
Subject: Confirm your email address
...
http://localhost:3000/verify-email?key=Mg:1x6L6Y:LYAv9v...
```

Paste that link into the browser. Password resets arrive the same way, as a
`http://localhost:3000/reset-password/<token>?uid=<uid>` link.

Links point at `FRONTEND_URL`, not at Django — this backend renders no pages
for people.

### When you cannot see the console output

If `runserver` is in another window, scrolled away, or running in the
background, the link is printed somewhere you cannot read — and **resending
the email does not help, because it goes to the same place**. Print it where
you are instead:

```bash
python manage.py verification_link            # who is waiting to confirm
python manage.py verification_link you@example.com
python manage.py verification_link you@example.com --reset   # reset link
```

One caveat if you background the server yourself: Python buffers stdout when
it is not attached to a terminal, so emails may never appear in a redirected
log. Run it with `-u`:

```bash
python -u manage.py runserver 8000
```

### Creating a superuser

Email is the login identifier, so the prompts differ from stock Django: email,
then display name, then password. There is no username.

```bash
python manage.py createsuperuser
```

The admin at <http://localhost:8000/admin/> shares the same session, which is
also the easiest way to log in to DRF's browsable API.

### Abuse protection

DRF's `ScopedRateThrottle`, keyed by IP for anonymous callers. No
`django-ratelimit`: every dj-rest-auth view already carries a `throttle_scope`,
so the throttling is built in.

| Scope | Rate | Applies to |
| --- | --- | --- |
| `auth_login` | 5/min | `POST /api/auth/login/` |
| `auth_password_reset` | 5/min | reset requests, resend-verification |
| `auth_signup` | 10/hour | `POST /api/auth/signup/` |
| `auth_verify_email` | 20/hour | confirmation links |
| `onboarding` | 60/min | slug availability, first-blog creation |

Also: Argon2 password hashing (`argon2-cffi`), `MinimumLengthValidator` raised
to 10 characters, and reset tokens that expire after an hour
(`PASSWORD_RESET_TIMEOUT`). The reset endpoint answers identically whether or
not the address has an account, so it cannot be used to discover who has
signed up.

---

## Requirements

- Python 3.12+ (built and tested on 3.14; Django 5.2.7+ supports it)
- PostgreSQL, optional — SQLite is the default and is fine to start with

## Setup

```bash
cd postly-backend

python -m venv .venv
source .venv/Scripts/activate      # Windows (Git Bash)
# .venv\Scripts\activate           # Windows (PowerShell / cmd)
# source .venv/bin/activate        # macOS / Linux

pip install -r requirements.txt

cp .env.example .env               # optional; sensible defaults without it

python manage.py migrate
python manage.py seed_sagar        # the demo blog the dashboard and public
                                   # site are built against
python manage.py runserver 8000
```

The API is then at <http://localhost:8000/api/> and the admin at
<http://localhost:8000/admin/>.

### Seed data

`seed_sagar` builds the blog everything is demonstrated on: a verified account,
one site, and ten posts — eight published, two drafts — with real prose of
varying length so read times and excerpt truncation are exercised against
something other than uniform filler.

```
sagar@example.com / postly1234        the blog is at /sagar
```

It is idempotent: the user is matched on email, the site on slug, and each post
on (site, title), so running it twice adds nothing and a body you edited in the
dashboard survives a re-run. Pass `--reset` to put the posts back to the
originals.

`seed_dummy_posts` adds numbered filler on top, for testing against volume:

```bash
python manage.py seed_dummy_posts              # 10 more onto /sagar
python manage.py seed_dummy_posts --count 15   # enough to cross a page
python manage.py seed_dummy_posts --delete     # take them away again
```

It is a separate command from `seed_sagar` on purpose. That one is a fixture —
real prose, chosen so the typography and the read-time estimates are exercised
against something plausible. This one is scaffolding: every post is titled
`Dummy Post NN` and every body opens "Lorem ipsum", so you can tell at a glance
which is which, and `--reset` and `--delete` match on that title prefix rather
than emptying the blog. Bodies are generated but seeded per index, so the same
post always gets the same text; lengths run from about 90 to about 570 words
and the markup rotates through headings, lists and quotes. Roughly every fourth
is left as a draft.

Past 20 posts — `--count 15` on top of the seeded ten — both the dashboard's
`getAllPosts()` and the blog index's page-following do more than one request,
which is otherwise hard to reach.

`seed_demo_site` is the older, smaller fixture — one writer, three posts, at
`demo@postly.test` / `small-hours-demo`. It takes `--email`, `--password` and
`--reset`. None of these is required; you can sign up through the UI instead,
and fish the confirmation link out of the console.

## Running the Next.js frontend

In a second terminal, from the repository root (one level up):

```bash
npm install
cp .env.example .env.local         # sets NEXT_PUBLIC_API_URL
npm run dev
```

Then open <http://localhost:3000/signup>, or <http://localhost:3000/login> if
you ran `seed_demo_site`. `/dashboard` redirects to `/login` when you are not
signed in.

Both servers need to be running: Next.js on `:3000`, Django on `:8000`. If the
dashboard shows a connection error, Django is not up.

## Tests

```bash
pytest
```

162 tests. Model save logic (slug generation and collisions, excerpt
derivation, read-time rounding, publish/unpublish timestamps), every API
endpoint (CRUD, filtering, pagination, validation errors), the auth flows
(signup, mandatory verification, login and logout, throttling, password reset
and change), and tenancy — that one account cannot read, edit or delete
another's blogs and posts, and gets a 404 rather than a 403 when it tries.

`blog/tests/test_public_api.py` covers the anonymous API on its own, because
its failure modes are different from everything else's:

- a draft is a **404** from the public post endpoint, and absent from the
  public list, and `?status=draft` does not bring it back;
- the public payloads are pinned field by field — no owner email, no user or
  site id, no `status`, no internal timestamps;
- the public endpoints answer while logged out, and the dashboard endpoints
  still **401** while logged out;
- post bodies come back sanitised.

## Using Postgres instead of SQLite

Create the database, then set one variable:

```bash
DATABASE_URL=postgres://postly:postly@localhost:5432/postly
```

`django-environ` parses it, so nothing else changes. Re-run `migrate` and
`seed_demo_site` against the new database.

## API

There are two surfaces, and the split matters.

**`/api/…` is private.** Everything under it requires a session. Anonymous
requests get **401**, not 403 — a custom `SessionAuthentication` subclass
supplies a `WWW-Authenticate` header, because DRF otherwise downgrades the
status and the frontend cannot tell "signed out" from "not allowed".

**`/api/public/…` is deliberately open**, and it is the only thing that is. It
serves published blogs to readers who have no Postly account, it is read-only,
and it lives in its own three files (`public_urls.py`, `public_views.py`,
`public_serializers.py`) so the entire public surface can be read end to end in
a couple of minutes.

### Public — no session, read-only

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/public/sites/{slug}/` | name, slug, description, author display name |
| `GET` | `/api/public/sites/{slug}/posts/` | published posts only, paginated, newest first |
| `GET` | `/api/public/sites/{slug}/posts/{postSlug}/` | one published post, with its body |

What holds across all three:

- **Drafts do not exist here.** The status filter lives in one function,
  `public_views.published_posts()`, and a draft's slug is a **404** — the same
  answer a post that was never written gets, so guessing at the URL of an
  unpublished draft tells a reader nothing.
- **The serializers are an allowlist, not an exclusion list.** They name the
  public fields explicitly, so a field added to the dashboard serializers later
  cannot leak onto the public internet by default. There is no owner email, no
  user id, no site id, no `status` and no `created_at`/`updated_at`.
- **Nothing is client-filterable.** No `?status=`, no `?ordering=` — a reader
  choosing the ordering is not a feature, and `?status=draft` would be a way of
  asking for one.
- **Post bodies are sanitised on the way out** (`blog/sanitize.py`). A body is
  HTML a person wrote, and until Phase 3 gives each blog its own subdomain it is
  rendered to *other people* on the same origin as the dashboard — so a
  `<script>` in somebody's post would run with a reading writer's session behind
  it. nh3 strips everything outside an allowlist of the tags the editor actually
  produces. It is done on the way out rather than on the way in, so stored
  content is never rewritten and the editor gets its own markup back byte for
  byte.

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/signup/` | `email`, `display_name`, `password1`, `password2` |
| `POST` | `/api/auth/login/` | 204 plus a session cookie; no token in the body |
| `POST` | `/api/auth/logout/` | `GET` is a 405 |
| `GET` `PATCH` | `/api/auth/user/` | current account; `PATCH` renames only |
| `POST` | `/api/auth/password/reset/` | identical response for known and unknown addresses |
| `POST` | `/api/auth/password/reset/confirm/` | `uid`, `token`, `new_password1`, `new_password2` |
| `POST` | `/api/auth/password/change/` | requires `old_password` |
| `GET` | `/api/auth/verify-email/{key}/` | the link in the confirmation email |
| `POST` | `/api/auth/resend-verification/` | for a lost confirmation email |
| `GET` | `/api/auth/csrf/` | sets the CSRF cookie |

### Onboarding

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/onboarding/site/` | the writer's first blog; 409 if they have one |
| `GET` | `/api/onboarding/slug-available/?slug=` | `{slug, available, reason?, domain?}` |

### Blogs and posts

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/sites/` | paginated, 20 per page; only your own |
| `POST` | `/api/sites/` | `owner` comes from the session |
| `GET` `PATCH` `DELETE` | `/api/sites/{id}/` | delete cascades to posts |
| `GET` | `/api/posts/` | `?site={id}` `?status=draft\|published` `?search=` |
| `POST` | `/api/posts/` | `author` comes from the session |
| `GET` `PATCH` `DELETE` | `/api/posts/{id}/` | `PATCH` is the editor's autosave |

Notes on behaviour worth knowing:

- **Another account's records are a 404, never a 403.** Both viewsets filter
  their queryset by the requesting user before anything else looks at it. A
  403 would confirm the row exists, which turns an ID guess into a way of
  learning what other people have.
- **`owner` and `author` are never read from the request body.** They are set
  in `perform_create()` from `request.user`, and sending them is ignored.
  `PostSerializer` also narrows the `site` field's queryset to your own blogs,
  so a post cannot be filed on someone else's — an object-level check cannot
  catch that one, because the post does not exist yet.

- **`GET /api/posts/` includes `content`.** It did not used to. The dashboard
  card now renders an excerpt, expands in place to the full post, and searches
  body text as well as titles — all three want the body, and fetching it per
  card on expand would trade one predictable request for an unpredictable
  number of small ones. Pagination bounds the cost. `PostListSerializer` still
  drops `site_name` and `author_name`, which are the same on every row.
- **`read_time_minutes` is computed server-side**, from the word count of the
  stripped body at 200wpm, rounded up, never zero. Both the dashboard and the
  published post read it from the API, so the two cannot disagree.
- **`slug` and `published_at` are read-only.** Both are derived in
  `Post.save()`; sending them is ignored.
- **Slugs are generated once**, from the title, on first save, and are then
  left alone so a published URL does not change when a post is retitled.
  Collisions within a site get a `-2`, `-3` suffix.
- **`published_at` tracks the current publication**: set when status becomes
  `published`, cleared when it goes back to `draft`.
- **`excerpt` is derived from `content`** when left blank, with HTML stripped
  and block boundaries turned into spaces.

## Layout

```
postly-backend/
├── manage.py
├── requirements.txt
├── pytest.ini
├── conftest.py              fixtures shared by both test packages
├── .env.example
├── MIGRATION.md             the custom-user-model decision
├── templates/account/email/ verification and reset mail, text + HTML
├── config/
│   ├── settings/
│   │   ├── base.py          shared; no environment assumptions
│   │   ├── dev.py           DEBUG, insecure key, console email
│   │   └── prod.py          everything from env, no defaults
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── accounts/
│   ├── models.py            User (email as identifier), UserManager
│   ├── adapters.py          display_name on signup; links to the frontend
│   ├── authentication.py    session auth that 401s instead of 403s
│   ├── middleware.py        the postly_auth routing-hint cookie
│   ├── permissions.py       IsOwner
│   ├── serializers.py       signup, user details, password reset
│   ├── views.py             throttled auth endpoints
│   ├── urls.py
│   ├── admin.py
│   ├── management/commands/verification_link.py
│   └── tests/
└── blog/
    ├── models.py            Site (owner), Post (author), read time
    ├── serializers.py       list vs detail representations      ─┐ private
    ├── views.py             ViewSets, filtered by request.user   │ API
    ├── urls.py              DRF router                          ─┘
    ├── public_serializers.py  allowlist of public fields        ─┐ public
    ├── public_views.py        AllowAny, published posts only     │ API
    ├── public_urls.py         /api/public/                      ─┘
    ├── sanitize.py          allowlist HTML cleaning, on the way out
    ├── onboarding.py        first blog, slug availability
    ├── subdomains.py        DNS rules and reserved names for slugs
    ├── filters.py           ?site= and ?status=
    ├── admin.py
    ├── management/commands/
    │   ├── seed_sagar.py    the demo blog; prose lives in _sagar_posts.py
    │   ├── seed_dummy_posts.py  numbered filler; lorem in _lorem.py
    │   └── seed_demo_site.py
    └── tests/
```

`DJANGO_SETTINGS_MODULE` defaults to `config.settings.dev` in `manage.py`, and
to `config.settings.prod` in `wsgi.py`/`asgi.py`.

## Two things worth knowing before you change the auth code

**`accounts/views.py` does not import from `dj_rest_auth.registration.views`,**
and `accounts/serializers.py` does not import its serializers. Those modules
import `allauth.socialaccount` at module scope, which would force the whole
social-login subsystem into `INSTALLED_APPS` — three unused tables and an
admin section — for a product with no social login. Signup is written against
allauth's adapter directly instead. The app stays in `INSTALLED_APPS`, because
that is what enables dj-rest-auth's "is this address verified?" check at login.

**Password reset does not use Django's `PasswordResetForm`.** With allauth
installed, dj-rest-auth validates the confirmation with *allauth's* token
generator and a base36 uid, while Django's form signs links with its own
generator and a base64 uid — so the default configuration mails a link its own
confirm endpoint rejects. `accounts.serializers.PasswordResetSerializer`
generates the matching pair. There is a test pinning this
(`test_the_emailed_link_is_accepted_by_the_confirm_endpoint`).

## Phase 3 — not built

- Subdomain middleware resolving `<slug>.postly.com` to a `Site` (there is a
  placeholder in the `MIDDLEWARE` list) — `Site.domain` already builds the name.
  The public API does not need it: the slug is a path parameter, and where the
  frontend gets that slug is the only thing that changes. See the note at the
  top of `blog/public_urls.py`.
- Multiple blogs per account (the models allow it; onboarding caps it at one)
- Image uploads to S3 via `django-storages`; `MEDIA_ROOT` is local for now
