import Link from "next/link";
import type { ArchiveYear, PublicSite } from "@/lib/public-api";
import { marketingLinkProps } from "@/lib/marketing-url";

/**
 * Who writes this blog, standing beside what they wrote.
 *
 * Sticky from `lg` up, so it stays on screen while the feed scrolls — the
 * panel is context, and context that scrolls away stops being context.
 * Below `lg` it turns into a horizontal card above the feed and gives up
 * the sticky positioning: on a phone a pinned sidebar is just a thing
 * eating the screen.
 *
 * **Everything here is optional except the name.** A writer who has filled
 * in nothing gets an initials circle and their display name, and the
 * About, archive and email sections are absent rather than empty — a row
 * with nothing in it reads as a fault in the page.
 */
export function ProfilePanel({
  site,
  archive,
  activeYear,
}: {
  site: PublicSite;
  archive: ArchiveYear[];
  /** The year currently filtering the feed, so its row can be marked. */
  activeYear?: number | null;
}) {
  return (
    <aside
      aria-label={`About ${site.display_name}`}
      className="lg:sticky lg:top-12 lg:self-start"
    >
      {/* Horizontal below lg (avatar left, text right), stacked above it. */}
      <div className="flex items-start gap-4 sm:gap-6 lg:block">
        <Avatar site={site} />

        <div className="min-w-0 flex-1 lg:mt-4">
          <h2 className="font-blog-heading text-[22px] leading-[1.25] font-medium tracking-[-0.015em] text-foreground">
            {site.display_name}
          </h2>

          {/*
            Rendered only when the key is in the response. The API omits it
            entirely unless the writer switched it on, so there is nothing
            to hide here and no "hidden" state to draw — see
            PublicSiteSerializer.to_representation.
          */}
          {site.email ? (
            <a
              href={`mailto:${site.email}`}
              className="mt-1 inline-block rounded-sm text-[13px] leading-[1.5] break-all text-muted-foreground transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              {site.email}
            </a>
          ) : null}

          {/* The bio sits here on narrow screens, under the name, so the
              card reads as one block. On lg it moves down into its own
              section with the "About" heading. */}
          {site.bio ? (
            <p className="mt-3 text-[15px] leading-[1.65] text-pretty text-muted-foreground lg:hidden">
              {site.bio}
            </p>
          ) : null}
        </div>
      </div>

      {/* --- lg and up: About, archive, credit ------------------------- */}

      {site.bio ? (
        <section className="mt-8 hidden lg:block">
          <PanelHeading>About</PanelHeading>
          <p className="mt-3 text-[15px] leading-[1.7] text-pretty text-muted-foreground">
            {site.bio}
          </p>
        </section>
      ) : null}

      {archive.length > 0 ? (
        <section className="mt-8 hidden border-t border-border/70 pt-8 lg:block">
          <PanelHeading>Archive</PanelHeading>

          <ul className="mt-3 space-y-1">
            {archive.map(({ year, count }) => {
              const active = activeYear === year;

              return (
                <li key={year}>
                  <Link
                    href={active ? `/${site.slug}` : `/${site.slug}?year=${year}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-baseline justify-between gap-4 rounded-sm py-1 text-[15px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
                      active
                        ? "text-brand"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={active ? "font-medium" : undefined}>
                      {year}
                    </span>
                    <span className="text-[13px] tabular-nums opacity-70">
                      {count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 hidden border-t border-border/70 pt-6 lg:block">
        <a
          {...marketingLinkProps()}
          className="rounded-sm text-[13px] text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          Published with Postly
        </a>
      </div>
    </aside>
  );
}

/** The small muted label above each section of the panel. */
function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-medium tracking-[0.08em] text-muted-foreground uppercase opacity-80">
      {children}
    </h3>
  );
}

/**
 * The writer's picture, or their initials on the theme accent.
 *
 * The fallback is a real design rather than a missing-image state, which
 * is why there is no default portrait: a generic silhouette says "this
 * person did not finish setting up", and initials in the blog's own accent
 * say "this is whose blog this is".
 *
 * A plain `<img>` rather than `next/image`: the source is the Django media
 * host, which would otherwise have to be declared in `next.config.ts` as a
 * remote pattern, and every blog's avatar is one small square already
 * sized by the layout.
 */
function Avatar({ site }: { site: PublicSite }) {
  const shared =
    "size-16 shrink-0 overflow-hidden rounded-full sm:size-[88px] lg:size-[88px]";

  if (site.avatar) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={site.avatar}
        alt=""
        width={88}
        height={88}
        className={`${shared} object-cover`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${shared} flex items-center justify-center bg-brand/12 font-blog-heading text-[22px] font-medium text-brand sm:text-[30px]`}
    >
      {initials(site.display_name)}
    </span>
  );
}

/**
 * One or two letters from a display name.
 *
 * First and last word, so "Sagar Raturi" is SR and "Sagar" is S. Uses the
 * code-point-aware spread rather than `charAt`, because a name can begin
 * with an astral character and `"𝒮"[0]` is half of one.
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";

  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";

  return (first + last).toUpperCase();
}
