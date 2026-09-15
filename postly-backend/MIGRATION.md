# Phase 2 migration notes

Phase 2 replaced Django's default `User` with a custom one and added
ownership to every existing model. This is what changed, and why it was done
the destructive way.

---

## The custom user model, and why the database was reset

Postly identifies writers by email address. There is no username field, and
`accounts.User.USERNAME_FIELD` is `email`.

Django makes `AUTH_USER_MODEL` extremely awkward to change once migrations
have been applied — the setting is baked into every migration that references
a user, and swapping it later means hand-editing migration history or
carrying a compatibility shim indefinitely. The two ways out were:

1. **Reset the development database and regenerate the initial migration**,
   so `accounts.User` exists from the very first migrate. Ten minutes.
2. Keep the default `User` and hang a `Profile` model off it with a
   `OneToOneField`. No data loss, but the awkwardness is permanent: two
   objects for every person, a join on every read, and `request.user` never
   being the thing you actually want.

**Option 1 was chosen.** The cost was zero: `db.sqlite3` is gitignored and was
never checked in, `blog/` had exactly one migration (`0001_initial`), and the
only data in it came from `seed_demo_site`, which is a management command that
recreates it on demand.

Concretely:

- `postly-backend/db.sqlite3` was deleted.
- `blog/migrations/0001_initial.py` was deleted and regenerated, so `Site.owner`
  and `Post.author` are part of the initial schema rather than later additions.
- `accounts/migrations/0001_initial.py` was created.

**If you have a Phase 1 database you care about**, do not follow this. Adding a
non-null `owner` to a populated table fails outright. The three-step version
is: add the column as nullable, add a data migration that assigns every
existing row to a placeholder user, then a third migration that alters it to
non-null.

### Redoing the reset

From `postly-backend/`, with the virtualenv active:

```bash
rm db.sqlite3
rm blog/migrations/0001_initial.py
python manage.py makemigrations accounts blog
python manage.py migrate
python manage.py seed_demo_site
```

`seed_demo_site` now creates a demo *account* (`demo@postly.test`, password
`small-hours-demo`) with its address pre-verified, plus the blog and its posts.
Email verification is mandatory, so without that flag the demo account could be
created but never logged into.

---

## Ownership on existing models

| Model | Field | Behaviour |
| --- | --- | --- |
| `Site` | `owner` → `AUTH_USER_MODEL`, `related_name="sites"` | `CASCADE`. Deleting an account deletes its blogs and, through them, their posts. |
| `Post` | `author` → `AUTH_USER_MODEL`, `related_name="posts"`, nullable | `SET_NULL`. A post outlives the account that wrote it — closing an account must not silently unpublish work. |

`Site.owner` is non-null: a blog with no owner has no tenant, and every
queryset in the API filters on it.

---

## Things that changed shape

- **`AUTH_USER_MODEL = "accounts.User"`.** Anything importing
  `django.contrib.auth.models.User` directly must switch to
  `get_user_model()` or `settings.AUTH_USER_MODEL`.
- **`createsuperuser` prompts differently.** Email first, then display name,
  then password. There is no username prompt.
- **Passwords are hashed with Argon2** (`argon2-cffi`). Existing PBKDF2 hashes
  still verify and are upgraded on next login — there were none to upgrade
  here, since the user table was new.
- **`django.contrib.sites` is deliberately not installed.** allauth 65 does not
  require it, and its `Site` model would sit next to `blog.Site` under the
  same name in the admin and in imports.
- **`seed_demo_site` is no longer required** to make the dashboard usable.
  Onboarding creates a writer's first blog. The command is now a shortcut for
  getting a working login after a reset.
