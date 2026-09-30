import { ApiError } from "@/lib/api";

/**
 * Splits a DRF error body into per-field messages and a form-level one.
 *
 * DRF answers a failed POST with `{field: ["message"], non_field_errors:
 * ["message"]}`, or `{detail: "message"}` for anything raised outside a
 * serializer. Both shapes end up here so the forms can put each message
 * under the input it belongs to, and only fall back to a banner for the
 * rest.
 */
export type ParsedErrors = {
  fields: Record<string, string>;
  form: string | null;
};

const FORM_LEVEL_KEYS = new Set(["non_field_errors", "detail"]);

export function parseApiErrors(
  error: unknown,
  fallback = "Something went wrong. Try again.",
): ParsedErrors {
  if (!(error instanceof ApiError)) {
    return { fields: {}, form: fallback };
  }

  // Network failure; `message` says the API could not be reached.
  if (error.status === 0) {
    return { fields: {}, form: error.detail || fallback };
  }

  // Before the next check, which would otherwise catch a 429 from a proxy
  // that answers in HTML.
  if (error.status === 429) {
    return {
      fields: {},
      form: "Too many attempts. Wait a minute and try again.",
    };
  }

  // A body that was not the API's JSON, such as Django's HTML 500 page.
  // request() has already dropped it and put a generic sentence in
  // `message`, which `detail` returns. The form's own fallback is not used
  // here because it can be wrong about the cause: "That email and password
  // did not match" is not what a server error means.
  if (error.data === null || typeof error.data === "string") {
    return { fields: {}, form: error.detail || fallback };
  }

  if (!error.data || typeof error.data !== "object") {
    return { fields: {}, form: fallback };
  }

  const fields: Record<string, string> = {};
  const formMessages: string[] = [];

  for (const [key, value] of Object.entries(error.data as Record<string, unknown>)) {
    const message = Array.isArray(value) ? value.join(" ") : String(value);
    if (!message) continue;

    if (FORM_LEVEL_KEYS.has(key)) {
      formMessages.push(message);
    } else {
      fields[key] = message;
    }
  }

  return {
    fields,
    // A banner would be redundant when every message is already sitting
    // under its own input.
    form:
      formMessages.join(" ") ||
      (Object.keys(fields).length ? null : fallback),
  };
}
