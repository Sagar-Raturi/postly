import { ReadingColumn } from "@/components/public/reading-column";

/**
 * The one place Postly is named on somebody else's blog.
 *
 * Deliberately small and at the bottom: the product's presence on a
 * writer's site should read as a credit, not as a banner. `target="_blank"`
 * because a reader clicking it is leaving this blog for a different site,
 * and they were in the middle of reading.
 */
export function BlogFooter() {
  return (
    <footer className="mt-20 border-t border-border/70 py-8">
      <ReadingColumn>
        <p className="text-[0.8rem] text-muted-foreground">
          Published with{" "}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="rounded-sm font-medium text-foreground underline decoration-border underline-offset-[0.25em] transition-colors hover:text-brand hover:decoration-brand/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Postly
          </a>
        </p>
      </ReadingColumn>
    </footer>
  );
}
