# Postly — frontend

Next.js (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui and Framer
Motion. Two independent products, served from one app:

**Postly itself** — everything under `src/app/(app)/`:

- **`/`** — the marketing homepage
- **`/login`, `/signup`, `/verify-email`, `/forgot-password`,
  `/reset-password/[token]`, `/onboarding`** — the account flows
- **`/dashboard`**, **`/dashboard/posts/[id]`**, **`/dashboard/settings`**,
  **`/dashboard/subscribers`** — the writing dashboard, behind a login,
  backed by the Django API in [`postly-backend/`](postly-backend/README.md)

**Published blogs** — `src/app/[siteSlug]/`:

- **`/{siteSlug}`** — a writer's blog index, with the subscribe form
- **`/{siteSlug}/{postSlug}`** — one published post
- **`/{siteSlug}/subscription/confirm`**, **`/{siteSlug}/subscription/unsubscribe`**
  — where the links in subscription emails land

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
`runserver`. `.claude/launch.json` defines both as preview servers
(`postly-dev` on :3000, `postly-api` / `postly-api-venv` on :8000).

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
    not-found.tsx         404 for anything that is not a blog
    error.tsx             error boundary below the root layout ("Try again")
    global-error.tsx      last resort when the root layout itself fails

    (app)/                Postly itself. The route group adds no URL segment.
      layout.tsx          Auth + Theme providers — the boundary the blog
                          sits outside of
      page.tsx            homepage — composes the sections in order
      login/ signup/ verify-email/ forgot-password/
      reset-password/[token]/ onboarding/
                          one server page each, rendering a client form
      privacy/ terms/     the legal pages, on components/site/legal-page.tsx
      dashboard/
        page.tsx          post list
        posts/[id]/       editor (awaits `params`, then the client UI)
        settings/         blog name, appearance, profile, avatar
        subscribers/      mailing-list counts, rows and CSV export

    [siteSlug]/           published blogs — server-rendered, no auth, no chrome
      layout.tsx          masthead + footer; 404s an unknown blog
      page.tsx            the index: description and every published post
      [postSlug]/page.tsx one post, with generateMetadata + Open Graph
      subscription/       confirm/ and unsubscribe/ — token pages from emails
      not-found.tsx       one page for "no such blog", "no such post", "draft"

  components/
    auth-provider.tsx     user, loading, login/logout/signup, 401 handling
    theme-provider.tsx    next-themes, for the (app) group only
    auth/                 auth-shell, field, and one component per page
    status-page.tsx       the shell for the 404 and error pages
    site/                 navbar, hero, how-it-works, features, examples,
                          pricing, cta-banner, footer, legal-page, primitives,
                          logo, theme-toggle
    dashboard/            dashboard-nav, account-menu, post-list, post-card,
                          post-toolbar, post-editor, editor-toolbar,
                          settings-panel, avatar-field, theme-picker,
                          theme-preview, subscribers-panel
    public/               page-container, blog-top-bar, blog-shell,
                          profile-panel, post-feed, post-nav, subscribe-form,
                          subscription-shell, confirm-subscription, unsubscribe
    ui/                   shadcn/ui primitives
    mockups/              browser-frame.tsx + screens.tsx
    motion/reveal.tsx     Reveal / Stagger / StaggerItem
  lib/
    content.ts            all homepage copy and data
    api.ts                typed client for the private API — session + CSRF
    public-api.ts         typed client for /api/public — no session, no cookies
    subscribe-api.ts      subscribe / confirm / unsubscribe, from the browser
    blog-refresh.ts       Server Action: expire the writer's own blog cache
    request-blog-refresh.ts  coalesces calls to the above, fire-and-forget
    blog-theme.ts         the palettes, and the only place blog colours exist
    marketing-url.ts      where the "Published with Postly" credit points
    operator.ts           operator name, location, contact email
    form-errors.ts        DRF error bodies → per-field messages
    initials.ts, utils.ts
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
unsafe methods, copies the `csrftoken` cookie into `X-CSRFToken` — fetching
the cookie from `/api/auth/csrf/` first if it is missing, because the
signed-out forms are CSRF-checked as well and are the likeliest to run before
AuthProvider's mount-time fetch has finished. A 401 fires a
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

`/dashboard` lists posts, `/dashboard/posts/[id]` is the editor,
`/dashboard/settings` is the blog's name, look and the writer's profile, and
`/dashboard/subscribers` is the mailing list. All four are client
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

**The site link in `dashboard-nav.tsx` is the one place a writer's own address appears.** Not
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
Open Graph tags.

Every public fetch is cached with a 60-second `revalidate` and tagged
`blogTag(siteSlug)`. A dashboard change a reader could see — an autosave on a
published post, publishing, settings, the avatar — calls
`requestBlogRefresh()`, which runs the `refreshMyBlog()` Server Action to
expire that tag, so the writer sees their change on the next load rather than
up to a minute later. The 60 seconds is only the fallback.

`refreshMyBlog()` takes **no arguments**, deliberately. A Server Action is a
public POST endpoint, so accepting a slug would let anyone expire any blog's
cache on a loop. Instead it forwards the request's own session cookie to the
API and expires only the blogs that session owns. `requestBlogRefresh()`
collapses calls made while one is in flight into a single follow-up, because
Server Actions run one at a time per tab and a sleeping free-tier API can take
the best part of a minute to answer the first.

There is no `generateStaticParams`, for either segment. One for `siteSlug`
would need a list of every blog on Postly, and no public endpoint hands one
out — it would be a directory of every customer. And a child segment's params
come from its parent's, so one on `[postSlug]` only ever ran at build time
with `siteSlug` undefined. Pages render on demand and are then cached.

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

### The layout

A 1180px container, a full-width top bar, and below it a two-column grid:
`300px 1fr` with a 64px gutter.

```
┌───────────────────────────────────────────────────────────┐
│ Sagar Raturi                                      ᴾ Postly│  top bar
│ Software, mountains, and the long way round.              │
├───────────────┬───────────────────────────────────────────┤
│  ( SR )       │  Three Weeks in Spiti Valley              │
│  Sagar Raturi │  24 February 2026 · 9 min read            │
│  ABOUT        │  The bus leaves Manali at five…           │
│  Backend eng… │  Read more →                              │
│  ─────────    │  ───────────────────────────────────────  │
│  ARCHIVE      │  The Case for Boring Technology           │
│  2026     16  │  …                                        │
│  2025      4  │                                           │
│  Published…   │                                           │
└───────────────┴───────────────────────────────────────────┘
      sticky                    feed / article
```

**The left column is `position: sticky`** at `top: 48px`, so the writer
stays on screen while their posts scroll past. It is context, and context
that scrolls away has stopped being context.

**Everything in the panel except the name is optional**, and each absent
piece is absent rather than empty: no avatar draws an initials circle in
the theme accent, no bio removes the About section entirely, and no
published address renders no email row at all. An empty row reads as a
fault in the page.

**Posts are blocks, not cards.** Separation is whitespace and a hairline —
24px down to the rule, 56px up from it to the next title. A card says
"these are separate objects"; a run of essays by one person is not a grid
of products.

**The post page narrows to 720px** while the feed stays wide. That is not
an inconsistency: scanning a list and reading an essay are different jobs,
and a measure that is fine for titles and two-line excerpts is bad for
forty minutes of prose. Images inside a post break back out to 820px,
because a photograph has no line length. The breakout is computed
(`min(820px, 100vw - 40px)`), so it collapses to a plain fitted image on a
phone with no media query.

Below 1024px the grid becomes one column and the panel turns into a
horizontal card above the feed, losing the sticky. Below 640px the avatar
drops to 64px, the container padding to 20px, and post titles to 24px. The
Postly mark stays top-right at every width.

### The scales

Two fixed sets, written down in the blog layout's docstring so that
"roughly 50px" stops being an option:

| | |
| --- | --- |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64, 96px — section gaps are 48 or 64 |
| Type | 13, 15, 16, 19, 22, 30, 42px, written as `text-[19px]` |

Two families, both already loaded: the blog's chosen display face for
titles and its body face for prose. Muted text is the theme's
`--muted-foreground`, which every palette defines at roughly 55-60% of the
body colour — not an opacity on black, which goes muddy over a tinted
background.

Postly appears twice and quietly: a 20px mark top-right in the bar, and a
"Published with Postly" credit at the foot of the profile panel (which
moves to the bottom of the page when the panel is a horizontal card, so
there is never more than one visible).

### The profile, and the email address

`display_name`, `bio` and `avatar` come from the **account**, not the
blog — they describe the person, and a person with two blogs is the same
person. `tagline` comes from the Site, because it describes the
publication.

**Whether a reader sees the writer's address is the writer's choice, and
the switch is enforced on the server.** `show_email_publicly` defaults to
`False`, and when it is off `PublicSiteSerializer.to_representation` pops
the key out of the response entirely. Not `null`, not `""` — absent.

That distinction is the whole feature. Serializing the address and letting
the blog decide what to draw would put a private address in a public HTTP
response, where anyone with `curl` has it whatever the page renders. And a
`null` invites a frontend to draw an empty row or a "hidden" placeholder,
where an absent key has exactly one possible rendering.

The writer turns it on in **Settings → Your public profile**, which saves
on the switch rather than behind a Save button: the only question the
control answers is "is my address public right now", so the honest answer
has to be the one on screen.

`avatar` is a real `ImageField` and the public API serves its URL. The
writer sets it in **Settings** (`avatar-field.tsx`), which uploads straight
away rather than waiting for Save — `POST` / `DELETE /api/auth/user/avatar/`.
The backend crops and re-encodes every upload to a small square image
(`postly-backend/accounts/avatars.py`), so what is stored is a few KB whatever
was chosen. A writer without one gets the initials circle, which is a
designed state rather than a gap.

**Post bodies are rendered with `dangerouslySetInnerHTML`, and that is safe
because of what happens on the server**, not because of anything here: the
public API cleans every body against an allowlist on its way out
(`postly-backend/blog/sanitize.py`). Until each blog has its own subdomain, a
published blog shares an origin with the dashboard, so an unsanitised
`<script>` in somebody's post would run with a reading writer's session behind
it.

## Email subscriptions

Readers subscribe from a form on the blog (`public/subscribe-form.tsx`). The
backend emails a confirmation link (double opt-in), and the
`subscription/confirm` and `subscription/unsubscribe` pages turn the token in
that link into an API call through `lib/subscribe-api.ts`. That client sends
no credentials and never caches, which is why it is separate from both
`api.ts` and `public-api.ts`.

When a post is published, the backend queues one email per subscriber and a
cron-run management command sends them after a short delay, so unpublishing
quickly cancels the send. `/dashboard/subscribers` is read-only: counts by
status, the list, and a CSV export. The backend README covers the sending
side.

Anything rendered inside a blog must use only the blog theme's colour
variables (`--background`, `--foreground`, `--muted`, `--muted-foreground`,
`--border`, `--brand`). Other Tailwind colours, like `text-destructive`,
resolve against Postly's own palette and lose contrast on a dark blog theme.
Emphasise an error with `text-foreground` against muted text, not red.

## Deployment

The frontend is on Vercel and the API on Render — two different registrable
domains. A `Lax` session cookie is never sent on a cross-site `fetch()`, so
`next.config.ts` proxies `/api/*` to the API. The browser only ever talks to
this origin, which keeps every cookie first-party.

| Variable | Local | Deployed |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | `/api` |
| `POSTLY_API_ORIGIN` | unset | the API's origin, e.g. `https://….onrender.com` |
| `NEXT_PUBLIC_MARKETING_URL` | unset (credit links to `/`) | the marketing domain, once it has a valid certificate |

`POSTLY_API_ORIGIN` is also what `lib/public-api.ts` uses for its server-side
fetches, which go to the API directly rather than looping back through the
proxy. `skipTrailingSlashRedirect` and the `:path(.*)` rewrite exist because
Django requires trailing slashes. Without them Next strips the slash, and a
request ends in a redirect loop or a rejected POST.

The step-by-step runbook and current deploy state live in
`.claude/skills/deploy/`.

## Notes

- **The homepage claims only what is built.** Pricing shows a single Free
  plan, because there is no billing. Features that are only planned — custom
  domains, RSS, image uploads, scheduling, Markdown export — are listed as
  "coming next" (`COMING_NEXT` in `src/lib/content.ts`) and nowhere else. The
  social-proof section (invented publications, testimonials and usage stats)
  was removed, and the example blogs are labelled as illustrations.
- Navbar and footer links are absolute (`/#features`), so they work from the
  legal pages too. Every link on the site goes somewhere; there are no `#`
  placeholders.
- `/privacy` and `/terms` are plain-language drafts written from what the
  code does. The operator name, location and contact email come from
  `src/lib/operator.ts`, and several of those are still placeholders — see
  "Placeholders to replace before launch" in `CLAUDE.md`.
- `middleware.ts` raises a deprecation warning on Next 16.3 ("use `proxy`
  instead") and still works. It was left under the conventional name; renaming
  the file to `proxy.ts` and its export to `proxy` is the whole migration when
  you want the warning gone.
