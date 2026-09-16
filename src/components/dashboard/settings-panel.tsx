"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/site/primitives";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SiteLinkChip } from "@/components/dashboard/site-link-chip";
import { ThemePicker } from "@/components/dashboard/theme-picker";
import { ThemePreview } from "@/components/dashboard/theme-preview";
import { useAuth } from "@/components/auth-provider";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_FONT_PAIRING,
  DEFAULT_THEME,
  type BlogAppearance,
} from "@/lib/blog-theme";
import { ApiError, getCurrentSite, updateSite, type Site } from "@/lib/api";

/**
 * What the account menu's "Settings" opens.
 *
 * Small on purpose. The two things a writer actually needs to change here
 * are the name and the description that head their public blog, and both
 * are visible to readers the moment they are saved — so this screen shows
 * them next to the live address rather than in an abstract form.
 *
 * The address itself is read-only. Changing a slug changes every published
 * URL, which needs redirects behind it before it can be offered as a
 * setting.
 */
export function SettingsPanel() {
  const router = useRouter();
  const { user } = useAuth();

  const [site, setSite] = React.useState<Site | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [look, setLook] = React.useState<BlogAppearance>({
    theme: DEFAULT_THEME,
    appearance: DEFAULT_APPEARANCE,
    font_pairing: DEFAULT_FONT_PAIRING,
    accent_hue: null,
  });

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const current = await getCurrentSite();
        if (!current) {
          router.replace("/onboarding");
          return;
        }
        setSite(current);
        setName(current.name);
        setDescription(current.description);
        setLook(appearanceOf(current));
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.detail
            : "Could not load your blog's settings.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  React.useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const dirty =
    site !== null &&
    (name.trim() !== site.name ||
      description.trim() !== site.description ||
      !sameAppearance(look, appearanceOf(site)));

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!site || saving || !dirty) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await updateSite(site.id, {
        name: name.trim(),
        description: description.trim(),
        ...look,
      });
      setSite(updated);
      setName(updated.name);
      setDescription(updated.description);
      setLook(appearanceOf(updated));
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Could not save your changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DashboardHeader />

      <div className="border-b border-border/70 bg-muted/30">
        <Container className="max-w-3xl">
          <div className="flex h-14 items-center">
            {site ? (
              <SiteLinkChip domain={site.domain} href={`/${site.slug}`} />
            ) : (
              <Skeleton className="h-8 w-64 rounded-full" />
            )}
          </div>
        </Container>
      </div>

      <main className="flex-1 py-10 sm:py-14">
        <Container className="max-w-3xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-4" />
            All posts
          </Link>

          <h1 className="mt-5 font-display text-3xl tracking-[-0.02em] sm:text-4xl">
            Settings
          </h1>

          {error ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-destructive/5 p-4 ring-1 ring-destructive/20">
              <TriangleAlert
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
              <p className="text-[0.88rem] font-medium text-destructive">
                {error}
              </p>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-8 space-y-4">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <section className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
                <h2 className="font-display text-xl">Your blog</h2>
                <p className="mt-1 text-[0.875rem] text-muted-foreground">
                  The name and description at the top of your public blog.
                </p>

                <form onSubmit={handleSave} className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="site-name"
                      className="block text-[0.85rem] font-medium"
                    >
                      Blog name
                    </label>
                    <Input
                      id="site-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={120}
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="site-description"
                      className="block text-[0.85rem] font-medium"
                    >
                      Description
                    </label>
                    <textarea
                      id="site-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                      placeholder="A line about what you write here."
                      className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-[0.9rem] leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="site-address"
                      className="block text-[0.85rem] font-medium"
                    >
                      Address
                    </label>
                    <Input
                      id="site-address"
                      value={site?.domain ?? ""}
                      readOnly
                      disabled
                      className="h-10 font-mono text-[0.8rem]"
                    />
                    <p className="text-[0.8rem] text-muted-foreground">
                      Changing your address would break every link already
                      published. Get in touch if you need it moved.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      type="submit"
                      className="h-10 rounded-full px-5"
                      disabled={!dirty || saving || !name.trim()}
                    >
                      {saving ? (
                        <Loader2 aria-hidden className="animate-spin" />
                      ) : null}
                      Save changes
                    </Button>
                    {saved ? (
                      <span
                        aria-live="polite"
                        className="inline-flex items-center gap-1.5 text-[0.85rem] text-brand"
                      >
                        <Check aria-hidden className="size-3.5" />
                        Saved
                      </span>
                    ) : null}
                  </div>
                </form>
              </section>

              <section className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
                <h2 className="font-display text-xl">How your blog looks</h2>
                <p className="mt-1 text-[0.875rem] text-muted-foreground">
                  Readers see this. Your dashboard stays as it is.
                </p>

                <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
                  <ThemePicker
                    value={look}
                    onChange={(patch) =>
                      setLook((current) => ({ ...current, ...patch }))
                    }
                    disabled={saving}
                  />

                  {/* Sticky, so the preview stays in view while the writer
                      works down the controls on a tall screen. */}
                  <div className="lg:sticky lg:top-24 lg:self-start">
                    <ThemePreview
                      value={look}
                      siteName={name}
                      description={description}
                    />
                  </div>
                </div>

                <div className="mt-7 flex items-center gap-3 border-t border-border pt-6">
                  <Button
                    className="h-10 rounded-full px-5"
                    disabled={!dirty || saving}
                    onClick={handleSave}
                  >
                    {saving ? (
                      <Loader2 aria-hidden className="animate-spin" />
                    ) : null}
                    Save changes
                  </Button>
                  <p className="text-[0.8rem] text-muted-foreground">
                    Live within a minute of saving.
                  </p>
                </div>
              </section>

              <section className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
                <h2 className="font-display text-xl">Your account</h2>
                <p className="mt-1 text-[0.875rem] text-muted-foreground">
                  How you sign in, and the name shown on your posts.
                </p>

                <dl className="mt-6 space-y-4 text-[0.9rem]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
                    <dt className="text-muted-foreground">Display name</dt>
                    <dd className="font-medium">{user?.display_name ?? "—"}</dd>
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="font-mono text-[0.85rem]">
                      {user?.email ?? "—"}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          )}
        </Container>
      </main>
    </>
  );
}

/** The appearance half of a Site, as the picker and preview want it. */
function appearanceOf(site: Site): BlogAppearance {
  return {
    theme: site.theme,
    appearance: site.appearance,
    font_pairing: site.font_pairing,
    accent_hue: site.accent_hue,
  };
}

function sameAppearance(a: BlogAppearance, b: BlogAppearance): boolean {
  return (
    a.theme === b.theme &&
    a.appearance === b.appearance &&
    a.font_pairing === b.font_pairing &&
    a.accent_hue === b.accent_hue
  );
}
