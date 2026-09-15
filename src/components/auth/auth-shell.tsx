import * as React from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

/**
 * The frame every auth page sits in: logo, heading, card, footer line.
 *
 * Deliberately narrower and quieter than the marketing pages — this is a
 * form, and the only job on screen is filling it in.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[26rem]">
        <div className="flex justify-center">
          <Link
            href="/"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Logo />
            <span className="sr-only">Postly home</span>
          </Link>
        </div>

        <div className="mt-8 text-center">
          <h1 className="font-display text-[1.75rem] leading-tight tracking-[-0.02em]">
            {title}
          </h1>
          {description ? (
            <p className="mx-auto mt-2 max-w-[22rem] text-pretty text-[0.9rem] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        <div className="mt-7 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          {children}
        </div>

        {footer ? (
          <p className="mt-6 text-center text-[0.85rem] text-muted-foreground">
            {footer}
          </p>
        ) : null}
      </div>
    </main>
  );
}

/** Inline link styled for the footer line and in-form asides. */
export function AuthLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Whole-form error. Mirrors the dashboard's error block so a failure looks
 * the same wherever it happens.
 */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-lg bg-destructive/5 p-3.5 ring-1 ring-destructive/20"
    >
      <TriangleAlert
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <p className="text-[0.85rem] leading-relaxed text-destructive">{children}</p>
    </div>
  );
}
