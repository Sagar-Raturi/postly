import Link from "next/link";
import { ReadingColumn } from "@/components/public/reading-column";

/**
 * Shown for an unknown blog, an unknown post, and a draft's URL — the same
 * page for all three, which is the point: a reader who guesses at the
 * address of an unpublished post learns nothing from the answer.
 *
 * Note this renders without the blog layout's header when the *site* is
 * what was not found, because there is no site to name.
 */
export default function BlogNotFound() {
  return (
    <ReadingColumn className="flex flex-1 flex-col justify-center py-24 text-center">
      <h1 className="font-blog-heading text-[1.75rem] tracking-[-0.02em] sm:text-[2rem]">
        Nothing here
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-[1.0625rem] leading-[1.7] text-pretty text-muted-foreground">
        This page has either moved, or was never published.
      </p>
      <p className="mt-8 text-[0.85rem] text-muted-foreground">
        <Link
          href="/"
          className="rounded-sm font-medium text-foreground underline decoration-border underline-offset-[0.25em] transition-colors hover:text-brand hover:decoration-brand/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Postly
        </Link>
      </p>
    </ReadingColumn>
  );
}
