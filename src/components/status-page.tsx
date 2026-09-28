import Link from "next/link";
import { Logo } from "@/components/site/logo";

/**
 * The page behind a 404 or an error: logo, one sentence, one way out.
 *
 * Deliberately needs no provider. It renders from the root not-found and
 * error boundaries, which sit above both `(app)/layout.tsx` and the blog
 * layout — so there may be no AuthProvider, no ThemeProvider and no blog
 * palette in scope. It uses the app's default tokens from globals.css and
 * nothing else.
 */
export function StatusPage({
  code,
  title,
  description,
  action,
}: {
  code?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <Link
        href="/"
        className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Logo />
        <span className="sr-only">Postly home</span>
      </Link>

      {code ? (
        <p className="mt-12 font-mono text-[0.8rem] tracking-[0.12em] text-muted-foreground">
          {code}
        </p>
      ) : null}
      <h1
        className={`${code ? "mt-3" : "mt-12"} font-display text-4xl tracking-[-0.02em] text-balance`}
      >
        {title}
      </h1>
      <p className="mx-auto mt-4 max-w-[42ch] text-[1rem] leading-relaxed text-pretty text-muted-foreground">
        {description}
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        {action}
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-full px-5 text-[0.9rem] font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}
