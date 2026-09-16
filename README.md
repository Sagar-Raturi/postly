# Postly — frontend

Next.js (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui and Framer
Motion. Two independent products, served from one app:

**Postly itself** — everything under `src/app/(app)/`:

- **`/`** — the marketing homepage
- **`/login`, `/signup`, `/verify-email`, `/forgot-password`,
  `/reset-password/[token]`, `/onboarding`** — the account flows
- **`/dashboard`**, **`/dashboard/posts/[id]`**, **`/dashboard/settings`** —
  the writing dashboard, behind a login, backed by the Django API in
  [`postly-backend/`](postly-backend/README.md)

**Published blogs** — `src/app/[siteSlug]/`:

- **`/{siteSlug}`** — a writer's blog index
- **`/{siteSlug}/{postSlug}`** — one published post

The second is not a section of the first. It has no Postly navbar, no dashboard
chrome, no login, no `AuthProvider` and no `ThemeProvider` — which is why the
product lives in an `(app)` route group rather than at the root. A route group adds no path
segment, so every URL above is exactly where it looks like it is; what it buys
is a layout boundary. A stranger reading somebody's blog does not have their
browser asking the Postly API about a session they do not have — and a reader
who once put the *marketing site* into dark mode does not thereby restyle
somebody else's writing, which they did while both providers sat at the root.

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL
npm run dev                    # http://localhost:3000
npm run build
npm run lint
```

Both halves need to be running — see
[postly-backend/README.md](postly-backend/README.md) for the Django side. Its
setup is `pip install -r requirements.txt`, `migrate`, `seed_sagar`,
`runserver`.

## Seeing the seeded blog

`python manage.py seed_sagar` in `postly-backend/` creates a writer with ten
posts — eight published, two drafts. With both servers up:

| | |
| --- | --- |
| The public blog | <http://localhost:3000/sagar> |
| One post | <http://localhost:3000/sagar/three-weeks-in-spiti-valley> |
| A draft's URL (404s — this is the point) | <http://localhost:3000/sagar/on-leaving-a-job-without-a-plan> |
| The dashboard | <http://localhost:3000/login> as `sagar@example.com` / `postly1234` |

Open the public blog in a private window to see it the way a reader does: it
loads with no session, and nothing on it asks for one.

For more volume, `python manage.py seed_dummy_posts` adds ten numbered filler
posts on top (`--count 15` puts the blog over the 20-per-page boundary, so the
paginated fetches on both surfaces actually run more than once; `--delete`
removes them again). They are titled `Dummy Post NN` and open "Lorem ipsum", so
they never get mistaken for the curated ten.

If you would rather start from nothing, sign up at
<http://localhost:3000/signup> instead. Email verification is mandatory, and in
development the confirmation link prints to the terminal running `runserver`
rather than being sent.

## Testing subdomains locally

Blogs are served at `/{siteSlug}` today and will move to
`{siteSlug}.postly.com` in Phase 3. You do not need to touch `/etc/hosts` to
work on that: **`lvh.me` and every subdomain of it resolve to `127.0.0.1`**, so
<http://sagar.lvh.me:3000> reaches your dev server with `sagar.lvh.me` in the
`Host` header — which is the only input the subdomain routing will need.

Add the host to the Django side before trying it, or the API refuses the
request:

```bash
# postly-backend/.env
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,.lvh.me
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://sagar.lvh.me:3000
```

Until the routing layer exists, `sagar.lvh.me:3000/sagar` is what serves the
blog — the host is ignored and the path still carries the slug. Making the host
carry it is a rewrite in `middleware.ts` mapping `{slug}.postly.com/x` onto
`/{slug}/x`, and nothing under `src/app/[siteSlug]/` changes: every file there
takes `siteSlug` as a parameter and hands it straight to `lib/public-api.ts`.

## Design system

The palette is warm paper, ink black and a single deep-forest accent, defined
once as CSS custom properties in `src/app/globals.css` and exposed to Tailwind
through `@theme inline`. Light is the primary mode; dark is a full companion
theme, toggled with next-themes and persisted to `localStorage`.

| Token | Role |
| --- | --- |
| `--background` / `--foreground` | warm off-white paper, warm near-black ink |
| `--brand`, `--brand-soft`, `--brand-muted` | deep forest accent and its tints |
| `--font-display` | Newsreader — every headline and all editorial prose |
| `--font-sans` | Inter — UI, body copy, labels |
| `--font-mono` | JetBrains Mono — subdomains, URLs, counters |

Three custom shadow utilities (`shadow-soft`, `shadow-lift`, `shadow-window`)
re-declare Tailwind's ring layers before their own values, because setting
`box-shadow` outright would silently erase any `ring-*` on the same element.

Stored post HTML is rendered with `@tailwindcss/typography` as
`prose prose-postly`, on the published post and inside the dashboard card
alike. `.prose-postly` swaps the plugin's grey scale for the palette tokens
above, which already flip in dark mode — so there is no `prose-invert` to
remember. Its selector is `.prose.prose-postly`, inside `@layer utilities`, and
both halves of that are load-bearing: the plugin declares the same variables on
`.prose` as a utility, a later cascade layer beats an earlier one whatever the
specificity, and within one layer the doubled class wins the tie. Put those
rules in `@layer components` with a single class and the text silently comes
out in the plugin's greys.

## Structure

```
src/
  middleware.ts           route guard for /dashboard, /login, /signup
  app/
    layout.tsx            document shell: fonts and the no-JS fallback.
                          Deliberately no Auth/ThemeProvider — see (app)/
    globals.css           palette, type scale, utilities, editor + post prose
    favicon.ico

    (app)/                Postly itself. The route group adds no URL segment.
      layout.tsx          Auth + Theme providers — the boundary the blog
                          sits outside of
      page.tsx            homepage — composes the nine sections in order
      login/ signup/ verify-email/ forgot-password/
      reset-password/[token]/ onboarding/
                          one server page each, rendering a client form
      dashboard/
        page.tsx          post list
        posts/[id]/       editor (awaits `params`, then the client UI)
        settings/         blog name and description, account details

    [siteSlug]/           published blogs — server-rendered, no auth, no chrome
      layout.tsx          masthead + footer; 404s an unknown blog
      page.tsx            the index: description and every published post
      [postSlug]/page.tsx one post, with generateMetadata + Open Graph
      not-found.tsx       one page for "no such blog", "no such post", "draft"

  components/
    auth-provider.tsx     user, loading, login/logout/signup, 401 handling
    auth/                 auth-shell, field, and one component per page
    site/                 navbar, hero, how-it-works, features, social-proof,
                          examples, pricing, cta-banner, footer, primitives
    dashboard/            dashboard-header, account-menu, site-link-chip,
                          post-list, post-card, post-toolbar, post-editor,
                          editor-toolbar, settings-panel, theme-picker,
                          theme-preview
    public/               reading-column, blog-header, blog-footer
    mockups/              browser-frame.tsx + screens.tsx
    motion/reveal.tsx     Reveal / Stagger / StaggerItem
  lib/
    content.ts            all homepage copy and data
    api.ts                typed client for the private API — session + CSRF
    public-api.ts         typed client for /api/public — no session, no cookies
    blog-theme.ts         the palettes, and the only place blog colours exist
    form-errors.ts        DRF error bodies → per-field messages
```

`src/lib/content.ts` holds every string that repeats or lists — features,
testimonials, plans, example blogs, footer columns — so copy edits do not mean
touching layout.

## Product "screenshots"

There is no real product yet, so every screenshot is styled markup rather than
an image: `BrowserFrame` supplies the chrome and address bar, and `screens.tsx`
draws the editor, the onboarding step, the focus-mode editor with its slash
menu, the published blog, and the small gallery previews. They stay sharp at any
size and follow the active theme, which a PNG would not.

## Motion

Sections fade and rise as they enter the viewport (`Reveal`), and grids release
their children in sequence (`Stagger`). Every wrapper reads
`useReducedMotion()` and renders a plain `div` when the visitor prefers reduced
motion.

Two deliberate exceptions:

- The hero animates from CSS (`.animate-rise`), not JavaScript, so the first
  screen paints immediately instead of waiting for hydration.
- Reveal wrappers carry `data-reveal`, and a `<noscript>` rule in the layout
  forces them visible, so the page is never blank without JavaScript.

## Auth

**No token is ever stored in the browser.** The session lives in an httpOnly
cookie the backend sets, which JavaScript cannot read — so an XSS bug cannot
walk off with a session. The backend README explains the trade in full.

**`src/components/auth-provider.tsx`** calls `/api/auth/user/` on mount and
exposes `user`, `loading`, `login()`, `logout()`, `signup()` and `refresh()`.
Because the login endpoint returns 204 and nothing else, `login()` re-reads the
account before it resolves.

**`src/lib/api.ts`** sends `credentials: "include"` on every request and, for
unsafe methods, copies the `csrftoken` cookie into `X-CSRFToken`. A 401 fires a
single module-level handler that `AuthProvider` registers, so one place decides
what an expired session means — clear the user, go to `/login`. The mount-time
"who am I" call is exempt, since 401 is its normal answer for a signed-out
visitor.

### Route protection has two layers, and only one of them is real

1. **`src/middleware.ts`** redirects `/dashboard/*` to `/login?next=…` when the
   auth cookie is missing, and sends signed-in visitors away from `/login` and
   `/signup`. It runs server-side, so a protected page never renders first.
2. **The API's permission classes.** Every endpoint is `IsAuthenticated` by
   default and every queryset is filtered by the requesting user.

The middleware is a UX convenience and nothing more — anyone can set the cookie
in devtools and walk past it, and all they get is an empty dashboard shell,
because the backend still refuses every request. Never rely on it alone.

It reads a cookie called `postly_auth`, **not** `sessionid`. Django hands out a
session cookie to anonymous visitors too (allauth creates one during signup),
so "has a session cookie" is a different question from "is logged in" —
answering the first bounces a signed-out visitor between `/login` and
`/dashboard` forever. `postly_auth` tracks `request.user`, is set and cleared by
`AuthHintCookieMiddleware` on the backend, and carries no identity.

## Dashboard

`/dashboard` lists posts, `/dashboard/posts/[id]` is the editor, and
`/dashboard/settings` is the blog's name and description. All three are client
components — this is a logged-in surface, so there is no SEO argument for
server rendering, and the editor needs browser APIs anyway. An account with no
blog yet is sent to `/onboarding`.

**The post list is cards, not a table.** A table is for comparing rows on a
shared axis; a writer scanning their own posts is trying to recognise one, and
what they recognise it by is how it starts. So each card carries the state, the
date (or "last edited *n* minutes ago" for a draft), a read time, and three
lines of the actual prose — and expands in place, rather than navigating, to
show the whole post rendered with the same typography a reader gets. Skimming
eight posts for the one you half remember should not mean loading and leaving
eight pages.

**Filter, sort and search all run in the browser.** The API already returned
the whole set to draw the cards, so filtering it is an array operation and the
list reacts on the keystroke. Search covers body text, not just titles — it is
the body you remember when you cannot remember the title.

**`site-link-chip.tsx` is the one place a writer's own address appears.** Not
the marketing navbar, not the footer, not the account menu: a visitor to
postly.com is being sold a product, and somebody's personal URL has no business
there. The chip shows `sagar.postly.com`, which is where the blog will live,
and both "Copy link" and "View live" use `/sagar`, which is where it lives
today — the button's job is to hand over a link that opens. Phase 3 collapses
the two into one string.

**`src/lib/api.ts`** is the only place that talks to Django. It reads
`NEXT_PUBLIC_API_URL`, throws a typed `ApiError` carrying DRF's field-level
validation messages, and special-cases a network failure into "is the Django
server running?" rather than a bare `TypeError`. All session and CSRF handling
lives in its `request()` helper and nowhere else.

**The editor** uses TipTap v3. Two details worth knowing if you touch it:

- `immediatelyRender: false` is required under the App Router — rendering the
  editor on the server would not match the client's first paint.
- Fetching the post is keyed on `postId` alone, *not* on the editor instance.
  `useEditor` returns `null` on first render, so depending on it there would
  fetch twice and could overwrite what had been typed in between. A separate
  effect pushes the body into TipTap once both exist.

**Autosave** compares a `draft` object against the last server-confirmed
`persisted` one; any difference schedules a `PATCH` 2 seconds later, and each
keystroke replaces the pending timer. Publishing sends the pending edits in the
same request, so it can never capture a stale body. A `beforeunload` guard
catches a tab closed mid-edit.

## The public blog

`/{siteSlug}` and `/{siteSlug}/{postSlug}` are Server Components. A reader gets
HTML on the first byte, a crawler gets the whole article without running any
JavaScript, and `generateMetadata` supplies per-post title, description and
Open Graph tags. Pages are cached and revalidated every 60 seconds, so an edit
in the dashboard is live within the minute without a rebuild.

There is no `generateStaticParams` for `siteSlug`: that would need a list of
every blog on Postly, and no public endpoint hands one out — it would be a
directory of every customer. Post slugs *are* pre-rendered, per blog, once
Next has seen that blog.

### Theming

A writer chooses how their blog looks in **Settings → How your blog looks**,
and `src/lib/blog-theme.ts` is the only place those colours exist. The
database stores a name — `"sepia"` — never a value, so picking a theme is
choosing an index into that table and there is no route by which something a
writer typed reaches a stylesheet.

| Control | What it offers |
| --- | --- |
| Theme | Paper, Slate, Sepia, Mono — each authored in light *and* dark |
| Appearance | Light, Dark, or follow the reader's `prefers-color-scheme` |
| Type | Three pairings across the three families already loaded |
| Accent | One hue, 0–360, on a slider whose track is the hue wheel |

**The accent is a hue and not a colour picker, deliberately.** Every value is
OKLCH, where lightness is perceptual — so fixing L and C per role and letting
only H vary keeps contrast exactly where it was designed at all 360 settings.
A writer cannot produce grey-on-grey, because they are never handed lightness.
A hex field would also need a dark-mode counterpart for every colour someone
picks, which is not a thing a writer should have to think about.

The whole surface is **seven variables** — `--background`, `--foreground`,
`--muted`, `--muted-foreground`, `--border`, `--brand`, `--ring` — plus
`--blog-heading` and `--blog-body`. `.prose.prose-postly` already maps
`--tw-prose-*` onto the same tokens, so restyling the shell restyles the post
body for free. No theming library, no CSS-in-JS: Tailwind v4's `@theme inline`
and custom properties were already doing this for dark mode.

`blogThemeCss()` emits one `<style>` element from the blog layout, which is a
Server Component — so the first byte a reader gets is already in the right
colours. Two details in there are load-bearing:

- **It is a `<style>` element, not a `style` prop**, because "follow the
  reader" needs `@media (prefers-color-scheme: dark)` and a style attribute
  cannot express a media query. Nothing in the string comes from user input,
  so the usual objection to building CSS by concatenation does not apply here.
- **The selector is `:root:has([data-blog-theme])`**, which is two classes'
  worth of specificity against `.dark`, and targets `:root` so `<body>` is
  covered and overscroll does not reveal the app's background.

`color-scheme` carries `!important` because `next-themes` writes it as an
inline style on `<html>`, and an inline declaration beats any stylesheet rule
however specific. It should be unreachable now that the provider lives in the
`(app)` group — but a stale value surviving a client-side navigation would
give a light blog a dark scrollbar.

**`src/lib/public-api.ts` is the seam Phase 3 turns on.** Every function there
takes a site slug as its first argument and nothing in the file knows where
that slug came from. Today the URL path supplies it; tomorrow the `Host` header
will. See [Testing subdomains locally](#testing-subdomains-locally).

The design is one 680px column — roughly 70 characters at the reading size —
serif body at 19px, and generous leading. Postly appears exactly once, as a
"Published with Postly" credit in the footer.

**Post bodies are rendered with `dangerouslySetInnerHTML`, and that is safe
because of what happens on the server**, not because of anything here: the
public API cleans every body against an allowlist on its way out
(`postly-backend/blog/sanitize.py`). Until each blog has its own subdomain, a
published blog shares an origin with the dashboard, so an unsanitised
`<script>` in somebody's post would run with a reading writer's session behind
it.

## Notes

- Pricing tiers are **Free / Pro / Publication**. The brief suggested naming the
  third tier "Custom Domain"; a custom domain reads better as a headline feature
  of Pro than as a tier name, so it appears there instead.
- Publication names in the logo strip and the testimonial authors are invented
  placeholders, not real outlets or people.
- The homepage's section links are still `#` anchors. Its calls to action are
  not: "Log in" goes to `/login`, and every "Start writing" button — navbar,
  hero, closing banner, and the Free and Pro plans — goes to `/signup`. The
  Publication plan's button is a `mailto:`, since that tier is a conversation
  rather than a self-serve signup.
- `middleware.ts` raises a deprecation warning on Next 16.3 ("use `proxy`
  instead") and still works. It was left under the conventional name; renaming
  the file to `proxy.ts` and its export to `proxy` is the whole migration when
  you want the warning gone.
