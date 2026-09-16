import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogFooter } from "@/components/public/blog-footer";
import { BlogHeader } from "@/components/public/blog-header";
import { BLOG_THEME_ATTRIBUTE, blogThemeCss } from "@/lib/blog-theme";
import { getPublicSite, metaDescription } from "@/lib/public-api";

/**
 * The shell every published blog is served in.
 *
 * Deliberately outside the `(app)` route group, so none of Postly's own
 * chrome reaches it: no marketing navbar, no dashboard header, no auth
 * provider, no "New post" button. A reader with no Postly account should
 * see one thing, which is somebody's blog.
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

  return {
    // Post pages fill the `%s`; the index overrides this with an absolute
    // title, so it reads "Sagar Raturi" rather than "Sagar Raturi · Sagar
    // Raturi".
    title: { default: site.name, template: `%s · ${site.name}` },
    description: metaDescription(site.description),
    // The blog is its own site, not a section of postly.com.
    alternates: { canonical: `/${site.slug}` },
    openGraph: {
      type: "website",
      siteName: site.name,
      title: site.name,
      description: metaDescription(site.description),
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

      <BlogHeader name={site.name} slug={site.slug} />
      <main className="flex-1">{children}</main>
      <BlogFooter />
    </div>
  );
}
