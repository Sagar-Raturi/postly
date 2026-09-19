"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  SubscriptionShell,
  SubscriptionText,
} from "@/components/public/subscription-shell";
import {
  SubscribeError,
  previewUnsubscribe,
  unsubscribe,
  type Subscription,
} from "@/lib/subscribe-api";

/**
 * Where the unsubscribe link in an email lands.
 *
 * ## Why there is a button at all
 *
 * The opposite reasoning to the confirmation page, and for the same
 * underlying fact. Mail scanners fetch every link in a message, so if
 * opening this URL unsubscribed you, a corporate mail gateway would
 * quietly remove its own users from every list they had joined. So the
 * load is a read — `GET`, which changes nothing and is safe to prefetch —
 * and the unsubscribe itself is a `POST` behind one deliberate click.
 *
 * The cost of that click is one extra interaction for somebody who wants
 * to leave, which is why everything else here works in their favour: the
 * page states plainly which address and which blog, the button is the
 * only thing on it, and a second click after it has worked says "you're
 * unsubscribed" again rather than erroring.
 *
 * Phase 4's `List-Unsubscribe-Post` header points a mail client straight
 * at the POST endpoint, so readers whose client offers a built-in
 * unsubscribe never see this page. It exists for everyone else.
 */
export function Unsubscribe({ token }: { token: string | null }) {
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [loading, setLoading] = React.useState(Boolean(token));
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    token ? null : "That link is missing its unsubscribe code.",
  );

  // As on the confirmation page: StrictMode fires effects twice, and this
  // one is a request whose result decides what is rendered.
  const asked = React.useRef(false);

  React.useEffect(() => {
    if (!token || asked.current) return;
    asked.current = true;

    void (async () => {
      try {
        setSubscription(await previewUnsubscribe(token));
      } catch (err) {
        setError(
          err instanceof SubscribeError && err.status !== 404
            ? err.message
            : "That unsubscribe link is not valid any more.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleUnsubscribe() {
    if (!token || working) return;

    setWorking(true);
    setError(null);

    try {
      setSubscription(await unsubscribe(token));
    } catch (err) {
      setError(
        err instanceof SubscribeError
          ? err.message
          : "Could not unsubscribe you. Try again in a moment.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <SubscriptionShell title="Unsubscribe">
        <p role="status" className="flex items-center gap-2 text-[16px] text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          One moment.
        </p>
      </SubscriptionShell>
    );
  }

  if (!subscription) {
    return (
      <SubscriptionShell title="That link didn't work">
        <SubscriptionText>
          {error}{" "}
          {/*
            Said without knowing whether it is true, because the API will
            not say whether a token names a real subscription. It is the
            most useful thing that can be offered: an unsubscribe link
            that has already been spent looks exactly like one that was
            never real.
          */}
          If you have already unsubscribed, nothing more is needed — you
          will not be emailed again.
        </SubscriptionText>
      </SubscriptionShell>
    );
  }

  if (subscription.status === "unsubscribed") {
    return (
      <SubscriptionShell
        title="You're unsubscribed"
        siteSlug={subscription.site_slug}
        siteName={subscription.site_name}
      >
        <SubscriptionText>
          {subscription.email} will not get any more email from{" "}
          {subscription.site_name}.
        </SubscriptionText>
      </SubscriptionShell>
    );
  }

  return (
    <SubscriptionShell
      title="Unsubscribe?"
      siteSlug={subscription.site_slug}
      siteName={subscription.site_name}
    >
      <SubscriptionText>
        <span className="text-foreground">{subscription.email}</span> will stop
        receiving email from{" "}
        <span className="text-foreground">{subscription.site_name}</span>.
      </SubscriptionText>

      <button
        type="button"
        onClick={() => void handleUnsubscribe()}
        disabled={working}
        className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-[15px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-60"
      >
        {working ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Unsubscribe
      </button>

      {/* Foreground rather than `--destructive`, which a blog's palette does
          not define — see the note in subscribe-form.tsx. */}
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-foreground">
          {error}
        </p>
      ) : null}
    </SubscriptionShell>
  );
}
