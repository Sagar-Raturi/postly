/**
 * The published blog's only writable calls: subscribe, confirm, unsubscribe.
 *
 * A third client, and the reason it is not folded into either of the other
 * two is that it shares its constraints with neither.
 *
 * **Not `lib/api.ts`.** That one is the dashboard's: it sends the session
 * cookie, copies the CSRF token into a header, and redirects to /login on a
 * 401. On a page a stranger opens there is no session to send, and the
 * backend's subscription views run with `authentication_classes = []`
 * precisely so that none of that machinery is involved.
 *
 * **Not `lib/public-api.ts`.** That one is server-only in practice — every
 * query is wrapped in React's `cache()`, which throws outside a Server
 * Component, and every fetch carries a `revalidate` for the static render.
 * These calls run in the browser, from a form, and must never be cached:
 * "did my subscription go through" is not a question with a sixty-second
 * old answer.
 *
 * What the two public modules do share is that neither sends credentials
 * and neither knows about a logged-in user.
 */

const BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/$/, "");

/** How the API describes one subscription back to the person holding its
 *  token. Mirrors SubscriptionSerializer. */
export interface Subscription {
  email: string;
  status: "pending" | "confirmed" | "unsubscribed" | "bounced";
  site_name: string;
  site_slug: string;
}

/** Which form on the blog a subscription came from. Mirrors
 *  Subscriber.Source — an unlisted value is a 400. */
export type SubscribeSource = "index" | "post";

/**
 * A subscription call that did not succeed, carrying whatever the API said.
 *
 * `detail` is always something safe to show a reader: the backend answers
 * every bad token with one fixed sentence and never says which kind of bad
 * it was, so there is nothing here to sanitize before rendering.
 */
export class SubscribeError extends Error {
  readonly status: number;

  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "SubscribeError";
    this.status = status;
  }
}

const GENERIC_FAILURE = "Something went wrong. Try again in a moment.";
const OFFLINE = "Could not reach the server. Check your connection and try again.";

/**
 * Pulls a readable sentence out of a DRF error body.
 *
 * Three shapes turn up: `{detail}` for anything raised outside a
 * serializer, `{field: [messages]}` for validation, and a non-JSON body
 * for a proxy error page. The last of those must not end up rendered at a
 * reader, so it falls through to the generic message.
 */
function messageFrom(body: unknown, status: number): string {
  if (status === 429) {
    return "Too many attempts from this connection. Try again later.";
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;

    if (typeof record.detail === "string") return record.detail;

    for (const value of Object.values(record)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }

  return GENERIC_FAILURE;
}

async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method,
      headers:
        init.body === undefined
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // No `credentials`. These endpoints take no session, and sending a
      // cookie would drag the dashboard's CSRF check into a form that a
      // signed-out reader has to be able to use — see the note on
      // authentication_classes in blog/public_views.py.
      cache: "no-store",
    });
  } catch (cause) {
    throw new SubscribeError(OFFLINE, 0, { cause });
  }

  // 204 has no body, and a proxy error page is not JSON. Neither should
  // throw a parse error on top of whatever already went wrong.
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new SubscribeError(messageFrom(body, response.status), response.status);
  }

  return body as T;
}

/**
 * Ask to be told about new posts on `siteSlug`.
 *
 * Resolves with the sentence to show the reader. That sentence comes from
 * the server and is the same one for a new address, an address already
 * waiting to confirm, and an address already subscribed — the API will not
 * say which, because a form that distinguishes them is a form that answers
 * "does this person read this blog" for any address a stranger types.
 *
 * `website` is the honeypot. It is always sent and always empty from here;
 * only an automated form-filler puts anything in it, and the server
 * silently discards those while answering exactly as it does here.
 */
export async function subscribe(
  siteSlug: string,
  email: string,
  source: SubscribeSource,
  honeypot = "",
): Promise<string> {
  const body = await call<{ detail: string }>(
    `/public/sites/${encodeURIComponent(siteSlug)}/subscribe/`,
    { method: "POST", body: { email, source, website: honeypot } },
  );

  return body.detail;
}

/**
 * Spend a confirmation token from an email.
 *
 * POST rather than GET because mail scanners fetch every link in a message
 * before a person sees it, and a confirmation that a scanner can complete
 * is not a confirmation. See ConfirmSubscriptionView.
 */
export function confirmSubscription(token: string): Promise<Subscription> {
  return call<Subscription>("/public/subscriptions/confirm/", {
    method: "POST",
    body: { token },
  });
}

/** What an unsubscribe link would end, without ending it. Safe to prefetch. */
export function previewUnsubscribe(token: string): Promise<Subscription> {
  return call<Subscription>(
    `/public/subscriptions/unsubscribe/?token=${encodeURIComponent(token)}`,
    { method: "GET" },
  );
}

/** Actually unsubscribe. Succeeds again if it has already happened. */
export function unsubscribe(token: string): Promise<Subscription> {
  return call<Subscription>("/public/subscriptions/unsubscribe/", {
    method: "POST",
    body: { token },
  });
}
