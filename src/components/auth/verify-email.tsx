"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLink, AuthShell, FormError } from "@/components/auth/auth-shell";
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
 * Without one this is the "check your inbox" page shown straight after
 * signup. With one — the link in the email — it confirms the address and
 * hands the writer on to /login.
 */
export function VerifyEmail() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const email = searchParams.get("email");

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
          <p className="text-[0.85rem] text-muted-foreground">
            Sign in and we will offer you a fresh link.
          </p>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Check your inbox"
      description={
        email ? (
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
        ) : null}
      </div>
    </AuthShell>
  );
}
