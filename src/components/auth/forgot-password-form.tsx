"use client";

import * as React from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLink, AuthShell, FormError } from "@/components/auth/auth-shell";
import { Field, submitClasses } from "@/components/auth/field";
import { requestPasswordReset } from "@/lib/api";
import { parseApiErrors } from "@/lib/form-errors";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      const parsed = parseApiErrors(err, "Could not send the reset link.");
      setErrors(parsed.fields);
      setFormError(parsed.form);
    } finally {
      setSubmitting(false);
    }
  }

  // Shown for any address at all. The API answers identically whether or
  // not an account exists, and saying "no such user" here would turn this
  // form into a way of finding out who has one.
  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        description={
          <>
            If <span className="font-medium text-foreground">{email.trim()}</span>{" "}
            has an account, a reset link is on its way. It expires in an hour.
          </>
        }
        footer={<AuthLink href="/login">Back to sign in</AuthLink>}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Mail aria-hidden className="size-5" />
          </span>
          <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
            Nothing after a minute or two? Check your spam folder, then try
            again.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Give us the address you signed up with and we will send a link."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
        </>
      }
    >
      {formError ? <FormError>{formError}</FormError> : null}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field
          id="email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Button type="submit" className={submitClasses} disabled={submitting}>
          {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
