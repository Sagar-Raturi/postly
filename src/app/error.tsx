"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/status-page";

/**
 * The error boundary for the whole app, below the root layout.
 *
 * At the root rather than in `(app)/` so it also catches a failure in
 * `(app)/layout.tsx` or in a blog's layout — `error.tsx` does not wrap the
 * layout of its own segment, so one placed any lower would miss exactly the
 * errors (the API being down while a blog's layout fetches the site) that
 * are most likely in practice.
 *
 * `retry()` re-fetches and re-renders the segment, which is the right
 * answer to the usual cause: a free-tier API waking from sleep.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Until an error-reporting service is wired up, the browser console
    // and the server logs (matched on `digest`) are where this lands.
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      title="Something went wrong"
      description="This page could not be loaded. It is usually temporary — try again in a moment."
      action={
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-[0.9rem] font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          Try again
        </button>
      }
    />
  );
}
