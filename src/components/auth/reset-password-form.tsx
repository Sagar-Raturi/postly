"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLink, AuthShell, FormError } from "@/components/auth/auth-shell";
import { Field, submitClasses } from "@/components/auth/field";
import { confirmPasswordReset } from "@/lib/api";
import { parseApiErrors } from "@/lib/form-errors";

const MIN_PASSWORD_LENGTH = 10;

/**
 * The emailed link is /reset-password/<token>?uid=<uid> — the backend needs
 * both halves, and only the token is nice enough to sit in the path.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const uid = useSearchParams().get("uid");

  const [password1, setPassword1] = React.useState("");
  const [password2, setPassword2] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (password1.length < MIN_PASSWORD_LENGTH) {
      setErrors({ new_password1: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    if (password1 !== password2) {
      setErrors({ new_password2: "The two passwords do not match." });
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      await confirmPasswordReset({
        uid: uid ?? "",
        token,
        new_password1: password1,
        new_password2: password2,
      });
      setDone(true);
      // Long enough to read the confirmation, short enough not to strand.
      setTimeout(() => router.replace("/login"), 1600);
    } catch (err) {
      const parsed = parseApiErrors(err, "Could not set that password.");
      setErrors(parsed.fields);
      setFormError(
        parsed.fields.uid || parsed.fields.token
          ? "This link has expired or has already been used. Ask for a new one."
          : parsed.form,
      );
      setSubmitting(false);
    }
  }

  if (!uid) {
    return (
      <AuthShell
        title="This link is incomplete"
        footer={<AuthLink href="/forgot-password">Ask for a new link</AuthLink>}
      >
        <FormError>
          Part of the link is missing. Copy the whole address from the email,
          or request a fresh one.
        </FormError>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password changed" description="Taking you to sign in…">
        <div className="flex flex-col items-center gap-5 py-2">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <CheckCircle2 aria-hidden className="size-5" />
          </span>
          <Button
            variant="outline"
            className="h-10 w-full rounded-full text-[0.9rem]"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Sign in now
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Make it one you have not used elsewhere."
      footer={<AuthLink href="/login">Back to sign in</AuthLink>}
    >
      {formError ? <FormError>{formError}</FormError> : null}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field
          id="new_password1"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password1}
          error={errors.new_password1}
          onChange={(event) => setPassword1(event.target.value)}
        />

        <Field
          id="new_password2"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={password2}
          error={errors.new_password2}
          onChange={(event) => setPassword2(event.target.value)}
        />

        <Button type="submit" className={submitClasses} disabled={submitting}>
          {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Set new password
        </Button>
      </form>
    </AuthShell>
  );
}
