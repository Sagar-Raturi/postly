import Link from "next/link";
import { ReadingColumn } from "@/components/public/reading-column";

/**
 * The blog's own masthead: the writer's name, linking home, and nothing
 * else.
 *
 * No logo, no navigation, no account menu. Postly appears once on a
 * published blog, in the footer, and this is not that place.
 */
export function BlogHeader({ name, slug }: { name: string; slug: string }) {
  return (
    <header className="border-b border-border/70 py-6 sm:py-8">
      <ReadingColumn>
        <Link
          href={`/${slug}`}
          className="rounded-sm font-display text-[1.0625rem] tracking-[-0.01em] text-foreground transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {name}
        </Link>
      </ReadingColumn>
    </header>
  );
}
