"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLink, AuthShell, FormError } from "@/components/auth/auth-shell";
import { Field, submitClasses } from "@/components/auth/field";
import { useAuth } from "@/components/auth-provider";
import { parseApiErrors } from "@/lib/form-errors";

const MIN_PASSWORD_LENGTH = 10;

/**
 * Client-side checks worth doing before a round trip. The server validates
 * all of this again — this only saves the writer a wasted submit.
 */
function validate(values: {
  email: string;
  displayName: string;
  password1: string;
  password2: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.email.trim()) {
    errors.email = "We need an email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "That does not look like an email address.";
  }

  if (!values.displayName.trim()) {
    errors.display_name = "Tell us what to call you.";
  }

  if (values.password1.length < MIN_PASSWORD_LENGTH) {
    errors.password1 = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (values.password2 !== values.password1) {
    errors.password2 = "The two passwords do not match.";
  }

  return errors;
}

export function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();

  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [password1, setPassword1] = React.useState("");
  const [password2, setPassword2] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const values = { email, displayName, password1, password2 };
    const localErrors = validate(values);
    if (Object.keys(localErrors).length) {
      setErrors(localErrors);
      setFormError(null);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      await signup({
        email: email.trim(),
        display_name: displayName.trim(),
        password1,
        password2,
      });

      // Nobody is signed in yet — the address has to be confirmed first.
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      const parsed = parseApiErrors(err, "Could not create your account.");
      setErrors(parsed.fields);
      setFormError(parsed.form);
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Start writing"
      description="A blog at your own address, in about a minute."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Log in</AuthLink>
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

        <Field
          id="display_name"
          label="Display name"
          name="display_name"
          autoComplete="name"
          required
          maxLength={80}
          hint="Shown as the author on your posts."
          value={displayName}
          error={errors.display_name}
          onChange={(event) => setDisplayName(event.target.value)}
        />

        <Field
          id="password1"
          label="Password"
          type="password"
          name="new-password"
          autoComplete="new-password"
          required
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={password1}
          error={errors.password1}
          onChange={(event) => setPassword1(event.target.value)}
        />

        <Field
          id="password2"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={password2}
          error={errors.password2}
          onChange={(event) => setPassword2(event.target.value)}
        />

        <Button type="submit" className={submitClasses} disabled={submitting}>
          {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
