/**
 * Typed client for the Postly Django API.
 *
 * Phase 1 note: the backend has no authentication, so nothing here sends
 * credentials. When Phase 2 lands, the token/session handling belongs in
 * `request()` below and nowhere else.
 */

const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/$/, "");

/* ------------------------------------------------------------------ *
 * Types — these mirror blog/serializers.py
 * ------------------------------------------------------------------ */

export type PostStatus = "draft" | "published";

export interface Site {
  id: number;
  name: string;
  slug: string;
  description: string;
  domain: string;
  posts_count: number;
  created_at: string;
  updated_at: string;
}

/** What `GET /api/posts/` returns. Deliberately has no `content`. */
export interface PostListItem {
  id: number;
  site: number;
  title: string;
  slug: string;
  excerpt: string;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What the detail endpoints return — the list fields plus the body. */
export interface Post extends PostListItem {
  content: string;
  site_name: string;
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
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
 * The Phase 1 dashboard writes into whichever site exists. Returns null when
 * the database has not been seeded yet, so the UI can say so instead of
 * failing silently.
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
