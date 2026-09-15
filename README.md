# Postly — frontend

Next.js (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui and Framer
Motion. Two surfaces:

- **`/`** — the marketing homepage
- **`/dashboard`** — the Phase 1 writing dashboard, backed by the Django API
  in [`postly-backend/`](postly-backend/README.md)

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

> **No authentication yet.** Phase 1 deliberately ships without login, which
> means the API is wide open. Run both halves locally only, and read the
> warning at the top of the backend README before putting this anywhere.

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
  app/
    layout.tsx            fonts, metadata, theme provider, no-JS reveal fallback
    page.tsx              homepage — composes the nine sections in order
    globals.css           palette, type scale, custom utilities, editor prose
    dashboard/
      page.tsx            post list
      posts/[id]/page.tsx editor (awaits `params`, then renders the client UI)
  components/
    site/                 navbar, hero, how-it-works, features, social-proof,
                          examples, pricing, cta-banner, footer, primitives
    dashboard/            dashboard-header, post-list, post-editor,
                          editor-toolbar
    mockups/              browser-frame.tsx + screens.tsx
    motion/reveal.tsx     Reveal / Stagger / StaggerItem
  lib/
    content.ts            all homepage copy and data
    api.ts                typed client for the Django API
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

## Dashboard

`/dashboard` lists posts; `/dashboard/posts/[id]` is the editor. Both are
client components — this is a logged-in surface (eventually), so there is no
SEO argument for server rendering, and the editor needs browser APIs anyway.

**`src/lib/api.ts`** is the only place that talks to Django. It reads
`NEXT_PUBLIC_API_URL`, throws a typed `ApiError` carrying DRF's field-level
validation messages, and special-cases a network failure into "is the Django
server running?" rather than a bare `TypeError`. When Phase 2 adds auth, the
token handling belongs in its `request()` helper and nowhere else.

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
- All links are `#` anchors — this is the homepage only.
