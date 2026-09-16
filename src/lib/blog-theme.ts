/**
 * The palettes a published blog can be rendered in.
 *
 * This file is the only place a blog's colours exist. The database stores a
 * name (`"sepia"`), never a colour, and the API publishes that name — so a
 * writer choosing a theme is choosing an index into this table, and there is
 * no path by which a string they typed reaches a stylesheet.
 *
 * Every colour is OKLCH, and that is doing real work rather than being a
 * fashion. Lightness in OKLCH is perceptual, so fixing L and C per role and
 * letting only the hue vary keeps contrast where the designer put it at every
 * hue on the dial. That is what makes "pick your own accent colour" safe to
 * offer: the writer cannot produce grey-on-grey, because they are not being
 * handed lightness.
 *
 * Each theme defines the seven tokens the blog actually consumes — no more.
 * Everything under `src/app/[siteSlug]/` and `src/components/public/`, and
 * the `.prose.prose-postly` rules the post body is set in, resolve to these.
 */

export type ThemeName = "paper" | "slate" | "sepia" | "mono";
export type Appearance = "light" | "dark" | "system";
export type FontPairing = "editorial" | "clean" | "plain";

/** An OKLCH triple, kept apart so the hue can be swapped on its own. */
interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** The seven variables a blog is drawn with, in one lightness. */
interface Scheme {
  background: Oklch;
  foreground: Oklch;
  muted: Oklch;
  mutedForeground: Oklch;
  border: Oklch;
  /** Links, blockquote rules, hover states — and the focus ring. */
  brand: Oklch;
}

export interface BlogTheme {
  label: string;
  /** One-line description, shown next to the swatch in settings. */
  description: string;
  light: Scheme;
  dark: Scheme;
}

export const THEMES: Record<ThemeName, BlogTheme> = {
  paper: {
    label: "Paper",
    description: "Warm off-white and ink, with a deep forest accent.",
    light: {
      background: { l: 0.9895, c: 0.004, h: 95 },
      foreground: { l: 0.215, c: 0.015, h: 62 },
      muted: { l: 0.962, c: 0.007, h: 95 },
      mutedForeground: { l: 0.502, c: 0.014, h: 70 },
      border: { l: 0.901, c: 0.008, h: 90 },
      brand: { l: 0.435, c: 0.082, h: 157 },
    },
    dark: {
      background: { l: 0.185, c: 0.012, h: 68 },
      foreground: { l: 0.945, c: 0.008, h: 95 },
      muted: { l: 0.268, c: 0.013, h: 68 },
      mutedForeground: { l: 0.706, c: 0.011, h: 82 },
      border: { l: 0.302, c: 0.012, h: 68 },
      brand: { l: 0.755, c: 0.112, h: 157 },
    },
  },

  slate: {
    label: "Slate",
    description: "Cool grey neutrals and an indigo accent.",
    light: {
      background: { l: 0.985, c: 0.003, h: 250 },
      foreground: { l: 0.205, c: 0.014, h: 258 },
      muted: { l: 0.958, c: 0.006, h: 250 },
      mutedForeground: { l: 0.498, c: 0.016, h: 256 },
      border: { l: 0.897, c: 0.008, h: 252 },
      brand: { l: 0.47, c: 0.12, h: 264 },
    },
    dark: {
      background: { l: 0.178, c: 0.012, h: 258 },
      foreground: { l: 0.942, c: 0.006, h: 250 },
      muted: { l: 0.262, c: 0.014, h: 258 },
      mutedForeground: { l: 0.7, c: 0.012, h: 252 },
      border: { l: 0.298, c: 0.012, h: 258 },
      brand: { l: 0.76, c: 0.11, h: 264 },
    },
  },

  sepia: {
    label: "Sepia",
    description: "Aged paper and terracotta. Reads like a paperback.",
    light: {
      background: { l: 0.972, c: 0.014, h: 85 },
      foreground: { l: 0.24, c: 0.022, h: 55 },
      muted: { l: 0.945, c: 0.02, h: 82 },
      mutedForeground: { l: 0.515, c: 0.028, h: 62 },
      border: { l: 0.886, c: 0.022, h: 80 },
      brand: { l: 0.5, c: 0.13, h: 45 },
    },
    dark: {
      background: { l: 0.196, c: 0.016, h: 58 },
      foreground: { l: 0.928, c: 0.014, h: 85 },
      muted: { l: 0.272, c: 0.018, h: 58 },
      mutedForeground: { l: 0.712, c: 0.018, h: 75 },
      border: { l: 0.31, c: 0.016, h: 58 },
      brand: { l: 0.76, c: 0.12, h: 45 },
    },
  },

  mono: {
    label: "Mono",
    description: "No colour at all. Links carry their weight underlined.",
    light: {
      background: { l: 1, c: 0, h: 0 },
      foreground: { l: 0.18, c: 0, h: 0 },
      muted: { l: 0.96, c: 0, h: 0 },
      mutedForeground: { l: 0.48, c: 0, h: 0 },
      border: { l: 0.89, c: 0, h: 0 },
      // Barely-there chroma, so the accent dial still reads as a tint
      // rather than doing nothing at all.
      brand: { l: 0.32, c: 0.02, h: 0 },
    },
    dark: {
      background: { l: 0.16, c: 0, h: 0 },
      foreground: { l: 0.96, c: 0, h: 0 },
      muted: { l: 0.255, c: 0, h: 0 },
      mutedForeground: { l: 0.69, c: 0, h: 0 },
      border: { l: 0.3, c: 0, h: 0 },
      brand: { l: 0.88, c: 0.02, h: 0 },
    },
  },
};

/**
 * The font pairings, as the two variables the blog's type is set in.
 *
 * A closed set, and it has to be: `next/font` resolves families at build
 * time, so a family nobody has declared cannot be loaded on request. Adding
 * a fifth pairing means adding a `next/font` call in the root layout — it is
 * not a thing a writer can do by typing a name.
 */
export const FONT_PAIRINGS: Record<
  FontPairing,
  { label: string; description: string; heading: string; body: string }
> = {
  editorial: {
    label: "Editorial",
    description: "Serif throughout. The default, and the most bookish.",
    heading: "var(--font-newsreader)",
    body: "var(--font-newsreader)",
  },
  clean: {
    label: "Clean",
    description: "Serif headlines over a sans body.",
    heading: "var(--font-newsreader)",
    body: "var(--font-inter)",
  },
  plain: {
    label: "Plain",
    description: "Sans throughout. Plainest and most neutral.",
    heading: "var(--font-inter)",
    body: "var(--font-inter)",
  },
};

export const DEFAULT_THEME: ThemeName = "paper";
export const DEFAULT_APPEARANCE: Appearance = "light";
export const DEFAULT_FONT_PAIRING: FontPairing = "editorial";

/** The attribute the blog wrapper carries, and the CSS hooks onto. */
export const BLOG_THEME_ATTRIBUTE = "data-blog-theme";

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

export interface BlogAppearance {
  theme: ThemeName;
  appearance: Appearance;
  font_pairing: FontPairing;
  accent_hue: number | null;
}

/**
 * Coerces whatever the API said into something in this table.
 *
 * The API validates these too, so an unknown name here means the two halves
 * have drifted — a blog should still render in that case, in the default
 * theme, rather than throw.
 */
function resolve(value: string | null | undefined, table: object, fallback: string) {
  return value && value in table ? value : fallback;
}

/** Clamps to the 0-360 the API already enforces. Belt and braces. */
function safeHue(hue: number | null | undefined): number | null {
  if (typeof hue !== "number" || !Number.isFinite(hue)) return null;
  return Math.min(360, Math.max(0, Math.round(hue)));
}

function oklch({ l, c, h }: Oklch, hueOverride: number | null): string {
  // Only the hue is ever replaced. Lightness and chroma stay as designed,
  // which is the whole reason the accent dial cannot produce something
  // unreadable.
  return `oklch(${l} ${c} ${hueOverride ?? h})`;
}

function declarations(scheme: Scheme, hue: number | null): string {
  const brand = oklch(scheme.brand, hue);

  return [
    `--background:${oklch(scheme.background, null)}`,
    `--foreground:${oklch(scheme.foreground, null)}`,
    `--muted:${oklch(scheme.muted, null)}`,
    `--muted-foreground:${oklch(scheme.mutedForeground, null)}`,
    `--border:${oklch(scheme.border, null)}`,
    `--brand:${brand}`,
    // The focus ring is the accent. One fewer thing for a theme to get
    // wrong, and it keeps keyboard focus visible on every palette.
    `--ring:${brand}`,
  ].join(";");
}

/**
 * The stylesheet for one blog.
 *
 * Emitted inline by the blog layout, which is a Server Component — so the
 * first byte the reader receives is already in the right colours. Applying
 * this after hydration would mean a flash of the default theme on every
 * cold load, which is exactly the thing people notice.
 *
 * On the selector: `:root:has([data-blog-theme])` is two classes' worth of
 * specificity against the `.dark` class next-themes puts on `<html>`, so a
 * blog wins deterministically rather than by source order. It has to win —
 * a reader's dark-mode preference for the *Postly* marketing site has no
 * business restyling somebody else's blog. Targeting `:root` rather than
 * the wrapper also means `<body>` is covered, so overscroll does not reveal
 * the app's background underneath.
 *
 * Nothing in the returned string comes from user input. The scheme values
 * are constants in this file; the only writer-controlled number is the hue,
 * which is an integer 0-360 by the time it gets here.
 */
export function blogThemeCss(site: Partial<BlogAppearance>): string {
  const theme = THEMES[resolve(site.theme, THEMES, DEFAULT_THEME) as ThemeName];
  const fonts =
    FONT_PAIRINGS[
      resolve(
        site.font_pairing,
        FONT_PAIRINGS,
        DEFAULT_FONT_PAIRING,
      ) as FontPairing
    ];
  const appearance = resolve(
    site.appearance,
    { light: 1, dark: 1, system: 1 },
    DEFAULT_APPEARANCE,
  ) as Appearance;

  const hue = safeHue(site.accent_hue);
  const type = `--blog-heading:${fonts.heading};--blog-body:${fonts.body}`;

  const base = appearance === "dark" ? theme.dark : theme.light;
  const scheme = appearance === "dark" ? "dark" : "light";

  // `color-scheme` carries !important because next-themes sets it as an
  // *inline* style on <html>, and an inline declaration beats any ordinary
  // stylesheet rule however specific. It should not be reachable — the
  // provider now lives in the (app) route group and never mounts on a blog
  // — but a stale value surviving a client-side navigation between the two
  // surfaces would give a light blog a dark scrollbar, and this is one word.
  let css =
    `:root:has([${BLOG_THEME_ATTRIBUTE}]){color-scheme:${scheme}!important;` +
    `${declarations(base, hue)};${type}}`;

  if (appearance === "system") {
    // The one thing an inline `style` prop cannot express, and the reason
    // this is a <style> element rather than a style attribute.
    css +=
      `@media (prefers-color-scheme:dark){` +
      `:root:has([${BLOG_THEME_ATTRIBUTE}]){color-scheme:dark!important;` +
      `${declarations(theme.dark, hue)}}}`;
  }

  return css;
}

/**
 * The same tokens as an inline style object, for the live preview in
 * settings — which is a client component and has no server render to put a
 * <style> element in.
 */
export function blogThemeVars(
  site: Partial<BlogAppearance>,
  scheme: "light" | "dark",
): Record<string, string> {
  const theme = THEMES[resolve(site.theme, THEMES, DEFAULT_THEME) as ThemeName];
  const fonts =
    FONT_PAIRINGS[
      resolve(
        site.font_pairing,
        FONT_PAIRINGS,
        DEFAULT_FONT_PAIRING,
      ) as FontPairing
    ];

  const hue = safeHue(site.accent_hue);
  const source = scheme === "dark" ? theme.dark : theme.light;
  const brand = oklch(source.brand, hue);

  return {
    "--background": oklch(source.background, null),
    "--foreground": oklch(source.foreground, null),
    "--muted": oklch(source.muted, null),
    "--muted-foreground": oklch(source.mutedForeground, null),
    "--border": oklch(source.border, null),
    "--brand": brand,
    "--ring": brand,
    "--blog-heading": fonts.heading,
    "--blog-body": fonts.body,
  };
}

/**
 * Which lightness a preview should show for a given appearance setting.
 * "Follow the reader" has no single answer, so the preview shows light and
 * says so.
 */
export function previewScheme(appearance: Appearance): "light" | "dark" {
  return appearance === "dark" ? "dark" : "light";
}
