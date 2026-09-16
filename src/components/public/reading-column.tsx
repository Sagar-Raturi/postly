import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The single centred column every published blog is set in.
 *
 * 680px is the measure the whole surface is built around — roughly 70
 * characters at the reading size, which is where a line stops being
 * comfortable to track back from. Header, index, post body and footer all
 * use this, so they align down the page.
 */
export function ReadingColumn({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[680px] px-5 sm:px-6", className)}>
      {children}
    </div>
  );
}
