/**
 * The letters an avatar falls back to when there is no photo.
 *
 * Shared rather than duplicated: the same writer must get the same circle
 * in the dashboard header, in their settings, and on their published blog.
 * Two of those are rendered on the server and one in the browser, so this
 * has to stay a plain function with no imports.
 *
 * First and last word, so "Sagar Raturi" is SR and "Sagar" is S — a middle
 * name should not displace the surname. Uses the code-point-aware spread
 * rather than `charAt`, because a name can begin with an astral character
 * and `"𝒮"[0]` is half of one.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";

  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";

  return (first + last).toUpperCase();
}
