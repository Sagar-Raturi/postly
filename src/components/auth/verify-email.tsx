"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLink, AuthShell, FormError } from "@/components/auth/auth-shell";
import { Field } from "@/components/auth/field";
import { resendVerification, verifyEmail } from "@/lib/api";
import { parseApiErrors } from "@/lib/form-errors";

type State =
  | { status: "waiting" }
  | { status: "checking" }
  | { status: "confirmed" }
  | { status: "failed"; message: string };

/**
 * Two screens in one, chosen by whether the URL carries a key.
 *
 * Without one this is the "check your inbox" page, shown straight after
 * signup and after a sign-in attempt on an address that was never confirmed
 * (`reason=unconfirmed`; the login API has already sent a new link). With
 * one — the link in the email — it confirms the address and hands the
 * writer on to /login.
 *
 * Every version of the page offers a new link. Without an `email` in the
 * URL, as when an emailed link has expired, it asks for the address: an
 * account whose address is unconfirmed cannot sign in, so this page is the
 * only way back into it that does not go through the login form.
 */
export function VerifyEmail() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const email = searchParams.get("email");
  const unconfirmed = searchParams.get("reason") === "unconfirmed";

  const [state, setState] = React.useState<State>(
    key ? { status: "checking" } : { status: "waiting" },
  );
  const [resent, setResent] = React.useState(false);
  const [resending, setResending] = React.useState(false);

  React.useEffect(() => {
    if (!key) return;
    let cancelled = false;

    void (async () => {
      try {
        await verifyEmail(key);
        if (!cancelled) setState({ status: "confirmed" });
      } catch (err) {
        const parsed = parseApiErrors(err, "We could not confirm that link.");
        if (!cancelled) {
          setState({
            status: "failed",
            message: parsed.form ?? "We could not confirm that link.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      await resendVerification(email);
      setResent(true);
    } catch {
      // The endpoint answers the same way whether or not the address is
      // known, so there is nothing useful to report on failure either.
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  if (state.status === "checking") {
    return (
      <AuthShell title="Confirming your address">
        <div className="flex items-center justify-center gap-3 py-6 text-[0.9rem] text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          One moment…
        </div>
      </AuthShell>
    );
  }

  if (state.status === "confirmed") {
    return (
      <AuthShell
        title="You're all set"
        description="Your address is confirmed. Sign in and pick your address."
      >
        <div className="flex flex-col items-center gap-5 py-2">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <CheckCircle2 aria-hidden className="size-5" />
          </span>
          <Button
            className="h-10 w-full rounded-full text-[0.9rem]"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (state.status === "failed") {
    return (
      <AuthShell
        title="That link did not work"
        footer={
          <>
            Already confirmed? <AuthLink href="/login">Log in</AuthLink>
          </>
        }
      >
        <FormError>{state.message}</FormError>
        {email ? (
          <Button
            variant="outline"
            className="h-10 w-full rounded-full text-[0.9rem]"
            onClick={handleResend}
            disabled={resending || resent}
          >
            {resending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {resent ? "New link sent" : "Send a new link"}
          </Button>
        ) : (
          <RequestNewLink />
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={unconfirmed ? "Confirm your email first" : "Check your inbox"}
      description={
        email && unconfirmed ? (
          <>
            Your address isn&apos;t confirmed yet, so we sent a new link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Follow
            it, then sign in.
          </>
        ) : email ? (
          <>
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Follow
            it and your blog is yours.
          </>
        ) : (
          "We sent you a confirmation link. Follow it and your blog is yours."
        )
      }
      footer={
        <>
          Already confirmed? <AuthLink href="/login">Log in</AuthLink>
        </>
      }
    >
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Mail aria-hidden className="size-5" />
        </span>
        <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
          Nothing yet? It can take a minute, and it is worth a look in your spam
          folder.
        </p>
        {email ? (
          <Button
            variant="outline"
            className="h-9 rounded-full text-[0.85rem]"
            onClick={handleResend}
            disabled={resending || resent}
          >
            {resending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {resent ? "New link sent" : "Send it again"}
          </Button>
        ) : (
          <RequestNewLink />
        )}
      </div>
    </AuthShell>
  );
}

/**
 * Asks for the address when the URL does not carry one, and sends a new
 * confirmation link to it.
 *
 * The API answers the same whether or not the address has an unconfirmed
 * account, so the confirmation says "if" rather than claiming a send that
 * may not have happened.
 */
function RequestNewLink() {
  const [address, setAddress] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!address.trim() || sending) return;

    setSending(true);
    try {
      await resendVerification(address.trim());
    } catch {
      // Same reasoning as handleResend above: nothing useful to report.
    } finally {
      setSending(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <p role="status" className="text-[0.85rem] leading-relaxed text-muted-foreground">
        If that address has an account waiting to be confirmed, a new link is on
        its way. It is worth a look in your spam folder too.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full flex-col gap-3 text-left"
    >
      <Field
        id="resend-email"
        label="Send a new link to"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />
      <Button
        type="submit"
        variant="outline"
        className="h-10 w-full rounded-full text-[0.9rem]"
        disabled={sending || !address.trim()}
      >
        {sending ? <Loader2 aria-hidden className="animate-spin" /> : null}
        Send a new link
      </Button>
    </form>
  );
}
