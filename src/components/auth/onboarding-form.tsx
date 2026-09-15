"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell, FormError } from "@/components/auth/auth-shell";
import { Field, submitClasses } from "@/components/auth/field";
import { checkSlug, createFirstSite, getCurrentSite } from "@/lib/api";
import { parseApiErrors } from "@/lib/form-errors";
import { cn } from "@/lib/utils";

const CHECK_DELAY_MS = 400;

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "free" }
  | { state: "taken"; reason: string };

/**
 * The last answer from the API, tagged with the slug it was about.
 *
 * Keeping the slug alongside the verdict is what lets "checking" be derived
 * rather than stored: if the answer we hold is not about what is currently
 * typed, the check is by definition still outstanding.
 */
type SlugVerdict = {
  slug: string;
  status: "free" | "taken" | "unknown";
  reason?: string;
};

/** Best-effort suggestion, then the API has the final word on the details. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 63)
    .replace(/^-|-$/g, "");
}

export function OnboardingForm() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  // Once the writer edits the address themselves, it stops following the
  // title — otherwise their choice would be overwritten as they keep typing.
  const [slugEdited, setSlugEdited] = React.useState(false);

  const [verdict, setVerdict] = React.useState<SlugVerdict | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [checkingExisting, setCheckingExisting] = React.useState(true);

  // Someone who already finished onboarding has no business here.
  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const site = await getCurrentSite().catch(() => null);
      if (cancelled) return;

      if (site) {
        router.replace("/dashboard");
      } else {
        setCheckingExisting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Debounced availability check. Each keystroke replaces the pending
  // timer, so a fast typist causes one request rather than twenty.
  React.useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await checkSlug(slug);
          if (cancelled) return;

          setVerdict({
            slug,
            status: result.available ? "free" : "taken",
            reason: result.reason ?? "That address is taken.",
          });
        } catch {
          // A failed check should not block the form; submitting will get
          // a definitive answer from the server anyway.
          if (!cancelled) setVerdict({ slug, status: "unknown" });
        }
      })();
    }, CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug]);

  // Derived rather than stored: anything the held verdict does not cover is
  // still in flight.
  const availability: Availability = !slug
    ? { state: "idle" }
    : verdict?.slug !== slug
      ? { state: "checking" }
      : verdict.status === "free"
        ? { state: "free" }
        : verdict.status === "taken"
          ? { state: "taken", reason: verdict.reason ?? "That address is taken." }
          : { state: "idle" };

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (!name.trim()) {
      setErrors({ name: "Your blog needs a name." });
      return;
    }

    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      await createFirstSite({ name: name.trim(), slug });
      router.replace("/dashboard");
    } catch (err) {
      const parsed = parseApiErrors(err, "Could not create your blog.");
      setErrors(parsed.fields);
      setFormError(parsed.form);
      setSubmitting(false);
    }
  }

  if (checkingExisting) {
    return (
      <AuthShell title="One moment">
        <div className="flex items-center justify-center gap-3 py-6 text-[0.9rem] text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Loading…
        </div>
      </AuthShell>
    );
  }

  const blocked = availability.state === "taken" || !slug;

  return (
    <AuthShell
      title="Name your blog"
      description="Both of these can change later. The address is easiest to settle now."
    >
      {formError ? <FormError>{formError}</FormError> : null}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field
          id="name"
          label="Blog name"
          name="name"
          required
          autoFocus
          maxLength={120}
          placeholder="Small Hours"
          value={name}
          error={errors.name}
          onChange={(event) => handleNameChange(event.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <Field
            id="slug"
            label="Address"
            name="slug"
            required
            maxLength={63}
            placeholder="small-hours"
            spellCheck={false}
            autoCapitalize="none"
            className="[&_input]:font-mono"
            value={slug}
            error={errors.slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value.toLowerCase());
            }}
          />

          <SlugStatus slug={slug} availability={availability} />
        </div>

        <Button
          type="submit"
          className={submitClasses}
          disabled={submitting || blocked}
        >
          {submitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Create my blog
        </Button>
      </form>
    </AuthShell>
  );
}

function SlugStatus({
  slug,
  availability,
}: {
  slug: string;
  availability: Availability;
}) {
  if (!slug) {
    return (
      <p className="text-[0.75rem] text-muted-foreground">
        Lowercase letters, numbers and hyphens.
      </p>
    );
  }

  return (
    <div
      // Announced politely: the check fires while they are still typing.
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-[0.75rem]"
    >
      {availability.state === "checking" ? (
        <Loader2 aria-hidden className="size-3 shrink-0 animate-spin text-muted-foreground" />
      ) : availability.state === "free" ? (
        <Check aria-hidden className="size-3 shrink-0 text-brand" />
      ) : availability.state === "taken" ? (
        <X aria-hidden className="size-3 shrink-0 text-destructive" />
      ) : null}

      <span
        className={cn(
          "font-mono",
          availability.state === "free" && "text-brand",
          availability.state === "taken" && "text-destructive",
          (availability.state === "checking" || availability.state === "idle") &&
            "text-muted-foreground",
        )}
      >
        {availability.state === "taken" ? availability.reason : `${slug}.postly.com`}
      </span>
    </div>
  );
}
