"use server";

import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { BASE_URL, blogTag } from "@/lib/public-api";

/**
 * Django's session cookie. Session keys are lowercase letters and digits;
 * anything else is not a key Django issued, and is not forwarded.
 */
const SESSION_COOKIE = "sessionid";
const SESSION_KEY = /^[a-z0-9]{8,64}$/;

/**
 * Expire the cached public pages of the signed-in writer's own blog, so the
 * next reader — the writer themselves, usually — gets fresh data rather than
 * up to a minute of the old version. Call after any dashboard change a
 * reader can see.
 *
 * ## Why it takes no arguments
 *
 * A Server Action is a public POST endpoint: anything that can reach this
 * app can call it, with whatever arguments it likes. Accepting a slug would
 * let a stranger expire any blog's cache on a loop and turn every one of
 * those into a refetch from the API.
 *
 * So the blog is never named by the caller. The request's own session
 * cookie is shown to the API, which answers with the sites that session
 * owns — the same owner-filtered queryset every dashboard call goes
 * through — and only those are expired. No session, or one the API
 * rejects, and nothing happens.
 *
 * Failures are swallowed. This is a courtesy on top of a change that has
 * already been saved; if it does not run, the 60-second revalidation in
 * public-api.ts still gets the change out.
 */
export async function refreshMyBlog(): Promise<void> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session || !SESSION_KEY.test(session)) return;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/sites/`, {
      headers: {
        Accept: "application/json",
        Cookie: `${SESSION_COOKIE}=${session}`,
      },
      // The answer depends on who is asking. Caching it would hand one
      // writer's site list to the next caller.
      cache: "no-store",
    });
  } catch {
    return;
  }

  if (!response.ok) return;

  const { results } = (await response.json()) as {
    results: { slug: string }[];
  };

  for (const { slug } of results) {
    updateTag(blogTag(slug));
  }
}
