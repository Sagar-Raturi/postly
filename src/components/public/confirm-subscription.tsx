"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  SubscriptionShell,
  SubscriptionText,
} from "@/components/public/subscription-shell";
import {
  SubscribeError,
  confirmSubscription,
  type Subscription,
} from "@/lib/subscribe-api";

/**
 * Where the link in the confirmation email lands.
 *
 * ## Why this is a page that makes a request, rather than a link that is one
 *
 * Mail scanners and corporate security gateways fetch every URL in a
 * message before a person ever sees it. If the link in the email were the
 * confirm endpoint, one of those would complete the confirmation on the
 * reader's behalf — and a confirmation that a machine can complete is not
 * a confirmation of anything. So the endpoint is a POST, the link points
 * here, and the request happens from a browser that has run JavaScript,
 * which a scanner fetching HTML does not.
 *
 * It fires on mount rather than behind a button because the reader has
 * already expressed their intent twice — once in the form, once by
 * clicking the link — and a third "yes, really" is friction with nothing
 * on the other side of it. The button below is the fallback for a browser
 * with JavaScript disabled, which would otherwise see a permanent
 * spinner.
 *
 * ## Four endings
 *
 * `confirmed` is the ordinary one. `unsubscribed` happens when somebody
 * follows an old link after leaving — the server refuses to revive them,
 * and this says so plainly rather than pretending the click worked.
 * `failed` covers every bad token with one message, because the API
 * declines to say which kind of bad it was. And a missing token never
 * reaches the network at all.
 */
export function ConfirmSubscription({ token }: { token: string | null }) {
  const [state, setState] = React.useState<"working" | "done" | "failed">(
    token ? "working" : "failed",
  );
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [error, setError] = React.useState<string | null>(
    token ? null : "That link is missing its confirmation code.",
  );

  // React runs effects twice in development's StrictMode. Confirming is
  // idempotent server-side, so a second call would be harmless — but it
  // would still be a second request for no reason, and a double-fired
  // failure would flicker the message.
  const sent = React.useRef(false);

  const confirm = React.useCallback(async () => {
    if (!token) return;

    setState("working");
    setError(null);

    try {
      setSubscription(await confirmSubscription(token));
      setState("done");
    } catch (err) {
      setError(
        err instanceof SubscribeError
          ? err.message
          : "That link is not valid any more. Try subscribing again.",
      );
      setState("failed");
    }
  }, [token]);

  React.useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void confirm();
  }, [confirm]);

  if (state === "working") {
    return (
      <SubscriptionShell title="Confirming…">
        <p role="status" className="flex items-center gap-2 text-[16px] text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          One moment.
        </p>

        {/*
          Only ever seen without JavaScript, where the effect above never
          runs and this would otherwise spin forever.
        */}
        <noscript>
          <p className="mt-4 text-[16px] leading-[1.7] text-muted-foreground">
            This page needs JavaScript to finish confirming. Turn it on and
            reload, or reply to the email and the writer can add you.
          </p>
        </noscript>
      </SubscriptionShell>
    );
  }

  if (state === "failed") {
    return (
      <SubscriptionShell title="That link didn't work">
        <SubscriptionText>{error}</SubscriptionText>
        {token ? (
          <button
            type="button"
            onClick={() => void confirm()}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-[15px] font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            Try again
          </button>
        ) : null}
      </SubscriptionShell>
    );
  }

  // A stale confirmation link followed after unsubscribing. The server
  // deliberately does not revive the subscription — the unsubscribe is the
  // newer instruction — so this must not claim success.
  if (subscription?.status === "unsubscribed") {
    return (
      <SubscriptionShell
        title="You've unsubscribed from this blog"
        siteSlug={subscription.site_slug}
        siteName={subscription.site_name}
      >
        <SubscriptionText>
          This link is older than your decision to unsubscribe, so it hasn’t
          been used. If you’d like to start receiving{" "}
          {subscription.site_name} again, subscribe from the blog.
        </SubscriptionText>
      </SubscriptionShell>
    );
  }

  return (
    <SubscriptionShell
      title="You're subscribed"
      siteSlug={subscription?.site_slug}
      siteName={subscription?.site_name}
    >
      <SubscriptionText>
        {subscription
          ? `${subscription.email} will get an email when ${subscription.site_name} publishes something new. Every message has an unsubscribe link.`
          : "You'll get an email when something new is published."}
      </SubscriptionText>
    </SubscriptionShell>
  );
}
