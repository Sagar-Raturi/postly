"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  ArrowLeft,
  Check,
  CloudAlert,
  Globe,
  Loader2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/site/primitives";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EditorToolbar } from "@/components/dashboard/editor-toolbar";
import { StatusBadge } from "@/components/dashboard/post-card";
import {
  ApiError,
  getPost,
  updatePost,
  type Post,
  type PostStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const AUTOSAVE_DELAY_MS = 2000;

type SaveState = "idle" | "saving" | "saved" | "error";

/** The parts of a post the editor owns; compared to decide if a save is due. */
type Draft = { title: string; content: string };

export function PostEditor({ postId }: { postId: number }) {
  const router = useRouter();

  const [post, setPost] = React.useState<Post | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // `draft` is what the writer sees; `persisted` is what the server last
  // confirmed. Any difference between them means a save is owed.
  const [draft, setDraft] = React.useState<Draft>({ title: "", content: "" });
  const [persisted, setPersisted] = React.useState<Draft>({
    title: "",
    content: "",
  });
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [publishing, setPublishing] = React.useState(false);

  const isDirty =
    post !== null &&
    (draft.title !== persisted.title || draft.content !== persisted.content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer nofollow" },
        },
      }),
      Image.configure({ HTMLAttributes: { class: "rounded-lg" } }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    editorProps: {
      attributes: {
        class: "outline-none min-h-[50vh]",
      },
    },
    onUpdate: ({ editor: instance }) => {
      setDraft((current) => ({ ...current, content: instance.getHTML() }));
    },
    // Required under the App Router: rendering on the server would not match
    // the client's first paint.
    immediatelyRender: false,
  });

  /* -------------------------------------------------- load */

  // Fetching is keyed on the post alone. `editor` starts out null and becomes
  // an instance a tick later, so depending on it here would fetch twice and
  // could overwrite anything typed in between.
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loaded = await getPost(postId);
        if (cancelled) return;

        setPost(loaded);
        setDraft({ title: loaded.title, content: loaded.content });
        setPersisted({ title: loaded.title, content: loaded.content });
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? "That post no longer exists."
            : err instanceof ApiError
              ? err.detail
              : "Could not load the post.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  // Push the body into TipTap once, as soon as both the editor and the post
  // exist. The ref stops a later re-render from resetting the writer's work.
  const hydratedPostId = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!editor || !post || hydratedPostId.current === post.id) return;
    editor.commands.setContent(post.content || "", { emitUpdate: false });
    hydratedPostId.current = post.id;
  }, [editor, post]);

  /* -------------------------------------------------- autosave */

  const save = React.useCallback(
    async (next: Draft) => {
      setSaveState("saving");
      try {
        await updatePost(postId, next);
        setPersisted(next);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [postId],
  );

  React.useEffect(() => {
    if (!isDirty) return;

    // Each keystroke replaces the pending timer, so the request only goes out
    // once typing actually stops.
    const timer = setTimeout(() => void save(draft), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, isDirty, save]);

  // A tab close mid-edit would otherwise silently drop the last few seconds.
  React.useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  /* -------------------------------------------------- publish */

  async function togglePublish() {
    if (!post || publishing) return;
    const nextStatus: PostStatus =
      post.status === "published" ? "draft" : "published";

    setPublishing(true);
    try {
      // Flush any pending edits in the same request so publishing never
      // captures a stale body.
      const updated = await updatePost(postId, { ...draft, status: nextStatus });
      setPost(updated);
      setPersisted({ title: updated.title, content: updated.content });
      setSaveState("saved");
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.detail : "Could not change the status.",
      );
    } finally {
      setPublishing(false);
    }
  }

  /* -------------------------------------------------- render */

  if (loadError) {
    return (
      <>
        <DashboardHeader />
        <main className="flex flex-1 items-center justify-center py-20">
          <div className="text-center">
            <h1 className="font-display text-2xl">{loadError}</h1>
            <Button
              variant="outline"
              className="mt-6 rounded-full"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft aria-hidden />
              Back to posts
            </Button>
          </div>
        </main>
      </>
    );
  }

  const published = post?.status === "published";

  return (
    <>
      <DashboardHeader
        actions={
          <div className="flex items-center gap-2">
            <SaveIndicator state={saveState} dirty={isDirty} />
            <Button
              variant={published ? "outline" : "default"}
              className="h-9 rounded-full px-4 text-[0.85rem]"
              disabled={!post || publishing}
              onClick={togglePublish}
            >
              {publishing ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : published ? (
                <Undo2 aria-hidden />
              ) : (
                <Globe aria-hidden />
              )}
              {published ? "Unpublish" : "Publish"}
            </Button>
          </div>
        }
      />

      <main className="flex-1 pb-32">
        <Container className="max-w-3xl">
          <div className="flex items-center justify-between gap-4 py-5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft aria-hidden className="size-4" />
              All posts
            </Link>
            {post ? <StatusBadge status={post.status} /> : null}
          </div>

          {!post ? (
            <div className="space-y-4 pt-6">
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <>
              <EditorToolbar editor={editor} />

              {/* Deliberately a textarea, not an input: long titles should wrap
                  onto a second line rather than scroll sideways. */}
              <TitleInput
                value={draft.title}
                onChange={(title) =>
                  setDraft((current) => ({ ...current, title }))
                }
                onEnter={() => editor?.commands.focus("start")}
              />

              <EditorContent
                editor={editor}
                className={cn(
                  "prose-postly mt-6 font-display text-[1.0625rem] leading-[1.8]",
                  "[&_.ProseMirror]:min-h-[50vh] [&_.ProseMirror]:outline-none",
                )}
              />
            </>
          )}
        </Container>
      </main>
    </>
  );
}

function TitleInput({
  value,
  onChange,
  onEnter,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // Grow to fit the content instead of showing a scrollbar.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder="Untitled"
      aria-label="Post title"
      spellCheck
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onEnter();
        }
      }}
      className="mt-8 w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-display text-4xl leading-[1.15] tracking-[-0.02em] outline-none placeholder:text-muted-foreground/40 sm:text-5xl"
    />
  );
}

function SaveIndicator({
  state,
  dirty,
}: {
  state: SaveState;
  dirty: boolean;
}) {
  let label = "";
  let icon: React.ReactNode = null;

  if (state === "saving") {
    label = "Saving…";
    icon = <Loader2 aria-hidden className="size-3 animate-spin" />;
  } else if (state === "error") {
    label = "Save failed";
    icon = <CloudAlert aria-hidden className="size-3" />;
  } else if (dirty) {
    label = "Unsaved";
  } else if (state === "saved") {
    label = "Saved";
    icon = <Check aria-hidden className="size-3" />;
  }

  return (
    <span
      // Announce politely so a screen reader hears "Saved" without the
      // indicator stealing focus mid-sentence.
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-[0.75rem] transition-opacity duration-300 max-sm:hidden",
        label ? "opacity-100" : "opacity-0",
        state === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {icon}
      {label || " "}
    </span>
  );
}
