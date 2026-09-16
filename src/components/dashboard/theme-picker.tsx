"use client";

import * as React from "react";
import { Check } from "lucide-react";
import {
  FONT_PAIRINGS,
  THEMES,
  blogThemeVars,
  previewScheme,
  type Appearance,
  type BlogAppearance,
  type FontPairing,
  type ThemeName,
} from "@/lib/blog-theme";
import { cn } from "@/lib/utils";

const APPEARANCES: { value: Appearance; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Always light." },
  { value: "dark", label: "Dark", hint: "Always dark." },
  {
    value: "system",
    label: "Follow the reader",
    hint: "Light or dark, whichever their device asks for.",
  },
];

/**
 * A swatch: the theme's own background, text and accent, in miniature.
 *
 * Drawn from the same table the blog renders from, so what a writer picks
 * here cannot drift from what a reader gets.
 */
function Swatch({
  theme,
  appearance,
  hue,
}: {
  theme: ThemeName;
  appearance: Appearance;
  hue: number | null;
}) {
  const vars = blogThemeVars(
    { theme, accent_hue: hue },
    previewScheme(appearance),
  );

  return (
    <span
      aria-hidden
      className="flex h-11 w-full items-center gap-1.5 rounded-lg border border-border px-2.5"
      style={{ background: vars["--background"] } as React.CSSProperties}
    >
      <span
        className="h-4 flex-1 rounded-full"
        style={{ background: vars["--foreground"], opacity: 0.85 }}
      />
      <span
        className="size-4 shrink-0 rounded-full"
        style={{ background: vars["--brand"] }}
      />
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[0.85rem] font-medium">{children}</h3>
  );
}

/**
 * The controls behind "how your blog looks".
 *
 * Everything here is a choice between named things, plus one dial. There is
 * no free-text colour input, and that is a decision rather than an omission:
 * a writer handed lightness can produce grey-on-grey, and a writer handed a
 * hex field can produce a blog that is unreadable in dark mode. Restricting
 * them to a hue means the theme keeps lightness and chroma, so contrast
 * holds at all 360 settings. See lib/blog-theme.ts.
 */
export function ThemePicker({
  value,
  onChange,
  disabled,
}: {
  value: BlogAppearance;
  onChange: (patch: Partial<BlogAppearance>) => void;
  disabled?: boolean;
}) {
  const usingCustomHue = value.accent_hue !== null;

  return (
    <div className={cn("space-y-7", disabled && "pointer-events-none opacity-60")}>
      <section className="space-y-3">
        <FieldLabel>Theme</FieldLabel>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(Object.keys(THEMES) as ThemeName[]).map((name) => {
            const theme = THEMES[name];
            const active = value.theme === name;

            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                // The visible text is a swatch, a name and a sentence of
                // description; without this the button announces all three.
                aria-label={`Theme: ${theme.label}`}
                onClick={() => onChange({ theme: name })}
                className={cn(
                  "group cursor-pointer rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-brand/50 bg-brand/5"
                    : "border-border hover:bg-muted/60",
                )}
              >
                <Swatch
                  theme={name}
                  appearance={value.appearance}
                  hue={value.accent_hue}
                />
                <span className="mt-2.5 flex items-center gap-1.5">
                  <span className="text-[0.85rem] font-medium">
                    {theme.label}
                  </span>
                  {active ? (
                    <Check aria-hidden className="size-3.5 text-brand" />
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[0.78rem] leading-snug text-muted-foreground">
                  {theme.description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <FieldLabel>Appearance</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {APPEARANCES.map(({ value: option, label, hint }) => (
            <button
              key={option}
              type="button"
              aria-pressed={value.appearance === option}
              title={hint}
              onClick={() => onChange({ appearance: option })}
              className={cn(
                "cursor-pointer rounded-full border px-3.5 py-1.5 text-[0.8rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                value.appearance === option
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[0.78rem] text-muted-foreground">
          {APPEARANCES.find((a) => a.value === value.appearance)?.hint}
        </p>
      </section>

      <section className="space-y-3">
        <FieldLabel>Type</FieldLabel>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(FONT_PAIRINGS) as FontPairing[]).map((name) => {
            const pairing = FONT_PAIRINGS[name];
            const active = value.font_pairing === name;

            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                // The visible content is a type specimen, which reads as
                // "Ag The quick brown fox" to a screen reader.
                aria-label={`Type: ${pairing.label} — ${pairing.description}`}
                onClick={() => onChange({ font_pairing: name })}
                className={cn(
                  "cursor-pointer rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "border-brand/50 bg-brand/5"
                    : "border-border hover:bg-muted/60",
                )}
              >
                {/* Set in the pairing's own faces, so the choice is legible
                    as itself rather than as a label. */}
                <span
                  aria-hidden
                  className="block text-[1.35rem] leading-none"
                  style={{ fontFamily: pairing.heading }}
                >
                  Ag
                </span>
                <span
                  aria-hidden
                  className="mt-1 block text-[0.78rem] leading-snug text-muted-foreground"
                  style={{ fontFamily: pairing.body }}
                >
                  The quick brown fox
                </span>
                <span className="mt-2 block text-[0.8rem] font-medium">
                  {pairing.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel>Accent</FieldLabel>
          <button
            type="button"
            onClick={() =>
              onChange({ accent_hue: usingCustomHue ? null : 200 })
            }
            className="cursor-pointer rounded-sm text-[0.78rem] text-muted-foreground underline decoration-border underline-offset-[0.25em] transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {usingCustomHue ? "Use the theme's own accent" : "Pick a colour"}
          </button>
        </div>

        {usingCustomHue ? (
          <div className="space-y-2">
            <label htmlFor="accent-hue" className="sr-only">
              Accent hue
            </label>
            <input
              id="accent-hue"
              type="range"
              min={0}
              max={360}
              step={1}
              value={value.accent_hue ?? 0}
              onChange={(event) =>
                onChange({ accent_hue: Number(event.target.value) })
              }
              // The track is the hue wheel itself, so the control shows what
              // it controls. OKLCH at a fixed lightness and chroma, which is
              // exactly how the value is used.
              className="h-6 w-full cursor-pointer appearance-none rounded-full border border-border [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow"
              style={{
                background:
                  "linear-gradient(to right, oklch(0.6 0.15 0), oklch(0.6 0.15 60), oklch(0.6 0.15 120), oklch(0.6 0.15 180), oklch(0.6 0.15 240), oklch(0.6 0.15 300), oklch(0.6 0.15 360))",
              }}
            />
            <p className="font-mono text-[0.72rem] text-muted-foreground">
              hue {value.accent_hue}°
            </p>
          </div>
        ) : (
          <p className="text-[0.78rem] text-muted-foreground">
            Using {THEMES[value.theme]?.label ?? "the theme"}&rsquo;s own
            accent. Pick a colour to set your own — you choose the hue, and the
            theme keeps the brightness, so your links stay readable either way.
          </p>
        )}
      </section>
    </div>
  );
}
