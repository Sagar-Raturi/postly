# Postly — frontend

Next.js (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui and Framer
Motion. Three surfaces:

- **`/`** — the marketing homepage
- **`/login`, `/signup`, `/verify-email`, `/forgot-password`,
  `/reset-password/[token]`, `/onboarding`** — the account flows
- **`/dashboard`** — the writing dashboard, behind a login, backed by the
  Django API in [`postly-backend/`](postly-backend/README.md)

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL
npm run dev                    # http://localhost:3000
npm run build
npm run lint
```

The dashboard needs the Django API running on `:8000` as well — see
[postly-backend/README.md](postly-backend/README.md) for that half. Its setup
is `pip install -r requirements.txt`, `migrate`, `seed_demo_site`, `runserver`.

Then sign up at <http://localhost:3000/signup>. Email verification is
mandatory, and in development the confirmation link prints to the terminal
running `runserver` rather than being sent — the backend README has the
details. `seed_demo_site` creates a pre-verified `demo@postly.test` /
`small-hours-demo` if you would rather skip that.

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

## Structure

```
src/
  middleware.ts           route guard for /dashboard, /login, /signup
  app/
    layout.tsx            fonts, metadata, theme + auth providers, no-JS fallback
    page.tsx              homepage — composes the nine sections in order
    globals.css           palette, type scale, custom utilities, editor prose
    login/ signup/ verify-email/ forgot-password/
    reset-password/[token]/ onboarding/
                          one server page each, rendering a client form
    dashboard/
      page.tsx            post list
      posts/[id]/page.tsx editor (awaits `params`, then renders the client UI)
  components/
    auth-provider.tsx     user, loading, login/logout/signup, 401 handling
    auth/                 auth-shell, field, and one component per page
    site/                 navbar, hero, how-it-works, features, social-proof,
                          examples, pricing, cta-banner, footer, primitives
    dashboard/            dashboard-header, account-menu, post-list,
                          post-editor, editor-toolbar
    mockups/              browser-frame.tsx + screens.tsx
    motion/reveal.tsx     Reveal / Stagger / StaggerItem
  lib/
    content.ts            all homepage copy and data
    api.ts                typed client for the Django API
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

`/dashboard` lists posts; `/dashboard/posts/[id]` is the editor. Both are
client components — this is a logged-in surface, so there is no SEO argument
for server rendering, and the editor needs browser APIs anyway. An account
with no blog yet is sent to `/onboarding`.

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
