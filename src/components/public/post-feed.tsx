import Link from "next/link";
import {
  formatPublishedDate,
  formatReadTime,
  type PublicPostSummary,
} from "@/lib/public-api";

/**
 * The blog index's list of posts.
 *
 * Blocks separated by whitespace and a hairline rule, not cards. A card is
 * a container, and a container says "these things are separate objects" —
 * a run of essays by one person is not a grid of products. The rule does
 * the same job as the space between entries in a printed contents page,
 * and costs no border radius, no shadow and no background.
 *
 * The rhythm between entries is 24px down to the rule and 56px up from it
 * to the next title. Deliberately uneven: a rule sitting midway between
 * two posts belongs to neither, while one tucked close under a post reads
 * as that post ending. The last entry has neither, so the page does not
 * end on a line with nothing after it.
 *
 * The excerpt is capped at 68 characters of measure even though the column
 * is far wider than that. A wide layout is not a licence to set long
 * lines: past roughly 75 characters the eye starts losing the return
 * sweep, and the fix is a shorter measure rather than more leading.
 */
export function PostFeed({
  siteSlug,
  posts,
}: {
  siteSlug: string;
  posts: PublicPostSummary[];
}) {
  return (
    <ul>
      {posts.map((post, index) => {
        const last = index === posts.length - 1;

        return (
          <li key={post.slug}>
            <article
              className={
                last ? undefined : "mb-14 border-b border-border/70 pb-6"
              }
            >
              <h2 className="font-blog-heading text-[24px] leading-[1.25] tracking-[-0.015em] text-pretty sm:text-[30px]">
                <Link
                  href={`/${siteSlug}/${post.slug}`}
                  className="rounded-sm transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                >
                  {post.title}
                </Link>
              </h2>

              <p className="mt-3 text-[13px] text-muted-foreground">
                <time dateTime={post.published_at}>
                  {formatPublishedDate(post.published_at)}
                </time>
                <span aria-hidden className="px-2 opacity-60">
                  ·
                </span>
                {formatReadTime(post.read_time_minutes)}
              </p>

              {post.excerpt ? (
                <p className="mt-4 max-w-[68ch] text-[16px] leading-[1.7] text-pretty text-muted-foreground">
                  {post.excerpt}
                </p>
              ) : null}

              <p className="mt-4">
                <Link
                  href={`/${siteSlug}/${post.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-sm text-[15px] text-brand transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                >
                  Read more
                  {/* Decorative: the link text already says where it goes. */}
                  <span aria-hidden>→</span>
                </Link>
              </p>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
