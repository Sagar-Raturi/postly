/**
 * The letters an avatar falls back to when there is no photo.
 *
 * Shared rather than duplicated: the same writer must get the same circle
 * in the dashboard header, in their settings, and on their published blog.
 * Two of those are rendered on the server and one in the browser, so this
 * has to stay a plain function with no imports.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";
}
