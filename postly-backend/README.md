# Postly backend — Phase 1

Django + DRF API behind the Postly writing dashboard. Phase 1 covers posts and
blogs only; authentication arrives in Phase 2.

---

## ⚠️ This build has no authentication

**Run it on your own machine and nowhere else.**

Every endpoint is `AllowAny`. Anyone who can reach the port can read, edit and
delete every post and every blog in the database — no login, no ownership
checks, no rate limiting. That is deliberate for Phase 1, and it means:

- Do **not** bind it to `0.0.0.0`, put it behind a tunnel, or deploy it to a
  server, a PaaS, or a preview environment.
- Do **not** point it at a database holding anything you would mind losing.
- `config/settings/prod.py` exists so the deployment story is ready, but it is
  **not safe to use** until Phase 2 auth is in place, however correct the
  security headers in it look.

A test (`TestOpenPermissions`) pins this assumption, so it will fail loudly
when auth lands — that failure is the reminder to rewrite it.

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
python manage.py seed_demo_site    # creates the blog the dashboard writes into
python manage.py runserver 8000
```

The API is then at <http://localhost:8000/api/> and the admin at
<http://localhost:8000/admin/>.

`seed_demo_site` is required, not optional: Phase 1 has no sign-up flow, so
without it there is no `Site` and the dashboard will tell you to run it. Pass
`--reset` to wipe the demo posts and start again.

For the admin, create a user:

```bash
python manage.py createsuperuser
```

## Running the Next.js frontend

In a second terminal, from the repository root (one level up):

```bash
npm install
cp .env.example .env.local         # sets NEXT_PUBLIC_API_URL
npm run dev
```

Then open <http://localhost:3000/dashboard>. The homepage navbar also has a
temporary "Go to dashboard" link that stands in for login until Phase 2.

Both servers need to be running: Next.js on `:3000`, Django on `:8000`. If the
dashboard shows a connection error, Django is not up.

## Tests

```bash
pytest
```

47 tests covering the model save logic (slug generation and collisions,
excerpt derivation, publish/unpublish timestamps) and every API endpoint
(CRUD, filtering, pagination, validation errors).

## Using Postgres instead of SQLite

Create the database, then set one variable:

```bash
DATABASE_URL=postgres://postly:postly@localhost:5432/postly
```

`django-environ` parses it, so nothing else changes. Re-run `migrate` and
`seed_demo_site` against the new database.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/sites/` | paginated, 20 per page |
| `POST` | `/api/sites/` | |
| `GET` `PATCH` `DELETE` | `/api/sites/{id}/` | delete cascades to posts |
| `GET` | `/api/posts/` | `?site={id}` `?status=draft\|published` `?search=` |
| `POST` | `/api/posts/` | |
| `GET` `PATCH` `DELETE` | `/api/posts/{id}/` | `PATCH` is the editor's autosave |

Notes on behaviour worth knowing:

- **`GET /api/posts/` omits `content`.** The dashboard list only needs titles
  and metadata; the detail endpoints return the full body. `PostListSerializer`
  vs `PostSerializer`.
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
├── .env.example
├── config/
│   ├── settings/
│   │   ├── base.py          shared; no environment assumptions
│   │   ├── dev.py           DEBUG, insecure key, localhost CORS
│   │   └── prod.py          everything from env, no defaults
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
└── blog/
    ├── models.py            Site, Post
    ├── serializers.py       list vs detail representations
    ├── views.py             ViewSets (AllowAny — see the warning above)
    ├── filters.py           ?site= and ?status=
    ├── urls.py              DRF router
    ├── admin.py
    ├── management/commands/seed_demo_site.py
    └── tests/
```

`DJANGO_SETTINGS_MODULE` defaults to `config.settings.dev` in `manage.py`, and
to `config.settings.prod` in `wsgi.py`/`asgi.py`.

## Phase 2 — not built, hooks left in place

- `django-allauth` for auth, then flip every ViewSet to `IsAuthenticated`
  (each one carries a `TODO Phase 2` comment saying exactly that)
- `owner` FK on `Site` — the field comment in `models.py` has the definition
- Per-user queryset filtering in `get_queryset()`
- Subdomain middleware resolving `<slug>.postly.com` to a `Site` (there is a
  placeholder in the `MIDDLEWARE` list) — `Site.domain` already builds the name
- Public blog rendering
- Image uploads to S3 via `django-storages`; `MEDIA_ROOT` is local for now
