import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingColumn } from "@/components/public/reading-column";
import {
  formatPublishedDate,
  formatReadTime,
  getPublicSite,
  listPublicPosts,
  metaDescription,
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
 */

export async function generateMetadata({
  params,
}: PageProps<"/[siteSlug]">): Promise<Metadata> {
  const { siteSlug } = await params;
  const site = await getPublicSite(siteSlug);

  if (!site) return {};

  return {
    // Absolute, so the index is titled "Sagar Raturi" and not
    // "Sagar Raturi · Sagar Raturi" through the layout's template.
    title: { absolute: site.name },
    description: metaDescription(site.description),
  };
}

export default async function BlogIndexPage({
  params,
}: PageProps<"/[siteSlug]">) {
  const { siteSlug } = await params;
  const [site, posts] = await Promise.all([
    getPublicSite(siteSlug),
    listPublicPosts(siteSlug),
  ]);

  if (!site || !posts) notFound();

  return (
    <ReadingColumn className="py-14 sm:py-20">
      <header>
        <h1 className="font-display text-[2rem] leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2.6rem]">
          {site.name}
        </h1>
        {site.description ? (
          <p className="mt-4 font-display text-[1.125rem] leading-[1.65] text-pretty text-muted-foreground sm:text-[1.1875rem]">
            {site.description}
          </p>
        ) : null}
      </header>

      <hr className="my-12 border-border/70" />

      {posts.length === 0 ? (
        <p className="font-display text-[1.0625rem] text-muted-foreground">
          Nothing published here yet.
        </p>
      ) : (
        <ul className="space-y-10 sm:space-y-12">
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <h2 className="font-display text-[1.4rem] leading-[1.3] tracking-[-0.015em] text-pretty sm:text-[1.55rem]">
                  <Link
                    href={`/${site.slug}/${post.slug}`}
                    className="rounded-sm transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {post.title}
                  </Link>
                </h2>

                <p className="mt-2 font-mono text-[0.72rem] tracking-wide text-muted-foreground uppercase">
                  <time dateTime={post.published_at}>
                    {formatPublishedDate(post.published_at)}
                  </time>
                  <span aria-hidden className="px-2">
                    ·
                  </span>
                  {formatReadTime(post.read_time_minutes)}
                </p>

                {post.excerpt ? (
                  <p className="mt-3 font-display text-[1.0625rem] leading-[1.7] text-pretty text-muted-foreground">
                    {post.excerpt}
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </ReadingColumn>
  );
}
