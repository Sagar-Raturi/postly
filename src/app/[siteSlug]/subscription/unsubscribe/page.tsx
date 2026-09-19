import type { Metadata } from "next";
import { Unsubscribe } from "@/components/public/unsubscribe";

/**
 * `/<blog>/subscription/unsubscribe?token=…` — the unsubscribe link in
 * every email.
 *
 * Opening it changes nothing: the page reads the subscription and asks.
 * See the client component for why that matters — mail scanners open
 * every link in a message, and an unsubscribe that happens on page load
 * is an unsubscribe a machine can perform on somebody's behalf.
 */

export const metadata: Metadata = {
  title: "Unsubscribe",
  // The URL carries a token that ends a subscription. It does not belong
  // in a search index.
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: PageProps<"/[siteSlug]/subscription/unsubscribe">) {
  const { token } = await searchParams;

  return <Unsubscribe token={typeof token === "string" ? token : null} />;
}
