"use client";

import * as React from "react";
import {
  blogThemeVars,
  previewScheme,
  type BlogAppearance,
} from "@/lib/blog-theme";

/**
 * A miniature of the blog index, in whatever the writer is currently
 * choosing.
 *
 * The same token names and the same table the real page uses, so this is a
 * genuine preview rather than a drawing of one. What it cannot do is the
 * `prefers-color-scheme` half of "follow the reader" — a media query is not
 * expressible in a style attribute, which is precisely why the published
 * blog emits a `<style>` element instead of using this function. The label
 * says so rather than pretending.
 */
export function ThemePreview({
  value,
  siteName,
  description,
}: {
  value: BlogAppearance;
  siteName: string;
  description: string;
}) {
  const vars = blogThemeVars(value, previewScheme(value.appearance));

  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-xl border border-border"
        style={vars as React.CSSProperties}
      >
        <div
          className="px-5 py-8"
          style={{ background: "var(--background)", color: "var(--foreground)" }}
        >
          <p
            className="text-[0.8rem]"
            style={{ fontFamily: "var(--blog-heading)" }}
          >
            {siteName || "Your blog"}
          </p>

          <div
            className="my-4 h-px w-full"
            style={{ background: "var(--border)" }}
          />

          <h4
            className="text-[1.35rem] leading-tight tracking-[-0.015em]"
            style={{ fontFamily: "var(--blog-heading)" }}
          >
            {siteName || "Your blog"}
          </h4>
          <p
            className="mt-1.5 text-[0.85rem] leading-relaxed"
            style={{
              fontFamily: "var(--blog-body)",
              color: "var(--muted-foreground)",
            }}
          >
            {description || "A line about what you write here."}
          </p>

          <div
            className="my-5 h-px w-full"
            style={{ background: "var(--border)" }}
          />

          <h5
            className="text-[1.05rem] leading-snug"
            style={{
              fontFamily: "var(--blog-heading)",
              color: "var(--brand)",
            }}
          >
            A post you have written
          </h5>
          <p
            className="mt-1 font-mono text-[0.65rem] tracking-wide uppercase"
            style={{ color: "var(--muted-foreground)" }}
          >
            16 September 2026 · 4 min read
          </p>
          <p
            className="mt-2 text-[0.85rem] leading-relaxed"
            style={{
              fontFamily: "var(--blog-body)",
              color: "var(--muted-foreground)",
            }}
          >
            The opening lines of the post, in the type and the colours a
            reader will actually see them in.
          </p>

          <blockquote
            className="mt-4 pl-3 text-[0.85rem] italic"
            style={{
              fontFamily: "var(--blog-body)",
              color: "var(--muted-foreground)",
              borderLeft: "2px solid var(--brand)",
            }}
          >
            And a quotation, to show where the accent lands.
          </blockquote>
        </div>
      </div>

      <p className="text-[0.75rem] text-muted-foreground">
        {value.appearance === "system"
          ? "Shown light. Readers whose device is set to dark will get the dark version."
          : "This is what a reader sees."}
      </p>
    </div>
  );
}
