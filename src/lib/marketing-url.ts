/**
 * Where the "Published with Codomain" credits on a blog point.
 *
 * This is the one outbound link on somebody else's site, and it has to lead
 * somewhere that loads. It once pointed at `https://postly.com`, a domain
 * the product never owned, whose certificate did not even name it.
 *
 * The default is a relative `/`, which today reaches Codomain's own
 * homepage because a blog is served from the same origin at
 * `www.codomain.in/{slug}`.
 *
 * Phase 3 note: when blogs move to `{slug}.codomain.blog`, a relative `/` stops
 * being right — it would land on the blog's own index instead of the
 * marketing site. That is the point at which this variable stops being
 * optional, which is why the link goes through here rather than being
 * written out at three call sites.
 */
export const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL || "/";

/**
 * A page on the marketing site — `/privacy`, say — addressed so it still
 * resolves from a blog once blogs move to their own subdomains.
 */
export function marketingPath(path: `/${string}`): string {
  return `${MARKETING_URL.replace(/\/+$/, "")}${path}`;
}

/**
 * Props for a credit link, so the three of them cannot drift apart.
 *
 * `target="_blank"` only when the link actually leaves this site: opening a
 * new tab for a same-origin `/` is a small rudeness, and `rel="noopener"`
 * is about a cross-origin tab holding a handle on this one.
 */
export function marketingLinkProps(): {
  href: string;
  target?: "_blank";
  rel?: string;
} {
  const external = /^https?:\/\//i.test(MARKETING_URL);

  return external
    ? { href: MARKETING_URL, target: "_blank", rel: "noopener" }
    : { href: MARKETING_URL };
}
