"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * An on/off switch.
 *
 * A `<button role="switch">` rather than a styled checkbox: the control is
 * "this setting is on", not "this value is included in a form I am about
 * to submit", and `aria-checked` on a switch is what a screen reader
 * announces as on/off rather than checked/unchecked. There is no form
 * around it — every switch in the dashboard saves the moment it moves.
 *
 * The label is wired by the caller through `id` and `aria-describedby`,
 * because the helper text under one of these is usually the part that
 * matters and it should be read out with the control.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  ...props
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
} & Omit<
  React.ComponentPropsWithoutRef<"button">,
  "onChange" | "type" | "value"
>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand" : "bg-input dark:bg-input/60",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none size-5 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
