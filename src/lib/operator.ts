/**
 * Who runs Codomain, and how to reach them — for the legal pages, the footer
 * and every "get in touch" link.
 *
 * One file so the placeholders are in one place (see CLAUDE.md,
 * "Placeholders to replace before launch"):
 *
 * * `CONTACT_EMAIL` is an address on the domain Codomain owns. It only
 *   receives mail once Cloudflare Email Routing forwards it (runbook 7.5);
 *   NEXT_PUBLIC_CONTACT_EMAIL on Vercel overrides it without a code change.
 * * `OPERATOR_LOCATION` is a city, not a postal address. The backend's
 *   POSTLY_POSTAL_ADDRESS, printed in subscriber email, has the same
 *   placeholder and needs the same fix.
 *
 * NEXT_PUBLIC_ because the footer and the legal pages render it on the
 * client as well as the server. It is an address people are meant to see.
 */

export const OPERATOR_NAME = "Sagar Raturi";

export const OPERATOR_LOCATION = "New Delhi, India";

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "contact@codomain.in";

/** The date the Terms and Privacy Policy last changed. Bump it when they do. */
export const LEGAL_UPDATED = "30 September 2026";
