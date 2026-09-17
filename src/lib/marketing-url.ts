/**
 * Where the "Published with Postly" credits on a blog point.
 *
 * This is the one outbound link on somebody else's site, and it has to lead
 * somewhere that loads. `https://postly.com` is not that yet: the domain is
 * registered to someone else and serves a certificate that does not name it,
 * so a reader clicking the credit gets a full-page browser warning about an
 * insecure connection rather than a marketing page.
 *
 * So the default is a relative `/`, which today reaches Postly's own
 * homepage because a blog is served from the same origin at
 * `postly.com/{slug}`. Set NEXT_PUBLIC_MARKETING_URL once the real domain
 * exists and has a certificate.
 *
 * Phase 3 note: when blogs move to `{slug}.postly.com`, a relative `/` stops
 * being right — it would land on the blog's own index instead of the
 * marketing site. That is the point at which this variable stops being
 * optional, which is why the link goes through here rather than being
 * written out at three call sites.
 */
export const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL || "/";

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
