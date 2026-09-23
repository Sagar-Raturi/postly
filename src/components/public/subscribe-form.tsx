"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  SubscribeError,
  subscribe,
  type SubscribeSource,
} from "@/lib/subscribe-api";

/**
 * "Get new posts by email" — one field, on somebody else's blog.
 *
 * The only interactive thing under `/[siteSlug]`, and the only client
 * component the published blog ships. Everything else there is server
 * HTML, so this is deliberately small: one input, one button, no form
 * library, no validation beyond what the browser and the API already do.
 *
 * ## Why it does not use the auth forms' Field
 *
 * `components/auth/field.tsx` is built for Postly's own chrome and reaches
 * for `components/ui/input`, whose styling is the app's, not the blog's. A
 * blog is rendered in a palette its writer chose, in fonts they chose, on
 * a page with none of Postly's furniture on it. Borrowing the dashboard's
 * input here would put the one visibly Postly-shaped control on an
 * otherwise wholly personal page. The markup below is instead built from
 * the same theme tokens as its neighbours — `--border`, `--brand`,
 * `--muted-foreground` — so it inherits whichever palette the writer
 * picked without knowing anything about which one that is.
 *
 * ## What it never says
 *
 * There is no "you are already subscribed" state, because the API refuses
 * to tell anyone that. Every successful submission renders the same
 * sentence, which is the server's, and which is identical for a new
 * address, one already waiting to confirm, and one already on the list.
 * Anything else would let a stranger type an address and learn whether
 * that person reads this blog.
 */
export function SubscribeForm({
  siteSlug,
  source,
  variant = "section",
  className = "",
}: {
  siteSlug: string;
  /** Which form this is, for the writer's own curiosity. */
  source: SubscribeSource;
  /**
   * "section" is the full-width block under a post. "panel" is the one in
   * the profile sidebar, where the column is 300px: the button cannot sit
   * beside the field, and the heading has to match the panel's own small
   * uppercase labels rather than shouting over them.
   */
  variant?: "section" | "panel";
  className?: string;
}) {
  const panel = variant === "panel";
  const id = React.useId();
  const [email, setEmail] = React.useState("");
  const [honeypot, setHoneypot] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      setDone(await subscribe(siteSlug, email.trim(), source, honeypot));
    } catch (err) {
      setError(
        err instanceof SubscribeError
          ? err.message
          : "Something went wrong. Try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className={`border-t border-border/70 pt-8 ${className}`}>
        {/*
          Polite, not assertive: the reader has just pressed a button and
          is looking at the place the answer appears, so interrupting them
          buys nothing. `role="status"` carries an implicit aria-live.
        */}
        <p role="status" className="text-[16px] leading-[1.65] text-foreground">
          {done}
        </p>
        <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
          Nothing after a minute or two? Check your spam folder.
        </p>
      </section>
    );
  }

  return (
    <section className={`border-t border-border/70 pt-8 ${className}`}>
      <h2
        className={`font-blog-heading leading-[1.3] text-foreground ${panel ? "text-[18px]" : "text-[19px]"}`}
      >
        Get new posts by email
      </h2>

      <p
        className={`mt-2 text-[15px] leading-[1.6] text-muted-foreground ${panel ? "" : "max-w-[52ch]"}`}
      >
        {panel
          ? "One email when something new is published."
          : "One message when something new is published. Unsubscribe in one click, any time."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4">
        <div
          className={
            panel
              ? "flex flex-col gap-2"
              : "flex max-w-[420px] flex-col gap-2 sm:flex-row"
          }
        >
          <label htmlFor={`${id}-email`} className="sr-only">
            Email address
          </label>

          <input
            id={`${id}-email`}
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            // `flex-1` only once the row is horizontal. Stacked, the flex
            // axis is vertical, where flex-basis:0% outranks the height
            // property — which collapsed this field to its line box and is
            // why it used to render a third of the button's height.
            //
            // 16px, not smaller: mobile Safari zooms the whole page in when
            // a focused field's text is under 16px, and a reader who taps
            // this lands on a blog that has jumped scale under them.
            className={`h-11 w-full min-w-0 ${panel ? "" : "sm:flex-1"} rounded-md border border-border bg-background px-3.5 text-[16px] text-foreground placeholder:text-muted-foreground/70 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none aria-invalid:border-foreground/60`}
          />

          {/*
            The honeypot. Hidden from sight and from assistive technology,
            and excluded from the tab order, so no person can reach it —
            which is what makes anything in it a reliable signal that the
            submission was automated. `aria-hidden` plus `tabIndex={-1}`
            rather than `display:none`, because some form-fillers skip
            fields they can tell are invisible.

            The server discards these submissions while answering exactly
            as it would have done, so nothing here has to change when one
            is caught.
          */}
          <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor={`${id}-website`}>Website</label>
            <input
              id={`${id}-website`}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`inline-flex h-11 ${panel ? "w-full" : "shrink-0"} items-center justify-center gap-2 rounded-md bg-brand px-5 text-[16px] font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-60`}
          >
            {submitting ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : null}
            Subscribe
          </button>
        </div>

        {/*
          Full-strength `--foreground`, not `--destructive`.

          A blog defines exactly six colours — background, foreground,
          muted, muted-foreground, border and brand (which is also the
          focus ring). `--destructive` is not among them, so using it here
          would silently fall back to the *app's* red, which is tuned for
          Postly's own light chrome: against a dark blog's background
          (oklch 0.185) it lands near 2.9:1, under the 4.5:1 that 13px
          text needs. Foreground against the same background is about
          15:1, and it already reads as emphasis because every other line
          in this block is muted. See lib/blog-theme.ts for the token set.
        */}
        {error ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="mt-2 text-[14px] text-foreground"
          >
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
