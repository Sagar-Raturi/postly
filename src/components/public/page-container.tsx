import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The measure every published blog is laid out in.
 *
 * 1180px is wide enough to carry a 300px profile column, a 64px gutter and
 * a post feed that still lands near a comfortable measure — and narrow
 * enough that the whole thing stays a page rather than spreading to fill a
 * 27" monitor. The top bar, the grid and the article all use this, so the
 * writer's name, their avatar and the first word of every post line up
 * down the left edge.
 *
 * Padding steps 32 / 24 / 20 with the breakpoints, all on the spacing
 * scale — see the note at the top of the blog layout.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1180px] px-5 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
