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

  // Network failure, or a response that was not JSON at all.
  if (error.status === 0 || typeof error.data === "string") {
    return { fields: {}, form: error.detail || fallback };
  }

  if (error.status === 429) {
    return {
      fields: {},
      form: "Too many attempts. Wait a minute and try again.",
    };
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
