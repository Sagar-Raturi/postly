"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Copy, Loader2, PenLine, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PostListItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export function StatusBadge({ status }: { status: PostListItem["status"] }) {
  const published = status === "published";
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 shrink-0 gap-1.5 px-2 text-[0.65rem] font-medium",
        published
          ? "border-brand/30 bg-brand/10 text-brand"
          : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          published ? "bg-brand" : "bg-muted-foreground/50",
        )}
      />
      {published ? "Published" : "Draft"}
    </Badge>
  );
}

/** "12 January 2026" — for a published date, which is a fixed point. */
function formatPublished(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * "4 minutes ago", "3 days ago" — for a draft's last edit, which the writer
 * thinks about as a distance from now rather than as a date.
 */
function formatRelative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  return `on ${formatPublished(iso)}`;
}

/**
 * One post, as a card the writer can read rather than a row they can count.
 *
 * The card carries enough to recognise a post without opening it — title,
 * state, when, how long it takes to read, and the opening of the actual
 * prose — and expands in place to the whole thing. Expanding is not
 * navigation: a writer skimming eight posts to find the one they half
 * remember should not have to load and leave eight pages.
 */
export function PostCard({
  post,
  expanded,
  onToggle,
  onDuplicate,
  onDelete,
  duplicating,
}: {
  post: PostListItem;
  expanded: boolean;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicating: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const bodyId = `post-body-${post.id}`;

  const published = post.status === "published";
  const when =
    published && post.published_at
      ? formatPublished(post.published_at)
      : `Last edited ${formatRelative(post.updated_at)}`;

  return (
    <article
      className={cn(
        "group relative rounded-2xl bg-card ring-1 ring-foreground/10 transition-shadow",
        expanded ? "shadow-lift" : "hover:shadow-soft",
      )}
    >
      {/*
        The whole header is the expand control, so the large obvious target
        does the common thing. It is a real <button> rather than a div with
        a handler, so it is reachable by keyboard and announces its state.
      */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        // Without this the accessible name is the badge, the date, the read
        // time, the title and the excerpt read out as one sentence.
        aria-label={`${expanded ? "Collapse" : "Expand"} “${post.title}”`}
        className="w-full cursor-pointer rounded-2xl px-6 py-6 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-8 sm:py-7"
      >
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusBadge status={post.status} />
              <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                {when}
              </span>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
                {post.read_time_minutes} min read
              </span>
            </div>

            <h2 className="mt-3 font-display text-[1.5rem] leading-[1.2] tracking-[-0.02em] text-pretty sm:text-[1.75rem]">
              {post.title}
            </h2>

            {/* Two to three lines of the real body, so a post is
                recognisable by what it says, not only by its title. */}
            {post.excerpt ? (
              <p className="mt-2.5 line-clamp-3 text-[0.95rem] leading-[1.65] text-pretty text-muted-foreground">
                {post.excerpt}
              </p>
            ) : (
              <p className="mt-2.5 text-[0.95rem] text-muted-foreground/70 italic">
                Nothing written yet.
              </p>
            )}
          </div>

          <span
            aria-hidden
            className={cn(
              "mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all",
              "group-hover:bg-muted group-hover:text-foreground",
              expanded && "rotate-180 bg-muted text-foreground",
            )}
          >
            <ChevronDown className="size-4" />
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={bodyId}
            key="body"
            // `height: auto` is animatable by framer-motion, which measures
            // the content — so this works for a 200-word post and a
            // 900-word one without either being clipped or padded.
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{
              height: { duration: reduceMotion ? 0 : 0.34, ease: EASE },
              opacity: { duration: reduceMotion ? 0 : 0.22 },
            }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-7 sm:px-8 sm:pb-8">
              <hr className="mb-7 border-border" />
              {/*
                The stored HTML, rendered with the same prose styles the
                published post uses — headings, quotes, lists and links all
                styled, so the writer is reading their post and not their
                markup. This is their own content in their own dashboard.
              */}
              <div
                className="prose prose-postly max-w-none text-[1.0625rem] leading-[1.75]"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/*
        Row actions. Outside the expand button, because a button cannot
        contain other buttons. Always present for keyboard and touch; only
        fading in on hover for the mouse, so a list of eight cards is not
        also a list of twenty-four buttons.
      */}
      <div className="absolute top-5 right-5 flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100 sm:top-6 sm:right-16">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit “${post.title}”`}
          title="Edit"
          className="text-muted-foreground hover:text-foreground"
          // base-ui needs telling that this renders as an anchor, not a
          // <button> — otherwise it warns and keeps button semantics on a link.
          nativeButton={false}
          render={<Link href={`/dashboard/posts/${post.id}`} />}
        >
          <PenLine aria-hidden />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Duplicate “${post.title}”`}
          title="Duplicate"
          disabled={duplicating}
          className="text-muted-foreground hover:text-foreground"
          onClick={onDuplicate}
        >
          {duplicating ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : (
            <Copy aria-hidden />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete “${post.title}”`}
          title="Delete"
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </article>
  );
}
