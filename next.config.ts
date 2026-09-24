import type { NextConfig } from "next";

/**
 * The API's own origin — scheme and host, no path: `https://….onrender.com`.
 *
 * Set in deployed environments only. Locally the app and the API are both on
 * localhost and talk to each other directly, so there is nothing to proxy and
 * this stays unset.
 */
const apiOrigin = process.env.POSTLY_API_ORIGIN?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  /**
   * Leave trailing slashes alone.
   *
   * Django routes every API path with a trailing slash and refuses to
   * redirect a POST that is missing one — `APPEND_SLASH` raises rather than
   * redirecting, because a 301 would drop the body. Next's default is the
   * exact opposite: it answers `/api/posts/` with a 308 to `/api/posts`,
   * which arrives at Django as a URL it will not accept.
   *
   * Turning the normalisation off lets the rewrite below forward each path
   * exactly as the API client wrote it. The cost is that this app's own
   * pages stop redirecting `/sagar/` to `/sagar` and answer on both.
   */
  skipTrailingSlashRedirect: true,

  /**
   * Serve the API under this app's own origin.
   *
   * Postly authenticates with a session cookie, and `config/settings/base.py`
   * sets `SESSION_COOKIE_SAMESITE = "Lax"`. Deployed on two *different*
   * registrable domains — the app on Vercel, the API on Render — that
   * combination cannot work:
   *
   * * a Lax cookie is never sent on a cross-site `fetch()`, so a writer could
   *   log in successfully and have every subsequent request arrive anonymous;
   * * `middleware.ts` gates /dashboard on a `postly_auth` cookie the API
   *   sets, which a request to this host would never carry — so the dashboard
   *   would redirect to /login for ever.
   *
   * Neither is a bug in those files. Both assume the app and the API are
   * same-site, which is what this rewrite restores: the browser only ever
   * addresses this origin, so every cookie is first-party and CORS stops
   * being involved at all. The cost is one extra hop on API calls made from
   * the browser.
   *
   * Server-side fetches deliberately do *not* come through here — see
   * `POSTLY_API_ORIGIN` in `src/lib/public-api.ts`, which reaches the API
   * directly rather than looping back through our own edge.
   */
  async rewrites() {
    if (!apiOrigin) return [];

    // `:path(.*)` rather than `:path*`. The segment-wise form drops the
    // trailing slash when it rebuilds the destination, so `/api/posts/`
    // leaves here as `/api/posts` — Django answers that with a 301 back to
    // the slashed URL, Next rewrites that Location to this origin, and the
    // browser loops. A single greedy capture forwards the path byte for
    // byte, slash included.
    return [{ source: "/api/:path(.*)", destination: `${apiOrigin}/api/:path` }];
  },
};

export default nextConfig;
