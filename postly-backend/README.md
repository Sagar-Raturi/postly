# Postly backend

Django + DRF API behind Postly: accounts, blogs, posts, and per-blog email
subscriptions. Every private endpoint requires a signed-in user and only ever
returns that user's own rows. A small anonymous API serves published blogs and
the subscribe flow to readers, and one webhook takes delivery events from the
mail provider.

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

CSRF is checked on the signed-out endpoints too — login, signup, password
reset and confirm, resend verification. DRF only checks it inside
`SessionAuthentication`, which skips anonymous requests, so those views carry
`EnforceCsrfMixin` from `accounts/csrf.py`; without it any site could log a
visitor into an attacker's account. A POST there without the `csrftoken`
cookie and matching header, or from an `Origin` outside
`CSRF_TRUSTED_ORIGINS`, is a **403 `CSRF Failed`**. A wrong-password 400 is
therefore no evidence either way that CSRF is on — test with a foreign
`Origin` instead.

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
| `dj_rest_auth` | 60/min | logout, password change, user details |
| `avatar` | 30/hour | avatar upload and removal |
| `subscribe` | 10/hour | `POST /api/public/sites/{slug}/subscribe/` — every accepted submission sends mail |
| `subscription_token` | 20/hour | confirming a subscription |
| `subscription_unsubscribe` | 60/hour | unsubscribing — deliberately the loosest |

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

About 450 tests. Model save logic (slug generation and collisions, excerpt
derivation, read-time rounding, publish/unpublish timestamps), every API
endpoint (CRUD, filtering, pagination, validation errors), the auth flows
(signup, mandatory verification, login and logout, throttling, password reset
and change), and tenancy — that one account cannot read, edit or delete
another's blogs and posts, and gets a 404 rather than a 403 when it tries.
Also covered: avatar upload and resizing (`accounts/tests/test_avatar.py`), and
the whole subscription pipeline — subscribe, confirm and unsubscribe
(`test_subscriptions.py`, `test_subscription_email.py`), the writer's
subscriber API (`test_subscriber_api.py`), post fan-out and its daily cap
(`test_post_emails.py`, `test_send_caps.py`), and webhook signature checks
(`test_webhooks.py`).

`blog/tests/test_public_api.py` covers the anonymous API on its own, because
its failure modes are different from everything else's:

- a draft is a **404** from the public post endpoint, and absent from the
  public list, and `?status=draft` does not bring it back;
- the public payloads are pinned field by field — no owner email, no user or
  site id, no `status`, no internal timestamps;
- the public endpoints answer while logged out, and the dashboard endpoints
  still **401** while logged out;
- post bodies come back sanitised;
- a blog's appearance reaches the reader, cannot be written through the public
  API, and rejects every value outside its closed set — including an
  injection-shaped one, which is the case the closed set exists for.

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
| `GET` | `/api/public/sites/{slug}/` | blog name, slug, tagline, description; the writer's display name, bio and avatar; appearance. `email` **only** if published |
| `GET` | `/api/public/sites/{slug}/posts/` | published posts only, paginated, newest first |
| `GET` | `/api/public/sites/{slug}/posts/{postSlug}/` | one published post, with its body |
| `POST` | `/api/public/sites/{slug}/subscribe/` | always 202 with the same message; 404 if the blog has subscriptions off |
| `POST` | `/api/public/subscriptions/confirm/` | spends the token from the confirmation email |
| `GET` `POST` | `/api/public/subscriptions/unsubscribe/` | `GET ?token=` only describes the subscription; `POST` unsubscribes (also the one-click `List-Unsubscribe-Post` target) |

The three subscription endpoints run with `authentication_classes = []`, so no
session or CSRF is involved. They are covered in
[Email subscriptions](#email-subscriptions) below. What holds across the
three read endpoints:

- **Drafts do not exist here.** The status filter lives in one function,
  `public_views.published_posts()`, and a draft's slug is a **404** — the same
  answer a post that was never written gets, so guessing at the URL of an
  unpublished draft tells a reader nothing.
- **The serializers are an allowlist, not an exclusion list.** They name the
  public fields explicitly, so a field added to the dashboard serializers later
  cannot leak onto the public internet by default. There is no user id, no site
  id, no `status` and no `created_at`/`updated_at`.
- **The writer's email is opt-in, and the switch is enforced here.** See below.
- **Nothing is client-filterable.** No `?status=`, no `?ordering=` — a reader
  choosing the ordering is not a feature, and `?status=draft` would be a way of
  asking for one.
- **A blog's appearance is published, and it is not a colour.** `theme`,
  `appearance` and `font_pairing` are enum members; `accent_hue` is an integer
  0-360. The frontend (`src/lib/blog-theme.ts`) owns every actual value those
  select. This is the whole reason a writer customising their blog cannot put
  a string into a stylesheet — the same concern as the body sanitising below,
  handled by never accepting the string in the first place rather than by
  escaping it.
- **Post bodies are sanitised on the way out** (`blog/sanitize.py`). A body is
  HTML a person wrote, and until Phase 3 gives each blog its own subdomain it is
  rendered to *other people* on the same origin as the dashboard — so a
  `<script>` in somebody's post would run with a reading writer's session behind
  it. nh3 strips everything outside an allowlist of the tags the editor actually
  produces. It is done on the way out rather than on the way in, so stored
  content is never rewritten and the editor gets its own markup back byte for
  byte.

#### The public email address

`User.show_email_publicly` is a `BooleanField` defaulting to `False`, and
`PublicSiteSerializer.to_representation()` **pops the `email` key out of the
response** unless it is on.

Two decisions in that sentence, both load-bearing:

**The address never leaves the server when the switch is off.** The obvious
alternative is to serialize it always and let the blog decide what to render.
That puts a private address in a public HTTP response and makes the frontend's
discretion the only thing protecting it — at which point anyone with `curl`
has the address, whatever the page draws.

**The key is removed, not set to `null` or `""`.** A null email still says
"this field exists and this writer has one hidden", and it invites a frontend
to render an empty row or a "hidden" placeholder. An absent key has exactly one
possible rendering, which is nothing at all. `"email" in response` and "this
writer publishes their address" are the same question, and that is the point.

The default is `False`, so a new account is private without anyone choosing it,
and `seed_sagar` leaves it alone — the state a fresh install demonstrates first
is the private one. Turning it on lives in the dashboard at
**Settings → Your public profile**, and saves on the switch rather than behind
a Save button.

`blog/tests/test_public_api.py::TestPublicEmailIsOptIn` pins all of it: absent
by default, present and correct when on, gone again on the next request when
switched back off, per-account, and never on the post endpoints.

#### The rest of the profile

`display_name`, `bio` and `avatar` live on `User`, not `Site`: they describe a
person, and a person with two blogs is the same person. `tagline` lives on
`Site`, because it describes a publication. All four are always public — they
exist for no other purpose than being read by strangers — and all four may be
empty, which the blog renders as a fallback rather than a gap.

`avatar` is an `ImageField` served from `MEDIA_URL`, and is set through its
own endpoint, `POST` / `DELETE /api/auth/user/avatar/` (multipart). It is still
read-only on `PATCH /api/auth/user/`, which speaks JSON. `accounts/avatars.py`
accepts JPEG, PNG or WebP up to 5MB and 50 megapixels. It fixes EXIF rotation,
centre-crops the image to a square and re-encodes it at 512×512 at most, so
what is stored is a few KB. Large JPEGs are decoded at reduced scale so a
single upload fits in a small instance's memory. `config/urls.py` serves
`/media/` directly in every environment, including production. A writer
without an avatar gets an initials circle in their blog's accent colour.

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/signup/` | `email`, `display_name`, `password1`, `password2` |
| `POST` | `/api/auth/login/` | 204 plus a session cookie; no token in the body |
| `POST` | `/api/auth/logout/` | `GET` is a 405 |
| `GET` `PATCH` | `/api/auth/user/` | current account. `PATCH` writes `display_name`, `bio`, `show_email_publicly`; `email` and `avatar` are read-only |
| `POST` `DELETE` | `/api/auth/user/avatar/` | multipart `avatar`; both answer with the whole account |
| `POST` | `/api/auth/user/delete/` | `password`; 204. Deletes the account, its blog, posts, subscribers and queued email, removes the avatar file and ends the session. Shares the `auth_login` throttle |
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
| `GET` | `/api/subscribers/` | read-only; `?site=` `?status=` `?search=` `?ordering=` |
| `GET` | `/api/subscribers/stats/` | counts per status, through the same filters |
| `GET` | `/api/subscribers/export/` | the filtered list as CSV |

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
- **`PATCH /api/sites/{id}/` is where a blog is restyled.** `accent_hue` is
  bounded on the serializer as well as the model, because DRF does not run
  model validators; the other three are `TextChoices`, so an unknown name is a
  400 rather than a stored value nothing can render.
- **`slug` and `published_at` are read-only.** Both are derived in
  `Post.save()`; sending them is ignored.
- **Slugs are generated once**, from the title, on first save, and are then
  left alone so a published URL does not change when a post is retitled.
  Collisions within a site get a `-2`, `-3` suffix.
- **`published_at` tracks the current publication**: set when status becomes
  `published`, cleared when it goes back to `draft`.
- **`excerpt` is derived from `content`** when left blank, with HTML stripped
  and block boundaries turned into spaces.
- **A post's detail payload carries `email_delivery`**, the state of its
  subscriber email (see below), so the editor can show whether the post has
  been mailed.
- **Subscribers cannot be edited or deleted by the writer.** Every column
  records something a reader did, so setting a status by hand would invent
  consent nobody gave. A deleted row would also be silently re-added by the
  reader's next form submission. `unsubscribe_token` is left out of every
  payload a writer can see, because it ends a subscription without a session.
  Exported CSV cells go through `blog/csv_safety.py`, which defuses spreadsheet
  formula injection (an email address may legally begin with `=`).

## Email subscriptions

Readers can subscribe to a blog once its writer turns on
`Site.subscriptions_enabled`. Every blog sends from one shared domain, so a
single blog's bad list hurts delivery for everyone, including Postly's own
password-reset mail. That is why double opt-in, unsubscribe and bounce
handling come before any convenience feature, and why there is no bulk import.

**Capture and double opt-in.** `SubscribeView` always answers 202 with the
same message, whether the address is new, pending, already confirmed or
suppressed, so the form cannot reveal who is on a list. A new or pending
address gets a confirmation email (`blog/emails.py`). Resends have a
per-address cooldown on `Subscriber.confirmation_sent_at`, on top of the
per-IP throttle. A send failure is logged, not raised: an endpoint that
returned a 5xx only when mail was due would reveal who is already
subscribed. Subscriber status is one of `pending`, `confirmed`,
`unsubscribed`, `bounced` or `complained`.

**Unsubscribe.** A `GET` only reads, so a mail scanner that prefetches the
link changes nothing. The `POST` is what unsubscribes. Every post email
carries `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
headers pointing at that `POST`.

**Fan-out.** Publishing a post creates one `PostEmail` row, a one-to-one
record that makes a post mailable at most once, ever. It is scheduled
`POST_EMAIL_DELAY_MINUTES` (default 15) ahead, and unpublishing inside that
window cancels it. Nothing in the web process sends it. A cron runs:

```bash
python manage.py send_pending_post_emails            # every minute; --limit, --dry-run
```

That command sends over one reused connection, in batches of 50, to confirmed
subscribers only, and keeps a cursor so a crash or a re-run never mails anyone
twice. It is safe to run concurrently with itself. Each blog is capped at
`POST_EMAIL_DAILY_CAP_PER_SITE` (default 2000) emails a day; a send that hits
the cap pauses and resumes the next day from the same cursor. A `PostEmail`
moves through `pending`, `sending` and `sent`, and ends at `failed` once it
runs out of attempts. It is not retried after that. **Without the cron,
published posts queue mail that never goes out.**

**Bounces and complaints.** `POST /api/webhooks/resend/` (`blog/webhooks.py`)
verifies Resend's Svix-style HMAC signature by hand, with no `svix`
dependency. On `email.bounced` or `email.complained` it suppresses that
address on **every** blog, not just the sending one: mailbox providers record
the complaint against the shared domain. If `RESEND_WEBHOOK_SECRET` is unset
the endpoint refuses every request — deliberately, since accepting unsigned
calls would let anyone unsubscribe any reader.

Every reader-facing message ends with the sender's postal address, which
CAN-SPAM requires in bulk mail. It comes from `POSTLY_POSTAL_ADDRESS`, whose
default, "New Delhi, India", is a placeholder until a real address exists.
Account mail doesn't carry it.

Reader-facing mail comes from `SUBSCRIPTION_FROM_EMAIL`, which defaults to
`DEFAULT_FROM_EMAIL`. Before there are real subscribers it should be a
separate subdomain with its own SPF, DKIM and DMARC records. That is DNS
work, not code; `.env.example` has the details.

## Email delivery

In development, `config/settings/dev.py` prints every message to the console.
Elsewhere, setting `RESEND_API_KEY` sends mail over Resend's HTTPS API through
`django-anymail`. Use it on Render's free tier, which blocks outbound SMTP.
Without that key the `EMAIL_HOST*` SMTP settings apply.

## Production

`wsgi.py` / `asgi.py` default to `config.settings.prod`, which reads every
value from the environment and has no fallbacks. Production runs under
`gunicorn config.wsgi:application`. WhiteNoise serves `collectstatic` output from the
web process, so the admin and the browsable API keep their styling. Its
middleware has to sit directly below `SecurityMiddleware`. The frontend
reaches this API through its own `/api` proxy (see the root README), so
the session cookie stays first-party. The step-by-step Render runbook
lives in `.claude/skills/deploy/` at the repo root.

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
├── templates/blog/email/    subscription confirmation and new-post mail
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
│   ├── avatars.py           validate, crop and re-encode avatar uploads
│   ├── permissions.py       IsOwner
│   ├── serializers.py       signup, user details, password reset
│   ├── views.py             throttled auth endpoints
│   ├── urls.py
│   ├── admin.py
│   ├── management/commands/verification_link.py
│   └── tests/
└── blog/
    ├── models.py            Site, Post, Subscriber, PostEmail (the outbox)
    ├── serializers.py       list vs detail representations      ─┐ private
    ├── views.py             ViewSets, filtered by request.user   │ API
    ├── urls.py              DRF router                          ─┘
    ├── public_serializers.py  allowlist of public fields        ─┐ public
    ├── public_views.py        published posts + subscribe flow   │ API
    ├── public_urls.py         /api/public/                      ─┘
    ├── webhooks.py          Resend bounce/complaint webhook     ─┐ /api/
    ├── webhook_urls.py                                          ─┘ webhooks/
    ├── subscriptions.py     subscriber tokens and state changes
    ├── emails.py            all reader-facing mail: confirm, fan-out, caps
    ├── csv_safety.py        defuses formula injection in the CSV export
    ├── sanitize.py          allowlist HTML cleaning, on the way out
    ├── onboarding.py        first blog, slug availability
    ├── subdomains.py        DNS rules and reserved names for slugs
    ├── filters.py           ?site= ?status= ?search=, posts and subscribers
    ├── admin.py
    ├── management/commands/
    │   ├── seed_sagar.py    the demo blog; prose lives in _sagar_posts.py
    │   ├── seed_dummy_posts.py  numbered filler; lorem in _lorem.py
    │   ├── seed_demo_site.py
    │   └── send_pending_post_emails.py  the cron that drains the outbox
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
- Avatars on S3 via `django-storages`. `MEDIA_ROOT` is local disk for now,
  which ties the backend to a single instance. Post body images are never
  uploaded; the editor takes a remote URL.
- Letting a writer unsubscribe a reader on that reader's behalf, for removal
  requests that arrive by some other channel.
