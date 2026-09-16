/**
 * Typed client for the Postly Django API.
 *
 * Authentication is a session cookie, set by the backend and marked
 * httpOnly — so there is no token here to read, store, or attach. Every
 * request sends `credentials: "include"` and, for unsafe methods, copies
 * the CSRF cookie into the `X-CSRFToken` header. All of that lives in
 * `request()` and nowhere else.
 */

import type {
  Appearance,
  FontPairing,
  ThemeName,
} from "@/lib/blog-theme";

const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/$/, "");

/** Methods Django exempts from CSRF checks. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

/* ------------------------------------------------------------------ *
 * Types — these mirror blog/serializers.py
 * ------------------------------------------------------------------ */

export type PostStatus = "draft" | "published";

export interface User {
  id: number;
  email: string;
  display_name: string;
  date_joined: string;
}

export interface Site {
  id: number;
  name: string;
  slug: string;
  description: string;
  domain: string;
  /** How the published blog is drawn — see `src/lib/blog-theme.ts`. */
  theme: ThemeName;
  appearance: Appearance;
  font_pairing: FontPairing;
  /** An OKLCH hue 0-360, or null for the theme's own accent. */
  accent_hue: number | null;
  posts_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * What `GET /api/posts/` returns.
 *
 * Carries the body: the dashboard card renders it inline when a post is
 * expanded, and the search box filters on it. See PostListSerializer for
 * the full reasoning.
 */
export interface PostListItem {
  id: number;
  site: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  /** Word count over 200wpm, rounded up. Computed by the API so the
   *  dashboard and the published post never disagree. */
  read_time_minutes: number;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What the detail endpoints return — the list fields plus the blog and
 *  author names, which are the same on every row of a single blog. */
export interface Post extends PostListItem {
  site_name: string;
  author_name: string | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PostFilters {
  site?: number;
  status?: PostStatus;
  search?: string;
  page?: number;
}

export type PostInput = {
  site: number;
  title: string;
  content?: string;
  excerpt?: string;
  status?: PostStatus;
};

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

/** A non-2xx response. `data` holds DRF's field-level validation errors. */
export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(
    message: string,
    status: number,
    data: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }

  /** Flattens DRF's `{field: [msg]}` shape into something displayable. */
  get detail(): string {
    if (typeof this.data === "string") return this.data;
    if (this.data && typeof this.data === "object") {
      const parts = Object.entries(this.data as Record<string, unknown>).map(
        ([field, messages]) =>
          `${field}: ${Array.isArray(messages) ? messages.join(", ") : String(messages)}`,
      );
      if (parts.length) return parts.join("; ");
    }
    return this.message;
  }
}

/* ------------------------------------------------------------------ *
 * Session handling
 * ------------------------------------------------------------------ */

/**
 * Called whenever the API answers 401.
 *
 * AuthProvider registers itself here so there is exactly one place that
 * decides what an expired session means — clear the user, go to /login —
 * instead of every caller having to remember.
 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

/**
 * Requests that are allowed to 401 without meaning "your session died".
 *
 * The mount-time check of who is logged in 401s for every signed-out
 * visitor, which is a normal answer, not an expiry — bouncing on it would
 * redirect people away from the homepage.
 */
const TOLERATES_401 = new Set(["/auth/user/"]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  // Django checks this header against the CSRF cookie. The cookie is
  // readable by design; the session cookie, which is the actual credential,
  // is httpOnly and never passes through JavaScript.
  if (!SAFE_METHODS.has(method)) {
    const csrfToken = readCookie("csrftoken");
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;
  }

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      // Without this the browser sends no cookies to the API's origin, and
      // every request looks anonymous.
      credentials: "include",
      // The dashboard always wants live data, never a cached page.
      cache: "no-store",
    });
  } catch (cause) {
    // fetch only rejects on network failure — usually Django not running.
    throw new ApiError(
      `Could not reach the API at ${BASE_URL}. Is the Django server running?`,
      0,
      null,
      { cause },
    );
  }

  if (response.status === 401 && !TOLERATES_401.has(path)) {
    onUnauthorized?.();
  }

  if (response.status === 204) return undefined as T;

  const body = await response.text();
  const parsed = body ? safeJsonParse(body) : null;

  if (!response.ok) {
    throw new ApiError(
      `${response.status} ${response.statusText}`,
      response.status,
      parsed ?? body,
    );
  }

  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildQuery(filters: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export interface SignupInput {
  email: string;
  display_name: string;
  password1: string;
  password2: string;
}

/**
 * Asks the backend to set a CSRF cookie.
 *
 * Logging in refreshes it anyway, so this only matters for the case where
 * a visitor has a live session but no CSRF cookie — cleared site data, say.
 * Without it every save would fail with a 403 and no way to recover.
 */
export async function ensureCsrf(): Promise<void> {
  try {
    await request<{ detail: string }>("/auth/csrf/");
  } catch {
    // Not worth surfacing: if the API is unreachable the next real call
    // will say so far more usefully.
  }
}

/** The signed-in account, or null when nobody is signed in. */
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await request<User>("/auth/user/");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

/**
 * Logs in and returns the account.
 *
 * The login response itself carries no body — just the session cookie —
 * so who that session belongs to takes a second call.
 */
export async function login(email: string, password: string): Promise<User> {
  await request<void>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const user = await getCurrentUser();
  if (!user) throw new ApiError("Logged in, but the session did not stick.", 0, null);
  return user;
}

export function logout(): Promise<{ detail: string }> {
  return request<{ detail: string }>("/auth/logout/", { method: "POST" });
}

export function signup(data: SignupInput): Promise<{ detail: string }> {
  return request<{ detail: string }>("/auth/signup/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function verifyEmail(key: string): Promise<{ detail: string; email: string }> {
  return request<{ detail: string; email: string }>(
    `/auth/verify-email/${encodeURIComponent(key)}/`,
  );
}

export function resendVerification(email: string): Promise<{ detail: string }> {
  return request<{ detail: string }>("/auth/resend-verification/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function requestPasswordReset(email: string): Promise<{ detail: string }> {
  return request<{ detail: string }>("/auth/password/reset/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(data: {
  uid: string;
  token: string;
  new_password1: string;
  new_password2: string;
}): Promise<{ detail: string }> {
  return request<{ detail: string }>("/auth/password/reset/confirm/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/* ------------------------------------------------------------------ *
 * Onboarding
 * ------------------------------------------------------------------ */

export interface SlugCheck {
  slug: string;
  available: boolean;
  reason?: string;
  domain?: string;
}

export function checkSlug(slug: string): Promise<SlugCheck> {
  return request<SlugCheck>(
    `/onboarding/slug-available/?slug=${encodeURIComponent(slug)}`,
  );
}

export function createFirstSite(data: {
  name: string;
  slug: string;
  description?: string;
}): Promise<Site> {
  return request<Site>("/onboarding/site/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/* ------------------------------------------------------------------ *
 * Sites
 * ------------------------------------------------------------------ */

export function getSites(): Promise<Paginated<Site>> {
  return request<Paginated<Site>>("/sites/");
}

export function getSite(id: number): Promise<Site> {
  return request<Site>(`/sites/${id}/`);
}

export function createSite(
  data: Pick<Site, "name" | "slug"> & Partial<Pick<Site, "description">>,
): Promise<Site> {
  return request<Site>("/sites/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateSite(id: number, data: Partial<Site>): Promise<Site> {
  return request<Site>(`/sites/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteSite(id: number): Promise<void> {
  return request<void>(`/sites/${id}/`, { method: "DELETE" });
}

/**
 * The signed-in writer's blog. The API only ever returns their own, so
 * "the first one" means theirs.
 *
 * Null means they have not been through onboarding yet, which the dashboard
 * treats as a redirect rather than an error.
 */
export async function getCurrentSite(): Promise<Site | null> {
  const { results } = await getSites();
  return results[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Posts
 * ------------------------------------------------------------------ */

export function getPosts(
  filters: PostFilters = {},
): Promise<Paginated<PostListItem>> {
  return request<Paginated<PostListItem>>(`/posts/${buildQuery(filters)}`);
}

/** Stops one blog from walking an unbounded number of pages. */
const MAX_POST_PAGES = 25;

/**
 * Every post on a blog, across pages.
 *
 * The dashboard filters, sorts and counts in the browser, so it needs the
 * whole set rather than the API's first twenty — otherwise the "Drafts (2)"
 * tab is counting page one and quietly lying.
 */
export async function getAllPosts(
  filters: PostFilters = {},
): Promise<PostListItem[]> {
  const first = await getPosts(filters);
  const posts = [...first.results];

  for (let page = 2; page <= MAX_POST_PAGES; page += 1) {
    if (posts.length >= first.count) break;

    const next = await getPosts({ ...filters, page });
    if (!next.results.length) break;

    posts.push(...next.results);
  }

  return posts;
}

export function getPost(id: number): Promise<Post> {
  return request<Post>(`/posts/${id}/`);
}

export function createPost(data: PostInput): Promise<Post> {
  return request<Post>("/posts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** PATCH, so this doubles as the editor's autosave call. */
export function updatePost(
  id: number,
  data: Partial<PostInput>,
): Promise<Post> {
  return request<Post>(`/posts/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deletePost(id: number): Promise<void> {
  return request<void>(`/posts/${id}/`, { method: "DELETE" });
}
