"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLink, AuthShell, FormError } from "@/components/auth/auth-shell";
import { Field, submitClasses } from "@/components/auth/field";
import { useAuth } from "@/components/auth-provider";
import { getCurrentSite } from "@/lib/api";
import { parseApiErrors } from "@/lib/form-errors";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Only ever an internal path: middleware writes it, but a crafted
  // ?next=https://elsewhere would otherwise make this an open redirect.
  const requested = searchParams.get("next");
  const next = requested?.startsWith("/") && !requested.startsWith("//")
    ? requested
    : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      await login(email.trim(), password);

      // Somebody who has not finished onboarding has no blog to land on.
      const site = await getCurrentSite().catch(() => null);
      router.replace(next ?? (site ? "/dashboard" : "/onboarding"));
    } catch (err) {
      const parsed = parseApiErrors(err, "That email and password did not match.");
      setErrors(parsed.fields);
      setFormError(parsed.form ?? "That email and password did not match.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to keep writing."
      footer={
        <>
          New here? <AuthLink href="/signup">Create an account</AuthLink>
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

        <div className="flex flex-col gap-1.5">
          <Field
            id="password"
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            error={errors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <AuthLink
            href="/forgot-password"
            className="self-end text-[0.78rem] font-normal text-muted-foreground"
          >
            Forgot your password?
          </AuthLink>
        </div>

        <Button type="submit" className={submitClasses} disabled={submitting}>
          {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
