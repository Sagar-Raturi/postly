import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";

export const metadata: Metadata = {
  title: "Page not found — Codomain",
};

/**
 * The 404 for everything that is not a blog.
 *
 * A single unknown segment (`/whatever`) is a blog slug as far as routing
 * is concerned, and gets `[siteSlug]/not-found.tsx` instead. This one
 * answers deeper unmatched paths and any `notFound()` thrown from the
 * `(app)` pages, which have no not-found of their own.
 */
export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="This page does not exist"
      description="The link may be broken, or the page may have moved. Nothing you did caused this."
    />
  );
}
