import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-[0.55rem] bg-brand text-brand-foreground shadow-sm",
        className,
      )}
    >
      <span className="font-display text-[1.15em] leading-none font-semibold">
        P
      </span>
    </span>
  );
}

export function Logo({
  className,
  wordmarkClassName,
}: {
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-display text-[1.35rem] leading-none tracking-[-0.02em]",
          wordmarkClassName,
        )}
      >
        Postly
      </span>
    </span>
  );
}
