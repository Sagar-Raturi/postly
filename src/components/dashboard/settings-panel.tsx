"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Container } from "@/components/site/primitives";
import { AvatarField } from "@/components/dashboard/avatar-field";
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
import {
  ApiError,
  getCurrentSite,
  updateCurrentUser,
  updateSite,
  type Site,
} from "@/lib/api";

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
  const [tagline, setTagline] = React.useState("");
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
        setTagline(current.tagline);
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
      tagline.trim() !== site.tagline ||
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
        tagline: tagline.trim(),
        description: description.trim(),
        ...look,
      });
      setSite(updated);
      setName(updated.name);
      setTagline(updated.tagline);
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
                      htmlFor="site-tagline"
                      className="block text-[0.85rem] font-medium"
                    >
                      Tagline
                    </label>
                    <Input
                      id="site-tagline"
                      value={tagline}
                      onChange={(event) => setTagline(event.target.value)}
                      maxLength={160}
                      placeholder="Software, mountains, and the long way round."
                      className="h-10"
                    />
                    <p className="text-[0.8rem] text-muted-foreground">
                      One line, under your name at the top of every page.
                    </p>
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

              <PublicProfileSection />

              <SubscriptionsSection />

              <section className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
                <h2 className="font-display text-xl">Your public profile</h2>
                <p className="mt-1 text-[0.875rem] text-muted-foreground">
                  How you appear to readers, next to your name on your blog.
                </p>

                <div className="mt-6">
                  <AvatarField />
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

/**
 * "Your public profile" — the About text, and whether readers get the
 * writer's email address.
 *
 * Both controls save on their own rather than through the page's Save
 * button. The switch because a toggle that needs confirming is a toggle you
 * cannot trust: the only question it answers is "is my address public right
 * now", and the honest answer has to be the one on screen. The bio saves
 * when the field loses focus, so the section has one status line and one
 * mental model rather than two.
 */
function PublicProfileSection() {
  const { user, refresh } = useAuth();

  const [bio, setBio] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [error, setError] = React.useState<string | null>(null);

  // The provider loads the account after this mounts, so the field takes
  // its initial value when that arrives — once, and only once. Keying this
  // on `user` alone would have every refresh() overwrite whatever is
  // half-typed in the box.
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (seeded.current || !user) return;
    seeded.current = true;
    setBio(user.bio);
  }, [user]);

  React.useEffect(() => {
    if (status !== "saved") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function save(
    patch: Partial<{ bio: string; show_email_publicly: boolean }>,
  ) {
    setStatus("saving");
    setError(null);
    try {
      await updateCurrentUser(patch);
      // Re-read rather than patching a local copy: the account object is
      // what the rest of the dashboard renders from, and the serializer
      // trims the bio on its way in.
      await refresh();
      setStatus("saved");
    } catch (err) {
      setStatus("idle");
      setError(
        err instanceof ApiError ? err.detail : "Could not save that change.",
      );
    }
  }

  const showEmail = user?.show_email_publicly ?? false;

  return (
    <section className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl">Your public profile</h2>
        <SaveStatus status={status} />
      </div>
      <p className="mt-1 text-[0.875rem] text-muted-foreground">
        The panel beside your posts, on every page of your blog.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 text-[0.85rem] font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-2">
        <label htmlFor="user-bio" className="block text-[0.85rem] font-medium">
          About
        </label>
        <textarea
          id="user-bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          onBlur={() => {
            if (user && bio.trim() !== user.bio) void save({ bio: bio.trim() });
          }}
          rows={4}
          maxLength={300}
          disabled={!user}
          placeholder="A couple of lines about who you are and what you write."
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-[0.9rem] leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
        />
        <p className="text-[0.8rem] text-muted-foreground">
          {300 - bio.length} characters left. Saves when you click away.
        </p>
      </div>

      <div className="mt-7 border-t border-border pt-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <label
              htmlFor="show-email"
              className="block text-[0.9rem] font-medium"
            >
              Show my email address on my public blog
            </label>
            <p
              id="show-email-help"
              className="mt-1.5 max-w-prose text-[0.8rem] leading-relaxed text-muted-foreground"
            >
              Visitors will be able to email you directly. Addresses published
              on public pages are often collected by spam bots.
            </p>
          </div>

          <Switch
            id="show-email"
            aria-describedby="show-email-help"
            checked={showEmail}
            disabled={!user || status === "saving"}
            onCheckedChange={(next) => void save({ show_email_publicly: next })}
            className="mt-0.5"
          />
        </div>

        {/*
          Shown only while the switch is on, because it is a preview of
          something that is now true rather than a demonstration of what
          would happen. Off, there is nothing to preview: the API stops
          sending the address at all.
        */}
        {showEmail && user ? (
          <div className="mt-5 rounded-xl bg-muted/50 p-4 ring-1 ring-border">
            <p className="text-[0.75rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              On your blog
            </p>

            <div className="mt-3 flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/12 font-display text-[1rem] font-medium text-brand"
              >
                {previewInitials(user.display_name)}
              </span>
              <div className="min-w-0">
                <p className="font-display text-[1.05rem] leading-tight">
                  {user.display_name}
                </p>
                <p className="mt-0.5 truncate text-[0.8rem] text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The switch that offers readers an email subscription at all.
 *
 * Self-contained, like PublicProfileSection: it loads the blog itself and
 * saves the moment the switch moves, rather than joining the main form's
 * "Save changes" button. A switch that needs a separate save press is a
 * switch people leave in the wrong position.
 *
 * Deliberately *not* framed as deleting anything when turned off. Off stops
 * new sign-ups — the public subscribe endpoint 404s — and leaves everybody
 * already on the list exactly where they are, so turning it off and on
 * again is not a way to lose a mailing list.
 */
function SubscriptionsSection() {
  const [site, setSite] = React.useState<Site | null>(null);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getCurrentSite()
      .then((loaded) => {
        if (!cancelled) setSite(loaded);
      })
      .catch(() => {
        // The panel above this one already reports a failed load, and two
        // error banners for one outage is noise.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (status !== "saved") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function toggle(next: boolean) {
    if (!site) return;

    setStatus("saving");
    setError(null);
    try {
      setSite(await updateSite(site.id, { subscriptions_enabled: next }));
      setStatus("saved");
    } catch (err) {
      setStatus("idle");
      setError(
        err instanceof ApiError ? err.detail : "Could not save that change.",
      );
    }
  }

  const enabled = site?.subscriptions_enabled ?? false;

  return (
    <section className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl">Email subscriptions</h2>
        <SaveStatus status={status} />
      </div>
      <p className="mt-1 text-[0.875rem] text-muted-foreground">
        Let readers get an email when you publish something new.
      </p>

      {error ? (
        <p className="mt-4 text-[0.8rem] text-destructive">{error}</p>
      ) : null}

      <div className="mt-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <label
            htmlFor="subscriptions-enabled"
            className="block text-[0.9rem] font-medium"
          >
            Offer a subscription on my blog
          </label>
          <p
            id="subscriptions-help"
            className="mt-1.5 max-w-prose text-[0.8rem] leading-relaxed text-muted-foreground"
          >
            Adds a sign-up form to your blog and the end of every post.
            Readers confirm by email before they are added, and every message
            carries an unsubscribe link.
          </p>
        </div>

        <Switch
          id="subscriptions-enabled"
          aria-describedby="subscriptions-help"
          checked={enabled}
          disabled={!site || status === "saving"}
          onCheckedChange={(next) => void toggle(next)}
          className="mt-0.5"
        />
      </div>

      {enabled ? (
        <div className="mt-5 rounded-xl bg-muted/50 p-4 ring-1 ring-border">
          <p className="text-[0.75rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            When you publish
          </p>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-muted-foreground">
            Your subscribers are emailed a short while after you press
            Publish, not immediately — so unpublishing straight away catches
            a mistake before anyone sees it. You can turn the email off for
            a particular post from the editor.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function SaveStatus({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null;

  return (
    <span
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-[0.85rem] text-brand"
    >
      {status === "saving" ? (
        <>
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          Saving
        </>
      ) : (
        <>
          <Check aria-hidden className="size-3.5" />
          Saved
        </>
      )}
    </span>
  );
}

/** Mirrors the initials circle the published profile panel draws. */
function previewInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";

  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";
  return (first + last).toUpperCase();
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
