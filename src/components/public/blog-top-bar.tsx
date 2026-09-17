import Link from "next/link";
import { PageContainer } from "@/components/public/page-container";
import { marketingLinkProps } from "@/lib/marketing-url";

/**
 * The full-width bar above the two columns: whose blog this is, and a
 * quiet mark saying what it was built with.
 *
 * The balance between those two is the whole design of this component. The
 * writer's name is the only thing here set in the display face; Postly's
 * mark is 20px tall, muted, and brightens on hover — a credit in the way a
 * printer's mark on the last page of a book is a credit. Anything louder
 * would be Postly advertising on somebody else's site, using their readers'
 * attention to do it.
 */
export function BlogTopBar({
  name,
  tagline,
  slug,
}: {
  name: string;
  tagline: string;
  slug: string;
}) {
  return (
    <header className="border-b border-border/70">
      <PageContainer>
        <div className="flex items-start justify-between gap-6 py-6 sm:py-8">
          <div className="min-w-0">
            <Link
              href={`/${slug}`}
              className="rounded-sm font-blog-heading text-[22px] leading-[1.25] font-medium tracking-[-0.015em] text-foreground transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              {name}
            </Link>

            {tagline ? (
              <p className="mt-1 text-[15px] leading-[1.5] text-pretty text-muted-foreground">
                {tagline}
              </p>
            ) : null}
          </div>

          {/*
            Where this goes is NEXT_PUBLIC_MARKETING_URL — see
            lib/marketing-url.ts. It opens a new tab and carries
            rel="noopener" only when it actually leaves this origin: a
            reader clicking it is mid-read, but a same-origin link has no
            tab to protect and no reason to spawn one.
          */}
          <a
            {...marketingLinkProps()}
            aria-label="Published with Postly"
            className="group mt-1 inline-flex shrink-0 items-center gap-2 rounded-sm text-muted-foreground opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            <span
              aria-hidden
              className="inline-flex size-5 items-center justify-center rounded-[6px] border border-current"
            >
              <span className="font-blog-heading text-[13px] leading-none font-semibold">
                P
              </span>
            </span>
            <span
              aria-hidden
              className="hidden text-[13px] leading-none font-medium tracking-[-0.005em] sm:inline"
            >
              Postly
            </span>
          </a>
        </div>
      </PageContainer>
    </header>
  );
}
