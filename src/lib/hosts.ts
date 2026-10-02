/**
 * Which host serves what, and where links inside a published blog point.
 *
 * Codomain answers on two domains from one Next.js app:
 *
 * * **The app**, `www.codomain.in` (SITE_URL): the homepage, sign-in and
 *   the dashboard. The only domain with a session cookie on it.
 * * **The blogs**, `<slug>.codomain.blog` (NEXT_PUBLIC_BLOG_DOMAIN): one
 *   subdomain per writer, read-only and cookie-free. A separate registrable
 *   domain on purpose: a writer's HTML runs there, and on a sibling
 *   subdomain of the app it would be same-site with every writer's
 *   dashboard session. See the deploy runbook, step 7.8.
 *
 * With NEXT_PUBLIC_BLOG_DOMAIN unset, blogs are paths on the app instead
 * (`www.codomain.in/<slug>`), which is how they were served before the blog
 * domain existed and how development still works without one.
 *
 * Three files act on this. `middleware.ts` turns `<slug>.codomain.blog/x`
 * into the existing `/[siteSlug]/x` route and sends the bare blog domain to
 * the homepage. `app/[siteSlug]/layout.tsx` redirects old path addresses on
 * the app to the blog's own domain. Every link on a blog page goes through
 * `blogPath()`, because on a blog's own host the slug is no longer part of
 * the path.
 *
 * The backend has its own copy of the setting, BLOG_DOMAIN in
 * `postly-backend/blog/addresses.py`, which decides the addresses shown in
 * the dashboard and mailed to readers. Set this one first and the backend's
 * second: this side has to serve the new addresses before anything hands
 * them out.
 */

/** The app's own origin: canonical URLs, link previews, links home from a blog. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.codomain.in"
).replace(/\/+$/, "");

/**
 * The domain whose subdomains are blogs, e.g. `codomain.blog`, or "" while
 * blogs are paths on the app. May carry a port for local testing
 * (`lvh.me:3000`, see README).
 */
export const BLOG_DOMAIN = (process.env.NEXT_PUBLIC_BLOG_DOMAIN ?? "")
  .trim()
  .toLowerCase()
  .replace(/^\.+|\.+$/g, "");

/** BLOG_DOMAIN without any port, for comparing against a request's hostname. */
const BLOG_HOSTNAME = BLOG_DOMAIN.split(":")[0];

/**
 * A link from one blog page to another page of the same blog.
 *
 * `blogPath("nina")` is the blog's front page and
 * `blogPath("nina", "/a-post")` a post: `/nina/a-post` while blogs are
 * paths, `/a-post` on the blog's own host.
 */
export function blogPath(slug: string, path: `/${string}` | "" = ""): string {
  if (BLOG_DOMAIN) return path || "/";
  return `/${slug}${path}`;
}

/** The same page as an absolute URL, for canonical tags and redirects. */
export function blogUrl(slug: string, path: `/${string}` | "" = ""): string {
  if (!BLOG_DOMAIN) return `${SITE_URL}/${slug}${path}`;

  // Production is always HTTPS; `next dev` on lvh.me is not.
  const scheme = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${scheme}://${slug}.${BLOG_DOMAIN}${path}`;
}

/**
 * What a request's Host names:
 *
 * * `{ kind: "blog", slug }` for `<slug>.<BLOG_DOMAIN>`,
 * * `{ kind: "blog-root" }` for the bare blog domain or its `www`,
 * * `{ kind: "app" }` for anything else, including every host while
 *   BLOG_DOMAIN is unset.
 *
 * Deeper names (`a.b.codomain.blog`) are not blogs: a slug is a single DNS
 * label, which `postly-backend/blog/subdomains.py` enforces.
 */
export type HostKind =
  | { kind: "app" }
  | { kind: "blog-root" }
  | { kind: "blog"; slug: string };

export function classifyHost(host: string | null): HostKind {
  if (!BLOG_HOSTNAME || !host) return { kind: "app" };

  const hostname = host.split(":")[0].toLowerCase().replace(/\.$/, "");

  if (hostname === BLOG_HOSTNAME || hostname === `www.${BLOG_HOSTNAME}`) {
    return { kind: "blog-root" };
  }

  const suffix = `.${BLOG_HOSTNAME}`;
  if (!hostname.endsWith(suffix)) return { kind: "app" };

  const label = hostname.slice(0, -suffix.length);
  return label && !label.includes(".") ? { kind: "blog", slug: label } : { kind: "app" };
}

/**
 * Set by middleware.ts on app requests to the path and query string as the
 * browser asked for them. app/[siteSlug]/layout.tsx needs the whole path to
 * redirect an old blog address, and a layout is not told it.
 */
export const ORIGINAL_PATH_HEADER = "x-codomain-path";
