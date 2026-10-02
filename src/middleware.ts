import { NextResponse, type NextRequest } from "next/server";
import {
  BLOG_DOMAIN,
  ORIGINAL_PATH_HEADER,
  SITE_URL,
  classifyHost,
} from "@/lib/hosts";

/**
 * Two jobs, picked by the request's Host (see lib/hosts.ts).
 *
 * **On a blog's own host** (`nina.codomain.blog`), it maps the request onto
 * the existing `/[siteSlug]` route: `/a-post` is served as `/nina/a-post`.
 * A rewrite, not a redirect, so the reader's address bar keeps the blog's
 * address. Nothing else of the app is reachable there: `/dashboard` on a
 * blog host is just a post slug that does not exist. The bare blog domain
 * has no blog of its own and goes to the homepage.
 *
 * **On the app**, it tags the request with its original path for
 * `app/[siteSlug]/layout.tsx`, which sends old `www.codomain.in/nina/...`
 * addresses to the blog's own host once blogs have one, and it runs the
 * dashboard redirects below.
 *
 * The dashboard redirects keep signed-out visitors from watching the
 * dashboard render before its first API call comes back 401, and keep
 * signed-in ones off /login.
 *
 * This is a convenience, not a security boundary. It reads a cookie and
 * nothing more: anyone can set it in devtools and walk straight past. What
 * actually protects the data is the API — every endpoint is IsAuthenticated
 * by default and every queryset is filtered by the requesting user, so a
 * forged cookie gets a dashboard shell with nothing in it. Never move a
 * real check up here.
 *
 * It reads `postly_auth`, not `sessionid`. Django hands out a session
 * cookie to anonymous visitors as well — allauth creates one during signup
 * — so "has a session cookie" is not the same question as "is logged in",
 * and answering the first bounces a signed-out visitor between /login and
 * /dashboard forever. `postly_auth` tracks request.user and is set and
 * cleared by AuthHintCookieMiddleware on the backend.
 *
 * The cookie reaches this middleware because cookies ignore ports, so :8000
 * and :3000 share them in development. Across subdomains in production it
 * needs SESSION_COOKIE_DOMAIN set on the backend.
 */

const AUTH_HINT_COOKIE = "postly_auth";
const SIGNED_OUT_ONLY = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = classifyHost(request.headers.get("host"));

  if (host.kind === "blog-root") {
    return NextResponse.redirect(new URL("/", SITE_URL), 308);
  }

  if (host.kind === "blog") {
    const url = request.nextUrl.clone();
    url.pathname = `/${host.slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  const hasSession = request.cookies.get(AUTH_HINT_COOKIE)?.value === "1";

  if (pathname.startsWith("/dashboard") && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && SIGNED_OUT_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!BLOG_DOMAIN) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set(ORIGINAL_PATH_HEADER, pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Everything but the API proxy and Next's own files. A blog host needs the
  // rewrite on every page path, and the app needs the path header on every
  // path that might be an old blog address. `/api` must stay out: on a blog
  // host it is how the subscribe form reaches the backend, through the
  // rewrite in next.config.ts.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
