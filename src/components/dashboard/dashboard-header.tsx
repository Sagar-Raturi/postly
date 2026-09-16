import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Container } from "@/components/site/primitives";
import { AccountMenu } from "@/components/dashboard/account-menu";

/**
 * The dashboard's top bar.
 *
 * The logo is the same mark and wordmark the marketing site uses, and it
 * links back to `/` — the dashboard is a room inside Postly, not a separate
 * product, and the writer should be able to get to the front of the
 * building.
 *
 * The writer's own site address deliberately does not appear here. It lives
 * in one place, the chip directly below this bar. See site-link-chip.tsx.
 *
 * `actions` is for controls that belong to one screen rather than to the
 * dashboard — the editor puts its save indicator and Publish button there.
 */
export function DashboardHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <Container className="max-w-5xl">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Logo />
            <span className="sr-only">Postly home</span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            {actions}
            <AccountMenu />
          </div>
        </div>
      </Container>
    </header>
  );
}
