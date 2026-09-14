import * as React from "react";
import {
  Bold,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  FileText,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  Mail,
  Minus,
  PenLine,
  Quote,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

function ToolbarIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-5 items-center justify-center rounded text-muted-foreground/80 [&_svg]:size-3">
      {children}
    </span>
  );
}

function Caret() {
  return (
    <span
      aria-hidden
      className="ml-px inline-block h-[0.95em] w-px translate-y-[0.15em] bg-brand motion-safe:animate-pulse"
    />
  );
}

/* ------------------------------------------------------------------ *
 * The editor with the author sidebar — used in the hero
 * ------------------------------------------------------------------ */

const SIDEBAR_NAV = [
  { label: "Posts", icon: FileText, active: true, meta: "12" },
  { label: "Drafts", icon: PenLine, meta: "3" },
  { label: "Subscribers", icon: Users, meta: "1,942" },
  { label: "Analytics", icon: ChartNoAxesColumn },
  { label: "Settings", icon: Settings },
];

export function EditorScreen({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-[340px] sm:min-h-[420px]", className)}>
      <aside className="hidden w-44 shrink-0 flex-col border-r border-border/70 bg-muted/40 p-3 sm:flex">
        <div className="flex items-center gap-2 rounded-lg p-1.5">
          <span className="flex size-6 items-center justify-center rounded-full bg-brand/15 font-display text-[0.7rem] font-semibold text-brand">
            N
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.7rem] font-medium">
              Small Hours
            </span>
            <span className="block truncate font-mono text-[0.55rem] text-muted-foreground">
              nina.postly.com
            </span>
          </span>
          <ChevronDown aria-hidden className="size-3 text-muted-foreground/60" />
        </div>

        <nav className="mt-4 flex flex-col gap-0.5">
          {SIDEBAR_NAV.map(({ label, icon: Icon, active, meta }) => (
            <span
              key={label}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.7rem]",
                active
                  ? "bg-foreground/[0.06] font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon aria-hidden className="size-3.5 shrink-0 opacity-70" />
              <span className="flex-1 truncate">{label}</span>
              {meta ? (
                <span className="font-mono text-[0.55rem] text-muted-foreground/70">
                  {meta}
                </span>
              ) : null}
            </span>
          ))}
        </nav>

        <span className="mt-auto flex h-7 items-center justify-center rounded-md bg-foreground text-[0.7rem] font-medium text-background">
          New post
        </span>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 items-center gap-1 border-b border-border/70 px-3">
          <span className="hidden font-mono text-[0.6rem] text-muted-foreground/70 sm:inline">
            Drafts /
          </span>
          <div className="ml-1 flex items-center gap-0.5">
            <ToolbarIcon>
              <Bold />
            </ToolbarIcon>
            <ToolbarIcon>
              <Italic />
            </ToolbarIcon>
            <ToolbarIcon>
              <Heading2 />
            </ToolbarIcon>
            <ToolbarIcon>
              <Quote />
            </ToolbarIcon>
            <ToolbarIcon>
              <Link2 />
            </ToolbarIcon>
            <ToolbarIcon>
              <ImageIcon />
            </ToolbarIcon>
            <ToolbarIcon>
              <Minus />
            </ToolbarIcon>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[0.6rem] text-muted-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-brand" />
              Saved
            </span>
            <span className="flex h-6 items-center rounded-md bg-brand px-2.5 text-[0.65rem] font-medium text-brand-foreground">
              Publish
            </span>
          </div>
        </div>

        <div className="flex-1 px-5 py-6 sm:px-9 sm:py-8">
          <div className="mx-auto max-w-[34rem]">
            <p className="font-mono text-[0.6rem] tracking-wide text-muted-foreground/70 uppercase">
              Draft &middot; Nina Alvarez
            </p>
            <h3 className="mt-2 font-display text-xl leading-tight tracking-[-0.01em] sm:text-2xl">
              Writing in public, badly
            </h3>
            <div className="mt-4 space-y-3 font-display text-[0.8rem] leading-[1.75] text-foreground/85">
              <p>
                I used to think the hard part was having something to say. It
                isn&rsquo;t. The hard part is the forty minutes between deciding
                to write and actually writing &mdash; the tab-switching, the
                theme-fiddling, the low hum of a tool asking to be configured.
              </p>
              <p className="border-l-2 border-brand/50 pl-3 text-foreground/70 italic">
                A blog is a place to think out loud on a schedule you set
                yourself.
              </p>
              <p>
                So I stopped improving the setup. One page, one cursor, one
                button that says publish
                <Caret />
              </p>
            </div>
          </div>
        </div>

        <div className="flex h-8 items-center justify-between border-t border-border/70 px-3 font-mono text-[0.6rem] text-muted-foreground/80">
          <span>1,284 words &middot; 5 min read</span>
          <span className="hidden sm:inline">Autosaved 2 seconds ago</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Step 1 — claim a name
 * ------------------------------------------------------------------ */

export function ClaimNameScreen({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[300px] items-center justify-center bg-muted/40 px-5 py-8",
        className,
      )}
    >
      <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-soft ring-1 ring-foreground/[0.07]">
        <h3 className="font-display text-lg leading-tight">Create your blog</h3>
        <p className="mt-1 text-[0.7rem] text-muted-foreground">
          You can change any of this later.
        </p>

        <div className="mt-5 space-y-3.5">
          <div className="space-y-1.5">
            <span className="block text-[0.65rem] font-medium text-muted-foreground">
              Blog name
            </span>
            <div className="flex h-8 items-center rounded-lg bg-background px-2.5 text-[0.75rem] ring-1 ring-foreground/[0.09]">
              Small Hours
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[0.65rem] font-medium text-muted-foreground">
              Your address
            </span>
            <div className="flex h-8 items-center rounded-lg bg-background px-2.5 font-mono text-[0.72rem] ring-1 ring-brand/50">
              <span>nina</span>
              <span className="text-muted-foreground">.postly.com</span>
              <span className="ml-auto flex items-center gap-1 font-sans text-[0.62rem] font-medium text-brand">
                <Check aria-hidden className="size-3" />
                Available
              </span>
            </div>
          </div>
        </div>

        <span className="mt-5 flex h-8 items-center justify-center rounded-lg bg-foreground text-[0.75rem] font-medium text-background">
          Create blog
        </span>
        <p className="mt-3 text-center text-[0.62rem] text-muted-foreground">
          Free forever. No card, no trial timer.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Step 2 — the editor in focus mode, slash menu open
 * ------------------------------------------------------------------ */

const SLASH_ITEMS = [
  { label: "Image", hint: "Drag in or paste", icon: ImageIcon, active: true },
  { label: "Quote", hint: "Pull a line out", icon: Quote },
  { label: "Divider", hint: "Break the section", icon: Minus },
  { label: "Email-only block", hint: "Subscribers only", icon: Mail },
];

export function FocusEditorScreen({ className }: { className?: string }) {
  return (
    <div className={cn("relative min-h-[300px] px-6 py-7 sm:px-10", className)}>
      <div className="mx-auto max-w-[30rem]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.6rem] tracking-wide text-muted-foreground/70 uppercase">
            Focus mode
          </span>
          <span className="font-mono text-[0.6rem] text-muted-foreground/70">
            412 words
          </span>
        </div>

        <h3 className="mt-3 font-display text-xl leading-tight tracking-[-0.01em]">
          The year I stopped reading the news
        </h3>

        <div className="mt-4 space-y-3 font-display text-[0.8rem] leading-[1.75] text-foreground/85">
          <p>
            In January I cancelled every alert on my phone and replaced them
            with a single rule: if something matters, I&rsquo;ll hear about it
            twice.
          </p>
          <p>
            What I got back wasn&rsquo;t time, exactly. It was the particular
            kind of attention that lets a sentence finish itself.
          </p>
          <p className="text-muted-foreground">
            /<Caret />
          </p>
        </div>

        <div className="mt-1 w-56 overflow-hidden rounded-lg bg-popover p-1 shadow-lift ring-1 ring-foreground/10">
          {SLASH_ITEMS.map(({ label, hint, icon: Icon, active }) => (
            <span
              key={label}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5",
                active && "bg-foreground/[0.06]",
              )}
            >
              <Icon
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <span className="text-[0.68rem] font-medium">{label}</span>
              <span className="ml-auto text-[0.58rem] text-muted-foreground/70">
                {hint}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Step 3 — the published blog
 * ------------------------------------------------------------------ */

export function PublishedBlogScreen({ className }: { className?: string }) {
  return (
    <div className={cn("min-h-[300px] px-6 py-8 sm:px-10", className)}>
      <div className="mx-auto max-w-[32rem]">
        <header className="text-center">
          <h3 className="font-display text-lg tracking-[-0.01em]">
            Small Hours
          </h3>
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Essays about attention, mostly.
          </p>
          <nav className="mt-3 flex items-center justify-center gap-4 text-[0.62rem] text-muted-foreground">
            <span>Archive</span>
            <span>About</span>
            <span className="text-brand">Subscribe</span>
          </nav>
        </header>

        <div className="my-6 h-px bg-border" />

        <article>
          <p className="font-mono text-[0.6rem] tracking-wide text-muted-foreground/70 uppercase">
            4 March 2026
          </p>
          <h4 className="mt-1.5 font-display text-lg leading-snug">
            Writing in public, badly
          </h4>
          <div className="mt-3 space-y-2.5 font-display text-[0.78rem] leading-[1.75] text-foreground/80">
            <p>
              I used to think the hard part was having something to say. It
              isn&rsquo;t. The hard part is the forty minutes between deciding
              to write and actually writing.
            </p>
            <p>
              So I stopped improving the setup. One page, one cursor, one button
              that says publish.
            </p>
          </div>
        </article>

        <div className="mt-6 rounded-xl bg-muted/60 p-4 text-center ring-1 ring-foreground/[0.05]">
          <p className="font-display text-[0.85rem]">Get new essays by email.</p>
          <div className="mt-2.5 flex items-center gap-1.5">
            <span className="flex h-7 flex-1 items-center rounded-md bg-background px-2 text-[0.65rem] text-muted-foreground/70 ring-1 ring-foreground/[0.08]">
              you@example.com
            </span>
            <span className="flex h-7 items-center rounded-md bg-foreground px-2.5 text-[0.65rem] font-medium text-background">
              Subscribe
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Small preview used in the examples gallery
 * ------------------------------------------------------------------ */

export function BlogPreviewScreen({
  title,
  tagline,
  headline,
  excerpt,
  accent,
}: {
  title: string;
  tagline: string;
  headline: string;
  excerpt: string;
  accent: string;
}) {
  return (
    <div className="flex h-44 flex-col px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-display text-[0.8rem] tracking-[-0.01em]">
          {title}
        </span>
        <span className="shrink-0 text-[0.5rem] text-muted-foreground">
          Archive &middot; About
        </span>
      </div>
      <span className="mt-0.5 truncate text-[0.55rem] text-muted-foreground">
        {tagline}
      </span>

      <span
        aria-hidden
        className="mt-2.5 h-9 w-full rounded-md"
        style={{
          background: `linear-gradient(115deg, ${accent} 0%, transparent 130%)`,
        }}
      />

      <p className="mt-2.5 font-display text-[0.68rem] leading-snug font-medium">
        {headline}
      </p>
      <p className="mt-1 line-clamp-2 font-display text-[0.6rem] leading-relaxed text-muted-foreground">
        {excerpt}
      </p>

      <div className="mt-auto flex items-center gap-1.5 pt-2">
        <span className="h-1 w-8 rounded-full bg-foreground/10" />
        <span className="h-1 w-5 rounded-full bg-foreground/10" />
        <span className="ml-auto text-[0.5rem] text-muted-foreground/70">
          3 min read
        </span>
      </div>
    </div>
  );
}
