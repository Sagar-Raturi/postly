import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogShell } from "@/components/public/blog-shell";
import { PostFeed } from "@/components/public/post-feed";
import {
  getPublicSite,
  listPublicPosts,
  metaDescription,
  parseYearParam,
  postsInYear,
} from "@/lib/public-api";

/**
 * A blog's index: who writes it, and every post they have published,
 * newest first.
 *
 * A Server Component, so a reader gets HTML on the first byte and a crawler
 * gets the whole page without running any JavaScript. `revalidate` lives on
 * the fetches in lib/public-api.ts, which means an edit in the dashboard
 * shows up here within the minute without a rebuild.
 *
 * There is no generateStaticParams: that would need a list of every blog on
 * Postly, and no public endpoint hands one out — deliberately, since it
 * would be a directory of every customer.
 *
 * `?year=2025` filters the feed to one year, which is what the archive in
 * the profile panel links to. The filtering happens here rather than in the
 * API because the page already holds every post in order to count them for
 * that archive — asking the server to send a subset of what it just sent
 * would be a second round trip for an array operation.
 */

export async function generateMetadata({
  params,
}: PageProps<"/[siteSlug]">): Promise<Metadata> {
  const { siteSlug } = await params;
  const site = await getPublicSite(siteSlug);

  if (!site) return {};

  const description = metaDescription(site.description || site.tagline);

  return {
    // Absolute, so the index is titled "Sagar Raturi" and not
    // "Sagar Raturi · Sagar Raturi" through the layout's template.
    title: { absolute: site.name },
    description,
    openGraph: {
      type: "website",
      siteName: site.name,
      title: site.name,
      description,
    },
  };
}

export default async function BlogIndexPage({
  params,
  searchParams,
}: PageProps<"/[siteSlug]">) {
  const { siteSlug } = await params;
  const [site, posts] = await Promise.all([
    getPublicSite(siteSlug),
    listPublicPosts(siteSlug),
  ]);

  if (!site || !posts) notFound();

  // Anything that is not a plausible year comes back null, so a reader who
  // edits the URL gets the whole index rather than an error.
  const year = parseYearParam((await searchParams).year);
  const visible = year ? postsInYear(posts, year) : posts;

  return (
    <BlogShell
      site={site}
      posts={posts}
      activeYear={year}
      subscribeSource="index"
      subscribeOnMobile
    >
      {site.description ? (
        <p className="mb-12 max-w-[68ch] text-[19px] leading-[1.65] text-pretty text-foreground">
          {site.description}
        </p>
      ) : null}

      {year ? (
        <div className="mb-12 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-border/70 pb-6">
          <h1 className="font-blog-heading text-[22px] leading-[1.25] tracking-[-0.015em]">
            {visible.length} {visible.length === 1 ? "post" : "posts"} from{" "}
            {year}
          </h1>
          <Link
            href={`/${site.slug}`}
            className="rounded-sm text-[15px] text-brand transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            Show all posts
          </Link>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-[16px] text-muted-foreground">
          {year
            ? "Nothing was published that year."
            : "Nothing published here yet."}
        </p>
      ) : (
        <PostFeed siteSlug={site.slug} posts={visible} />
      )}

    </BlogShell>
  );
}
