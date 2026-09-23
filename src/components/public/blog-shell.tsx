import * as React from "react";
import { ProfilePanel } from "@/components/public/profile-panel";
import { PageContainer } from "@/components/public/page-container";
import { marketingLinkProps } from "@/lib/marketing-url";
import type { SubscribeSource } from "@/lib/subscribe-api";
import { archiveByYear, type PublicPostSummary, type PublicSite } from "@/lib/public-api";

/**
 * The two-column body of a blog: profile panel on the left, whatever the
 * page is about on the right.
 *
 * This lives in a component rather than in the route's layout for one
 * reason: a layout does not receive `searchParams` in the App Router, and
 * the archive has to know which year is currently filtering the feed in
 * order to mark it. The top bar, which needs no such thing, does stay in
 * the layout.
 *
 * Both pages therefore call this, and both ask `lib/public-api.ts` for the
 * same site and the same post list. That costs one request each, not two:
 * every query in that module is wrapped in React's `cache`, so the layout,
 * the page and generateMetadata share one fetch per render.
 *
 * The grid is 300px + 1fr with a 64px gutter from `lg` up, and one column
 * below it. `minmax(0,1fr)` rather than plain `1fr` because a grid track
 * defaults to `min-content` width — one long unbroken word in a post title
 * would otherwise push the whole column wider than the page.
 */
export function BlogShell({
  site,
  posts,
  activeYear,
  subscribeSource = "index",
  subscribeOnMobile = false,
  children,
}: {
  site: PublicSite;
  /** Every published post — the archive counts are grouped from these. */
  posts: PublicPostSummary[];
  activeYear?: number | null;
  /** Passed to the panel's subscribe box — see ProfilePanel. */
  subscribeSource?: SubscribeSource;
  subscribeOnMobile?: boolean;
  children: React.ReactNode;
}) {
  const archive = archiveByYear(posts);

  return (
    <PageContainer className="py-12 lg:py-12">
      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-16">
        <ProfilePanel
          site={site}
          archive={archive}
          activeYear={activeYear}
          subscribeSource={subscribeSource}
          subscribeOnMobile={subscribeOnMobile}
        />

        <main className="mt-12 min-w-0 lg:mt-0">{children}</main>
      </div>

      {/*
        The credit lives in the panel on a wide screen, where the panel is
        always in view. Single-column, the panel is at the top and scrolls
        away, so it reappears here at the foot of the page — one credit
        either way, never two at once.
      */}
      <div className="mt-16 border-t border-border/70 pt-6 lg:hidden">
        <a
          {...marketingLinkProps()}
          className="rounded-sm text-[13px] text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          Published with Postly
        </a>
      </div>
    </PageContainer>
  );
}
