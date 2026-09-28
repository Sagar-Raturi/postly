/**
 * Who runs Postly, and how to reach them — for the legal pages, the footer
 * and every "get in touch" link.
 *
 * One file so the placeholders are in one place. **Two of these are not
 * real yet** (see CLAUDE.md, "Placeholders to replace before launch"):
 *
 * * `CONTACT_EMAIL` defaults to an address at `postly.example`, a domain
 *   reserved by RFC 2606 that can never deliver mail to anyone. It is a
 *   stand-in until a domain and mailbox are bought; set
 *   NEXT_PUBLIC_CONTACT_EMAIL on Vercel to replace it without a code change.
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
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "contact@postly.example";

/** The date the Terms and Privacy Policy last changed. Bump it when they do. */
export const LEGAL_UPDATED = "28 September 2026";
