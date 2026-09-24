import { refreshMyBlog } from "@/lib/blog-refresh";

let running: Promise<void> | null = null;
let queued = false;

/**
 * Ask for the writer's public blog to be refetched. Fire-and-forget.
 *
 * Server Actions are dispatched one at a time per tab, so calling
 * refreshMyBlog() after every autosave on a published post would line the
 * calls up behind each other — and on a free-tier API that has gone to
 * sleep, the first can take the best part of a minute.
 *
 * Every call made while one is in flight collapses into a single follow-up,
 * so there is at most one running and one waiting. The follow-up matters:
 * an edit that lands after the running refresh read the data has to be
 * picked up by another one, or it would wait out the 60-second fallback.
 */
export function requestBlogRefresh(): void {
  if (running) {
    queued = true;
    return;
  }

  running = (async () => {
    try {
      do {
        queued = false;
        await refreshMyBlog().catch(() => {});
      } while (queued);
    } finally {
      running = null;
    }
  })();
}
