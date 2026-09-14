import * as React from "react";
import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

/** Small uppercase kicker that sits above a section heading. */
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 text-[0.7rem] font-semibold tracking-[0.16em] text-brand uppercase",
        className,
      )}
    >
      <span aria-hidden className="h-px w-6 bg-brand/40" />
      {children}
    </div>
  );
}

export function SectionHeading({
  label,
  title,
  description,
  align = "left",
  className,
}: {
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <h2 className="font-display text-balance text-3xl leading-[1.1] font-normal tracking-[-0.02em] sm:text-4xl md:text-[2.75rem]">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-muted-foreground",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** Hairline divider used between full-width page sections. */
export function SectionRule({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("mx-auto max-w-6xl px-5 sm:px-8", className)}
    >
      <div className="h-px w-full bg-border" />
    </div>
  );
}

/**
 * CSS-driven entrance for content that is visible on load. Unlike the
 * scroll reveals it needs no JavaScript, so the hero never renders blank
 * while the bundle is still arriving.
 */
export function Rise({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Milliseconds to hold before this element animates in. */
  delay?: number;
}) {
  return (
    <div
      className={cn("animate-rise", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
