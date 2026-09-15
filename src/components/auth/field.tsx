"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Label, input and error message, wired together for screen readers.
 *
 * There is no Label component in components/ui and no form library in the
 * project, so this is the one place that association is made — rather than
 * every form repeating an id, an aria-describedby and a red ring.
 */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  id: string;
  label: string;
  error?: string | null;
  hint?: React.ReactNode;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[0.82rem] font-medium">
        {label}
      </label>

      <Input
        id={id}
        // aria-invalid also drives the destructive ring in the Input styles.
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className="h-10"
        {...props}
      />

      {hint && !error ? (
        <p id={hintId} className="text-[0.75rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-[0.75rem] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Full-width submit button sizing shared by the auth forms. */
export const submitClasses = "mt-1 h-10 w-full rounded-full text-[0.9rem]";
