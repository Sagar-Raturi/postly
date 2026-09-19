import type { Metadata } from "next";
import { SubscribersPanel } from "@/components/dashboard/subscribers-panel";

/**
 * `/dashboard/subscribers` — the writer's own mailing list.
 *
 * Inside the `(app)` route group, so it gets the auth provider and the
 * dashboard chrome. The panel is a client component: everything on it is
 * filtered and refetched as the writer types, and none of it is worth
 * server-rendering for a page only its owner can open.
 */

export const metadata: Metadata = {
  title: "Subscribers",
};

export default function SubscribersPage() {
  return <SubscribersPanel />;
}
