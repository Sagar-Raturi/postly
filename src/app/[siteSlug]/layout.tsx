import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogTopBar } from "@/components/public/blog-top-bar";
import { BLOG_THEME_ATTRIBUTE, blogThemeCss } from "@/lib/blog-theme";
import { getPublicSite, metaDescription } from "@/lib/public-api";

/**
 * The shell every published blog is served in.
 *
 * Deliberately outside the `(app)` route group, so none of Postly's own
 * chrome reaches it: no marketing navbar, no dashboard header, no auth
 * provider, no "New post" button, and nothing anywhere that offers to log
 * anybody in. A reader with no Postly account should see one thing, which
 * is somebody's blog.
 *
 * ## The scales this surface is built on
 *
 * Everything under here picks from two fixed sets, and the point of
 * writing them down is that "roughly 50px" stops being an option:
 *
 * * **Spacing** — 4, 8, 12, 16, 24, 32, 48, 64, 96px. Tailwind's numeric
 *   spacing steps are 4px each, so these are `1 2 3 4 6 8 12 16 24`.
 *   Section gaps are 48 or 64, never something in between.
 * * **Type** — 13, 15, 16, 19, 22, 30, 42px, written as arbitrary values
 *   (`text-[19px]`) so the number is visible at the point of use rather
 *   than hidden behind a name like `text-lg`.
 *
 * Two families, both already loaded: the blog's chosen display face for
 * titles (`font-blog-heading`) and its body face for prose
 * (`font-blog-body`). Muted text is the theme's `--muted-foreground`,
 * which every palette defines at roughly 55-60% of the body colour —
 * not an opacity on black, which goes muddy over a tinted background.
 *
 * ## Dark mode
 *
 * Handled by the palette the writer chose, not by this file. Picking
 * "Follow the reader" in Settings emits a `prefers-color-scheme: dark`
 * block from `blogThemeCss()`; every theme's dark scheme is a warm
 * off-black (`oklch(0.16-0.20 …)`) rather than `#000`, because pure black
 * against light text produces halation at reading sizes.
 *
 * Phase 3 — real subdomains: `sagar.postly.com` rather than
 * `postly.com/sagar`. The only thing that has to change is where the slug
 * comes from. A rewrite in `middleware.ts` can map the Host header onto
 * this same route (`sagar.postly.com/x` → `/sagar/x`) and every file under
 * here keeps working, because none of them do anything with `siteSlug`
 * except hand it to `lib/public-api.ts`.
 */

export async function generateMetadata({
  params,
}: LayoutProps<"/[siteSlug]">): Promise<Metadata> {
  const { siteSlug } = await params;
  const site = await getPublicSite(siteSlug);

  if (!site) return { title: "Blog not found" };

  // The tagline is the writer's own one-line summary, so it beats the
  // longer description as a search result's second line. Either may be
  // empty, and an empty description is better than a made-up one.
  const description = metaDescription(site.tagline || site.description);

  return {
    // Post pages fill the `%s`; the index overrides this with an absolute
    // title, so it reads "Sagar Raturi" rather than "Sagar Raturi · Sagar
    // Raturi".
    title: { default: site.name, template: `%s · ${site.name}` },
    description,
    // Every page under here is by one person unless a post says otherwise.
    authors: [{ name: site.display_name }],
    // The blog is its own site, not a section of postly.com.
    alternates: { canonical: `/${site.slug}` },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: site.name,
      description,
    },
  };
}

export default async function BlogLayout({
  children,
  params,
}: LayoutProps<"/[siteSlug]">) {
  const { siteSlug } = await params;
  const site = await getPublicSite(siteSlug);

  // No blog at this address. Reached whenever a slug does not match — which
  // includes every unknown top-level path, since this route is the catch-all
  // under `/`.
  if (!site) notFound();

  return (
    <div
      {...{ [BLOG_THEME_ATTRIBUTE]: "" }}
      className="flex min-h-full flex-1 flex-col font-blog-body"
    >
      {/*
        The blog's palette, server-rendered, so the first byte a reader gets
        is already in the right colours — applying it after hydration would
        flash the default theme on every cold load.

        Not built from anything a writer typed: the values are constants in
        lib/blog-theme.ts, selected by name, and the only writer-controlled
        number in here is an integer hue the API bounds to 0-360.
      */}
      <style>{blogThemeCss(site)}</style>

      <BlogTopBar name={site.name} tagline={site.tagline} slug={site.slug} />

      {/*
        The two columns live in <BlogShell>, which the pages render rather
        than this layout. A layout receives no `searchParams`, and the
        archive in the profile panel has to know which year is filtering
        the feed in order to mark it.
      */}
      {children}
    </div>
  );
}
