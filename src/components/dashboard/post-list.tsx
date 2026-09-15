"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2, PenLine, Trash2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/site/primitives";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  ApiError,
  createPost,
  deletePost,
  getCurrentSite,
  getPosts,
  type PostListItem,
  type Site,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function formatEdited(iso: string): string {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / (60 * 24))}d ago`;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

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

export function PostList() {
  const router = useRouter();

  const [site, setSite] = React.useState<Site | null>(null);
  const [posts, setPosts] = React.useState<PostListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<PostListItem | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const currentSite = await getCurrentSite();
      // Cleared here rather than up front, so a failed retry keeps the
      // previous message on screen instead of blanking it briefly.
      setError(null);
      setSite(currentSite);

      if (!currentSite) {
        // Signed in, but never finished onboarding — there is nothing to
        // show until they have a blog.
        setPosts([]);
        router.replace("/onboarding");
        return;
      }
      const { results } = await getPosts({ site: currentSite.id });
      setPosts(results);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : "Something went wrong loading your posts.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  React.useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleCreate() {
    if (!site || creating) return;
    setCreating(true);
    try {
      // The API requires a title, so a new post starts with a placeholder the
      // writer immediately overwrites in the editor.
      const post = await createPost({ site: site.id, title: "Untitled post" });
      router.push(`/dashboard/posts/${post.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Could not create the post.",
      );
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deletePost(pendingDelete.id);
      setPosts((current) => current.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Could not delete the post.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const newPostButton = (
    <Button
      className="h-9 rounded-full px-4 text-[0.85rem]"
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
  );

  return (
    <>
      <DashboardHeader
        siteName={site?.name}
        siteDomain={site?.domain}
        actions={newPostButton}
      />

      <main className="flex-1 py-10 sm:py-14">
        <Container className="max-w-5xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl tracking-[-0.02em] sm:text-4xl">
                Posts
              </h1>
              <p className="mt-1.5 text-[0.9rem] text-muted-foreground">
                {loading
                  ? "Loading…"
                  : `${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-destructive/5 p-4 ring-1 ring-destructive/20">
              <TriangleAlert
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[0.88rem] font-medium text-destructive">
                  {error}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-full"
                  onClick={() => {
                    setLoading(true);
                    void load();
                  }}
                >
                  Try again
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-8">
            {loading ? (
              <LoadingRows />
            ) : !site ? (
              <NoSiteState />
            ) : posts.length === 0 ? (
              <EmptyState onCreate={handleCreate} creating={creating} />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                {posts.map((post) => (
                  <li key={post.id} className="group relative">
                    <Link
                      href={`/dashboard/posts/${post.id}`}
                      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[1.05rem] leading-snug">
                          {post.title}
                        </span>
                        {post.excerpt ? (
                          <span className="mt-0.5 block truncate text-[0.82rem] text-muted-foreground">
                            {post.excerpt}
                          </span>
                        ) : null}
                      </span>

                      <StatusBadge status={post.status} />

                      <span className="w-20 shrink-0 text-right font-mono text-[0.7rem] text-muted-foreground max-sm:hidden">
                        {formatEdited(post.updated_at)}
                      </span>

                      {/* Spacer so the row text never sits under the delete button. */}
                      <span aria-hidden className="w-8 shrink-0" />
                    </Link>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete “${post.title}”`}
                      className="absolute top-1/2 right-4 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                      onClick={() => setPendingDelete(post)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Container>
      </main>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” will be permanently deleted. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : null}
              Delete post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function LoadingRows() {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  onCreate,
  creating,
}: {
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <div className="rounded-xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <PenLine aria-hidden className="size-5" />
      </span>
      <h2 className="mt-5 font-display text-xl">Nothing written yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-[0.9rem] text-pretty text-muted-foreground">
        Your first post does not have to be good. It only has to exist. You can
        always come back and fix it.
      </p>
      <Button
        className="mt-6 h-10 rounded-full px-5"
        onClick={onCreate}
        disabled={creating}
      >
        {creating ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <FilePlus2 aria-hidden />
        )}
        Write your first post
      </Button>
    </div>
  );
}

/**
 * Briefly visible while load() redirects an account that has no blog yet
 * to /onboarding.
 */
function NoSiteState() {
  return (
    <div className="rounded-xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
      <h2 className="font-display text-xl">Setting things up</h2>
      <p className="mx-auto mt-2 max-w-md text-[0.9rem] text-pretty text-muted-foreground">
        Taking you to name your blog…
      </p>
    </div>
  );
}
