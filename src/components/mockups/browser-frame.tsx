import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type BrowserFrameProps = {
  url: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  size?: "sm" | "default";
  /** Renders a muted secure-connection lock beside the address. */
  secure?: boolean;
};

/**
 * A styled stand-in for a browser window. Everything inside is plain markup,
 * so the "screenshots" stay crisp at any size and follow the active theme.
 */
export function BrowserFrame({
  url,
  children,
  className,
  bodyClassName,
  size = "default",
  secure = true,
}: BrowserFrameProps) {
  const sm = size === "sm";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        sm ? "rounded-lg" : "shadow-window",
        className,
      )}
    >
      {/* chrome */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-border/80 bg-muted/60 px-3",
          sm ? "h-7 gap-2 px-2.5" : "h-10",
        )}
      >
        <div className={cn("flex items-center", sm ? "gap-1" : "gap-1.5")}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "rounded-full bg-foreground/15",
                sm ? "size-1.5" : "size-2.5",
              )}
            />
          ))}
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-background/80 ring-1 ring-foreground/[0.06]",
            sm ? "h-4 px-1.5" : "h-6 px-2.5",
          )}
        >
          {secure ? (
            <Lock
              aria-hidden
              className={cn(
                "shrink-0 text-muted-foreground/70",
                sm ? "size-2" : "size-3",
              )}
            />
          ) : null}
          <span
            className={cn(
              "truncate font-mono text-muted-foreground",
              sm ? "text-[0.5rem]" : "text-[0.6875rem]",
            )}
          >
            {url}
          </span>
        </div>
        {!sm ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            {[0, 1].map((i) => (
              <span key={i} className="h-2.5 w-2.5 rounded-sm bg-foreground/10" />
            ))}
          </div>
        ) : null}
      </div>

      <div className={cn("bg-card", bodyClassName)}>{children}</div>
    </div>
  );
}
