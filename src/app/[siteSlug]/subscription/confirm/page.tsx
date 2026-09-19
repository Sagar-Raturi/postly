import type { Metadata } from "next";
import { ConfirmSubscription } from "@/components/public/confirm-subscription";

/**
 * `/<blog>/subscription/confirm?token=…` — the link in a confirmation email.
 *
 * Rendered inside the blog's own layout, so it arrives in the writer's
 * palette and fonts with their masthead above it. A reader who has just
 * been sent here from an email needs to recognise whose blog it is before
 * anything else on the page matters.
 *
 * The `subscription` segment is static, which the App Router matches ahead
 * of the sibling `[postSlug]` route. That is why "subscription" is in
 * RESERVED_POST_SLUGS on the backend: a post that slugged to it would be
 * shadowed by this page and unreachable.
 *
 * All the work is in the client component. This file exists to read the
 * token out of the URL and to keep the page out of the index.
 */

export const metadata: Metadata = {
  title: "Confirm your subscription",
  // Never indexed. The URL contains a single-use credential, and a search
  // engine holding a copy of it is the one place it should not be.
  robots: { index: false, follow: false },
};

export default async function ConfirmSubscriptionPage({
  searchParams,
}: PageProps<"/[siteSlug]/subscription/confirm">) {
  const { token } = await searchParams;

  // A repeated `?token=a&token=b` arrives as an array. Neither value is
  // trustworthy at that point, so it is treated as no token at all rather
  // than as a reason to guess which one was meant.
  return <ConfirmSubscription token={typeof token === "string" ? token : null} />;
}
