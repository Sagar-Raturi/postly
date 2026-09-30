"use client";

import "./globals.css";

/**
 * The last resort: the root layout itself failed, so this replaces it and
 * has to bring its own `<html>` and `<body>`.
 *
 * Kept to plain markup and system fonts. Whatever broke the root layout may
 * well be something it imports, so this imports as little as possible —
 * only the stylesheet, for the palette.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 text-center font-sans text-foreground">
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 max-w-[40ch] text-muted-foreground">
          Codomain could not load. Try again in a moment.
          {error.digest ? (
            <span className="mt-2 block font-mono text-xs">
              Reference: {error.digest}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 h-10 rounded-full bg-foreground px-5 text-sm font-medium text-background"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
