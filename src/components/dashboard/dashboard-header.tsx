import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Container } from "@/components/site/primitives";

/**
 * Dashboard chrome. Mirrors the marketing navbar's proportions so the two
 * halves of the product feel like one thing.
 */
export function DashboardHeader({
  siteName,
  siteDomain,
  actions,
}: {
  siteName?: string;
  siteDomain?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <Container className="max-w-5xl">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Logo />
              <span className="sr-only">Postly dashboard</span>
            </Link>

            {siteName ? (
              <>
                <span
                  aria-hidden
                  className="h-5 w-px shrink-0 bg-border max-sm:hidden"
                />
                <span className="min-w-0 max-sm:hidden">
                  <span className="block truncate text-[0.85rem] font-medium">
                    {siteName}
                  </span>
                  {siteDomain ? (
                    <span className="block truncate font-mono text-[0.68rem] text-muted-foreground">
                      {siteDomain}
                    </span>
                  ) : null}
                </span>
              </>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {actions}
          </div>
        </div>
      </Container>
    </header>
  );
}
