import Link from "next/link";
import type { PublicPostSummary } from "@/lib/public-api";

/**
 * Newer / older, side by side under the article.
 *
 * "Newer" and "older" rather than "previous" and "next": the feed runs
 * newest first, so "next post" could reasonably mean either direction and
 * a reader should not have to work out which.
 *
 * Each block shows the actual title. A bare arrow asks somebody to click
 * and find out, which is the one thing a reader who has just finished
 * something is least willing to do.
 */
export function PostNav({
  siteSlug,
  newer,
  older,
}: {
  siteSlug: string;
  newer: PublicPostSummary | null;
  older: PublicPostSummary | null;
}) {
  if (!newer && !older) return null;

  return (
    <nav
      aria-label="More posts"
      className="mt-12 grid gap-4 border-t border-border/70 pt-8 sm:grid-cols-2"
    >
      {newer ? (
        <NavBlock siteSlug={siteSlug} post={newer} label="Newer" />
      ) : (
        // Holds the column so a lone "Older" stays on the right, where it
        // would be if both existed.
        <span aria-hidden className="hidden sm:block" />
      )}

      {older ? (
        <NavBlock siteSlug={siteSlug} post={older} label="Older" align="right" />
      ) : null}
    </nav>
  );
}

function NavBlock({
  siteSlug,
  post,
  label,
  align = "left",
}: {
  siteSlug: string;
  post: PublicPostSummary;
  label: string;
  align?: "left" | "right";
}) {
  return (
    <Link
      href={`/${siteSlug}/${post.slug}`}
      className={`group flex flex-col gap-2 rounded-sm py-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
        align === "right" ? "sm:items-end sm:text-right" : ""
      }`}
    >
      <span className="text-[13px] font-medium tracking-[0.08em] text-muted-foreground uppercase opacity-80">
        {label}
      </span>
      <span className="font-blog-heading text-[19px] leading-[1.35] text-pretty text-foreground transition-colors group-hover:text-brand">
        {post.title}
      </span>
    </Link>
  );
}
