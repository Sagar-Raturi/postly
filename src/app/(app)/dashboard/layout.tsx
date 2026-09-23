import * as React from "react";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

/**
 * The dashboard's frame: navigation on the left, the current screen on the
 * right.
 *
 * Every screen under here — posts, the editor, subscribers, settings —
 * renders only its own content. The nav is mounted once, by this layout,
 * rather than by each of them, so moving between screens does not tear it
 * down and rebuild it, and the editor keeps a way out of itself.
 *
 * `min-w-0` on the content column is load-bearing: a flex child defaults to
 * `min-width: min-content`, and a long unbroken word in a post title would
 * otherwise push the column wider than the viewport and put a horizontal
 * scrollbar under the whole dashboard.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      {/*
        The nav reads the query string to tell Posts from Drafts, and a
        client component that does is a prerender boundary: without this,
        every dashboard page would opt out of static rendering at build
        time. The fallback is null — the nav's own skeleton covers the
        moment before the site loads.
      */}
      <React.Suspense fallback={null}>
        <DashboardNav />
      </React.Suspense>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
