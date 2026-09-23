"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FilePlus2,
  FileText,
  Loader2,
  PenLine,
  Settings,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { AccountMenu } from "@/components/dashboard/account-menu";
import { initials } from "@/lib/initials";
import { cn } from "@/lib/utils";
import {
  createPost,
  getCurrentSite,
  getPosts,
  getSubscriberStats,
  type Site,
} from "@/lib/api";

/**
 * The dashboard's primary navigation: a column on the left from `lg` up, a
 * bar with a scrolling row of pills below it.
 *
 * Every screen in the dashboard used to render its own top bar and find its
 * siblings through the account dropdown, which put Subscribers and Settings
 * two clicks and one guess away. This is the one place that answers "where
 * am I and where else can I go", so it is mounted by the dashboard layout
 * and the screens below it render only their own content.
 *
 * ## Why it fetches its own counts
 *
 * The numbers beside Posts, Drafts and Subscribers come from three small
 * requests made here rather than from whichever screen happens to be open:
 * the nav is visible on all of them, including the editor, which has no
 * reason to know how many subscribers a blog has. `posts_count` rides along
 * on the site itself, so only drafts and subscribers cost a request, and
 * both are counts rather than lists.
 *
 * They are refetched when the route changes, which is when they are most
 * likely to have gone stale — publishing a post and returning to the list
 * is the common case.
 */

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  /** Shown right-aligned: a count, or the word "Soon". */
  meta?: string;
  /** No destination yet. Rendered, but inert and marked as such. */
  soon?: boolean;
};

export function DashboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [site, setSite] = React.useState<Site | null>(null);
  const [drafts, setDrafts] = React.useState<number | null>(null);
  const [subscribers, setSubscribers] = React.useState<number | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const current = await getCurrentSite();
        if (cancelled) return;
        setSite(current);

        // Counts are decoration on a nav that has to render either way, so
        // a failure here leaves them absent rather than breaking the only
        // way out of the current screen.
        const [draftPage, stats] = await Promise.all([
          getPosts({ status: "draft" }),
          getSubscriberStats(),
        ]);
        if (cancelled) return;
        setDrafts(draftPage.count);
        setSubscribers(stats.active);
      } catch {
        if (!cancelled) {
          setDrafts(null);
          setSubscribers(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleCreate() {
    if (!site || creating) return;
    setCreating(true);
    try {
      // The API requires a title, so a new post starts with a placeholder
      // the writer overwrites in the editor.
      const post = await createPost({ site: site.id, title: "Untitled post" });
      router.push(`/dashboard/posts/${post.id}`);
    } catch {
      setCreating(false);
    }
  }

  const tab = searchParams.get("tab");
  const onPosts = pathname === "/dashboard";

  const items: NavItem[] = [
    {
      label: "Posts",
      icon: FileText,
      href: "/dashboard",
      meta: site ? String(site.posts_count) : undefined,
    },
    {
      label: "Drafts",
      icon: PenLine,
      href: "/dashboard?tab=draft",
      meta: drafts === null ? undefined : String(drafts),
    },
    {
      label: "Subscribers",
      icon: Users,
      href: "/dashboard/subscribers",
      meta: subscribers === null ? undefined : String(subscribers),
    },
    { label: "Analytics", icon: ChartNoAxesColumn, meta: "Soon", soon: true },
    { label: "Settings", icon: Settings, href: "/dashboard/settings" },
  ];

  /**
   * Posts and Drafts share a path and differ only by query, so the active
   * item cannot be decided by pathname alone: on `/dashboard?tab=draft`
   * both would match, and `startsWith` would light up Posts on every
   * screen underneath it.
   */
  function isActive(item: NavItem): boolean {
    if (!item.href) return false;
    if (item.href === "/dashboard") return onPosts && tab !== "draft";
    if (item.href === "/dashboard?tab=draft") return onPosts && tab === "draft";
    return pathname.startsWith(item.href);
  }

  return (
    <>
      {/* --- The column, from lg up ------------------------------------ */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-border/70 bg-muted/40 lg:flex">
        <div className="p-3">
          <SiteBlock site={site} />
        </div>

        <nav aria-label="Dashboard" className="flex flex-col gap-0.5 px-3">
          {items.map((item) => (
            <NavRow key={item.label} item={item} active={isActive(item)} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 p-3">
          <Button
            className="h-9 w-full rounded-lg"
            onClick={handleCreate}
            disabled={!site || creating}
          >
            {creating ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <FilePlus2 aria-hidden />
            )}
            New post
          </Button>

          <div className="flex items-center justify-between gap-1 border-t border-border/70 pt-3">
            <AccountMenu />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* --- The bar, below lg ----------------------------------------- */}
      <div className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <div className="min-w-0 flex-1">
            <SiteBlock site={site} />
          </div>
          <Button
            size="sm"
            className="h-9 shrink-0 rounded-lg"
            onClick={handleCreate}
            disabled={!site || creating}
          >
            {creating ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <FilePlus2 aria-hidden />
            )}
            <span className="max-sm:sr-only">New post</span>
          </Button>
          <ThemeToggle />
          <AccountMenu />
        </div>

        {/*
          Horizontally scrollable rather than wrapped to a second line: the
          five items do not fit across a phone, and a nav that changes
          height as the labels rewrap moves the content under it.
        */}
        <nav
          aria-label="Dashboard"
          className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <NavPill key={item.label} item={item} active={isActive(item)} />
          ))}
        </nav>
      </div>
    </>
  );
}

/** One row in the column. */
function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const { label, icon: Icon, href, meta, soon } = item;

  const content = (
    <>
      <Icon aria-hidden className="size-4 shrink-0 opacity-70" />
      <span className="flex-1 truncate text-left">{label}</span>
      {meta ? (
        <span
          className={cn(
            "font-mono text-[0.65rem] tabular-nums",
            soon ? "text-muted-foreground/60" : "text-muted-foreground/80",
          )}
        >
          {meta}
        </span>
      ) : null}
    </>
  );

  const shared =
    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem] transition-colors";

  if (soon || !href) {
    return (
      <span
        aria-disabled
        title={`${label} — not available yet`}
        className={cn(shared, "cursor-default text-muted-foreground/50")}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        shared,
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-foreground/[0.07] font-medium text-foreground"
          : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      {content}
    </Link>
  );
}

/** One pill in the scrolling row. */
function NavPill({ item, active }: { item: NavItem; active: boolean }) {
  const { label, icon: Icon, href, meta, soon } = item;

  const shared =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] whitespace-nowrap transition-colors";

  const content = (
    <>
      <Icon aria-hidden className="size-3.5 opacity-70" />
      {label}
      {meta ? (
        <span className="font-mono text-[0.65rem] tabular-nums opacity-70">
          {meta}
        </span>
      ) : null}
    </>
  );

  if (soon || !href) {
    return (
      <span
        aria-disabled
        className={cn(shared, "text-muted-foreground/50")}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        shared,
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {content}
    </Link>
  );
}

/**
 * The blog this dashboard belongs to, and the two things a writer wants
 * from its address: to open it, and to copy it.
 *
 * `site.domain` is what a blog will be served from once it moves to its own
 * subdomain (`nina.postly.com`); `/<slug>` is what resolves today. The menu
 * therefore shows the first and links to the second — copying the domain
 * would hand somebody a URL that does not open yet.
 */
function SiteBlock({ site }: { site: Site | null }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!site) {
    return (
      <div className="flex items-center gap-2 p-1.5">
        <Skeleton className="size-7 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      </div>
    );
  }

  const href = `/${site.slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        new URL(href, window.location.origin).toString(),
      );
      setCopied(true);
    } catch {
      // Refused on an insecure origin or a locked-down browser. Nothing was
      // copied, so the menu must not claim it was.
      setCopied(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`${site.name} — blog address and links`}
            className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        }
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/15 font-display text-[0.7rem] font-semibold text-brand">
          {initials(site.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8rem] font-medium">
            {site.name}
          </span>
          <span className="block truncate font-mono text-[0.6rem] text-muted-foreground">
            {site.domain}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground/60"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem render={<Link href={href} target="_blank" />}>
          <ExternalLink aria-hidden />
          View live blog
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={(event) => {
            // The menu would otherwise close before the clipboard write
            // resolves, taking the "Copied" confirmation with it.
            event.preventDefault();
            void handleCopy();
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
