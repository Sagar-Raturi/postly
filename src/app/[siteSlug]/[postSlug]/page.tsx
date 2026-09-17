import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogShell } from "@/components/public/blog-shell";
import { PostNav } from "@/components/public/post-nav";
import {
  adjacentPosts,
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
 *
 * **The article column is 720px, narrower than the feed's.** That is not an
 * inconsistency with the index: scanning a list and reading an essay are
 * different jobs. A wide measure is fine for titles and two-line excerpts
 * the eye jumps between, and bad for forty minutes of continuous prose,
 * where every line ending is a chance to lose your place.
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
  // Post.author is nulled rather than cascaded when an account closes, so
  // the blog's owner is the fallback byline.
  const author = post.author ?? site.display_name;

  return {
    // The layout's template appends the blog name.
    title: post.title,
    description,
    authors: [{ name: author }],
    alternates: { canonical: `/${siteSlug}/${post.slug}` },
    openGraph: {
      type: "article",
      siteName: site.name,
      title: post.title,
      description,
      publishedTime: post.published_at,
      authors: [author],
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

  // The site and the post list are both already cached by the layout's own
  // call, so the only new request here is the post itself.
  const [site, post, posts] = await Promise.all([
    getPublicSite(siteSlug),
    getPublicPost(siteSlug, postSlug),
    listPublicPosts(siteSlug),
  ]);

  if (!site || !post) notFound();

  const { newer, older } = adjacentPosts(posts ?? [], post.slug);

  return (
    <BlogShell site={site} posts={posts ?? []}>
      <article className="max-w-[720px]">
        <header>
          <h1 className="font-blog-heading text-[30px] leading-[1.15] tracking-[-0.02em] text-balance sm:text-[42px]">
            {post.title}
          </h1>

          <p className="mt-4 text-[13px] text-muted-foreground">
            <time dateTime={post.published_at}>
              {formatPublishedDate(post.published_at)}
            </time>
            <span aria-hidden className="px-2 opacity-60">
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

          `prose-blog` is the reading-size variant of `prose-postly`: 19px
          at 1.7, 1.5em between paragraphs, and images allowed to break out
          past the 720px measure. See globals.css.
        */}
        <div
          className="prose prose-postly prose-blog mt-12 max-w-none font-blog-body"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </article>

      <div className="max-w-[720px]">
        <PostNav siteSlug={siteSlug} newer={newer} older={older} />
      </div>
    </BlogShell>
  );
}
