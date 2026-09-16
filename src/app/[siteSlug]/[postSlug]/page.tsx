import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ReadingColumn } from "@/components/public/reading-column";
import {
  formatPublishedDate,
  formatReadTime,
  getPublicPost,
  getPublicSite,
  listPublicPosts,
  metaDescription,
} from "@/lib/public-api";

/**
 * One published post.
 *
 * Server-rendered for the same reasons as the index — fast first paint, and
 * a crawler sees the whole article without running anything.
 *
 * A draft reaches this page as a 404 from the API, which becomes Next's
 * notFound(). That is the same answer a post that does not exist gets, so
 * the URL of an unpublished draft tells a reader nothing.
 */

/**
 * Pre-renders the posts of a blog that has already been visited. The
 * `siteSlug` half cannot be enumerated — see the note on the index page —
 * so this fills in the second segment for sites Next already knows about,
 * and anything else renders on demand and is then cached.
 */
export async function generateStaticParams({
  params,
}: {
  params: { siteSlug: string };
}) {
  const posts = await listPublicPosts(params.siteSlug);
  return (posts ?? []).map((post) => ({ postSlug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[siteSlug]/[postSlug]">): Promise<Metadata> {
  const { siteSlug, postSlug } = await params;
  const [site, post] = await Promise.all([
    getPublicSite(siteSlug),
    getPublicPost(siteSlug, postSlug),
  ]);

  if (!site || !post) return { title: "Post not found" };

  const description = metaDescription(post.excerpt);

  return {
    // The layout's template appends the blog name.
    title: post.title,
    description,
    alternates: { canonical: `/${siteSlug}/${post.slug}` },
    openGraph: {
      type: "article",
      siteName: site.name,
      title: post.title,
      description,
      publishedTime: post.published_at,
      authors: post.author ? [post.author] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

export default async function PostPage({
  params,
}: PageProps<"/[siteSlug]/[postSlug]">) {
  const { siteSlug, postSlug } = await params;
  const post = await getPublicPost(siteSlug, postSlug);

  if (!post) notFound();

  return (
    <ReadingColumn className="py-14 sm:py-20">
      <article>
        <header>
          <h1 className="font-display text-[2rem] leading-[1.15] tracking-[-0.02em] text-balance sm:text-[2.5rem]">
            {post.title}
          </h1>

          <p className="mt-5 font-mono text-[0.72rem] tracking-wide text-muted-foreground uppercase">
            <time dateTime={post.published_at}>
              {formatPublishedDate(post.published_at)}
            </time>
            <span aria-hidden className="px-2">
              ·
            </span>
            {formatReadTime(post.read_time_minutes)}
          </p>
        </header>

        {/*
          The body is HTML the writer stored. It is cleaned against an
          allowlist server-side, on its way out of the public API, because
          until blogs move to their own subdomains this page shares an
          origin with the dashboard — see postly-backend/blog/sanitize.py.
        */}
        <div
          className="prose prose-postly mt-10 max-w-none font-display text-[1.1875rem] leading-[1.75]"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>

      <nav className="mt-16 border-t border-border/70 pt-8">
        <Link
          href={`/${siteSlug}`}
          className="inline-flex items-center gap-2 rounded-sm text-[0.9rem] text-muted-foreground transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          All posts
        </Link>
      </nav>
    </ReadingColumn>
  );
}
