/**
 * Read-only client for the published blogs.
 *
 * This is deliberately not `lib/api.ts`. That one is the dashboard's client:
 * it sends the session cookie, attaches CSRF tokens, and redirects to /login
 * when the API says 401. None of that belongs on a page a stranger opens.
 * Here there is no session, no cookie, and nothing to leak — every call is a
 * plain anonymous GET against `/api/public/`.
 *
 * **Every function takes a site slug as its first argument, and nothing in
 * this file knows where that slug came from.** Today the routing layer reads
 * it out of the URL path (`/sagar/...`). In Phase 3 it will come from the
 * `Host` header (`sagar.postly.com`). That change replaces the argument's
 * source and touches nothing below this line.
 */

import { cache } from "react";

import type {
  Appearance,
  FontPairing,
  ThemeName,
} from "@/lib/blog-theme";

const BASE_URL = (
  // Server-rendered, so this is read in Node rather than the browser. It is
  // still the NEXT_PUBLIC_ variable because in every environment so far the
  // API is at the same address from both sides.
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/$/, "");

/**
 * How long a rendered blog page may be served before Next.js re-fetches it.
 *
 * Published posts change rarely and are read often, so this is the whole
 * performance story: a reader gets static HTML, and an edit shows up within
 * the minute.
 */
export const PUBLIC_REVALIDATE_SECONDS = 60;

/** Stops a single blog index from walking an unbounded number of pages. */
const MAX_INDEX_PAGES = 10;

/* ------------------------------------------------------------------ *
 * Types — these mirror blog/public_serializers.py, which is a short
 * allowlist of public fields. There is no author email, no user id, no
 * `status` and no internal timestamp here, by design on both sides.
 * ------------------------------------------------------------------ */

export interface PublicSite {
  name: string;
  slug: string;
  description: string;
  /** The writer's display name. */
  author: string;

  /**
   * How the writer chose to have their blog drawn.
   *
   * Names and one bounded number, never colours — `src/lib/blog-theme.ts`
   * owns the values these select. That is what keeps a theme from being a
   * way to put a string into a stylesheet.
   */
  theme: ThemeName;
  appearance: Appearance;
  font_pairing: FontPairing;
  accent_hue: number | null;
}

/** One entry on a blog index. */
export interface PublicPostSummary {
  title: string;
  slug: string;
  excerpt: string;
  read_time_minutes: number;
  published_at: string;
}

/** A post page: the summary fields, plus the body and a byline. */
export interface PublicPost extends PublicPostSummary {
  content: string;
  author: string | null;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** A public endpoint answered with something other than 200 or 404. */
export class PublicApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "PublicApiError";
    this.status = status;
  }
}

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

/**
 * GETs `path`, returning null for 404 and throwing for anything else.
 *
 * 404 is a normal answer here — an unknown blog, or a post slug that belongs
 * to a draft — so callers turn it into Next's notFound() rather than an
 * error page. A 500 is not normal and must not be quietly rendered as
 * "no such post".
 */
async function get<T>(path: string): Promise<T | null> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      // No `credentials`: these pages are anonymous by definition, and
      // sending a stray cookie is how a public page accidentally starts
      // varying by viewer.
      next: { revalidate: PUBLIC_REVALIDATE_SECONDS },
    });
  } catch (cause) {
    throw new PublicApiError(
      `Could not reach the Postly API at ${BASE_URL}.`,
      0,
      { cause },
    );
  }

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new PublicApiError(
      `${path} answered ${response.status} ${response.statusText}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

/**
 * The blog's name, description and author, or null if no blog has that slug.
 *
 * Wrapped in React's `cache` so the layout, the page and generateMetadata
 * can each ask for it independently and the request happens once per render.
 */
export const getPublicSite = cache(
  (siteSlug: string): Promise<PublicSite | null> =>
    get<PublicSite>(`/public/sites/${encodeURIComponent(siteSlug)}/`),
);

/**
 * Every published post on the blog, newest first.
 *
 * The API paginates at twenty; this follows `next` so the index is complete,
 * up to MAX_INDEX_PAGES. A blog long enough to hit that cap wants a paged
 * index rather than a longer cap, which is a change to this function and to
 * the index page — not to the API.
 */
export const listPublicPosts = cache(
  async (siteSlug: string): Promise<PublicPostSummary[] | null> => {
    const first = await get<Paginated<PublicPostSummary>>(
      `/public/sites/${encodeURIComponent(siteSlug)}/posts/`,
    );
    if (!first) return null;

    const posts = [...first.results];

    for (let page = 2; page <= MAX_INDEX_PAGES; page += 1) {
      if (posts.length >= first.count) break;

      const next = await get<Paginated<PublicPostSummary>>(
        `/public/sites/${encodeURIComponent(siteSlug)}/posts/?page=${page}`,
      );
      if (!next?.results.length) break;

      posts.push(...next.results);
    }

    return posts;
  },
);

/**
 * One published post, or null.
 *
 * Null covers three cases a reader cannot tell apart, which is the point:
 * no such blog, no such post, and a post that exists but is still a draft.
 */
export const getPublicPost = cache(
  (siteSlug: string, postSlug: string): Promise<PublicPost | null> =>
    get<PublicPost>(
      `/public/sites/${encodeURIComponent(siteSlug)}/posts/${encodeURIComponent(postSlug)}/`,
    ),
);

/* ------------------------------------------------------------------ *
 * Presentation helpers
 * ------------------------------------------------------------------ */

/** "12 January 2026" — the date a post was published. */
export function formatPublishedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatReadTime(minutes: number): string {
  return `${minutes} min read`;
}

/**
 * Plain text for a meta description, from the excerpt the backend already
 * derived. Trimmed to the length search engines actually show.
 */
export function metaDescription(text: string, limit = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}
