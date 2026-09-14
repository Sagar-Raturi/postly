# Postly — marketing homepage

A single, scrollable homepage for Postly, a blog-publishing SaaS. Built with
Next.js (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui and Framer Motion.

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

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
    page.tsx              composes the nine sections in order
    globals.css           palette, type scale, custom utilities
  components/
    site/                 navbar, hero, how-it-works, features, social-proof,
                          examples, pricing, cta-banner, footer, primitives
    mockups/              browser-frame.tsx + screens.tsx
    motion/reveal.tsx     Reveal / Stagger / StaggerItem
  lib/content.ts          all copy and data for the page
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

## Notes

- Pricing tiers are **Free / Pro / Publication**. The brief suggested naming the
  third tier "Custom Domain"; a custom domain reads better as a headline feature
  of Pro than as a tier name, so it appears there instead.
- Publication names in the logo strip and the testimonial authors are invented
  placeholders, not real outlets or people.
- All links are `#` anchors — this is the homepage only.
