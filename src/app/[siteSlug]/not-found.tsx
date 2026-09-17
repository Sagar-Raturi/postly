import Link from "next/link";
import { PageContainer } from "@/components/public/page-container";

/**
 * Shown for an unknown blog, an unknown post, and a draft's URL — the same
 * page for all three, which is the point: a reader who guesses at the
 * address of an unpublished post learns nothing from the answer.
 *
 * Self-contained rather than built from the blog's own furniture. When the
 * *site* is what was missing, the layout called notFound() and never
 * rendered, so there is no top bar, no profile panel and no theme here —
 * there is no writer to name. It therefore uses the app's default palette
 * and stands on its own.
 */
export default function BlogNotFound() {
  return (
    <PageContainer className="flex flex-1 flex-col justify-center py-24 text-center">
      <h1 className="font-display text-[30px] leading-[1.2] tracking-[-0.02em]">
        Nothing here
      </h1>
      <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.7] text-pretty text-muted-foreground">
        This page has either moved, or was never published.
      </p>
      <p className="mt-8 text-[15px] text-muted-foreground">
        <Link
          href="/"
          className="rounded-sm font-medium text-foreground underline decoration-border underline-offset-[0.25em] transition-colors hover:text-brand hover:decoration-brand/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          Postly
        </Link>
      </p>
    </PageContainer>
  );
}
