import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps signed-out visitors from watching the dashboard render before its
 * first API call comes back 401, and keeps signed-in ones off /login.
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
