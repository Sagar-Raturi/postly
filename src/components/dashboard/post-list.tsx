"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2, PenLine, SearchX, TriangleAlert } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/site/primitives";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { PostCard } from "@/components/dashboard/post-card";
import { SiteLinkChip } from "@/components/dashboard/site-link-chip";
import {
  PostToolbar,
  type PostSort,
  type PostTab,
} from "@/components/dashboard/post-toolbar";
import {
  ApiError,
  createPost,
  deletePost,
  getAllPosts,
  getCurrentSite,
  type PostListItem,
  type Site,
} from "@/lib/api";

/** Plain text of a post body, for the search box to match against. */
function searchableText(post: PostListItem): string {
  return `${post.title} ${post.content.replace(/<[^>]*>/g, " ")}`.toLowerCase();
}

function sortPosts(posts: PostListItem[], sort: PostSort): PostListItem[] {
  const sorted = [...posts];

  switch (sort) {
    case "title":
      return sorted.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );

    case "published":
      // Drafts have no published date. They sort to the bottom rather than
      // to 1970, which is where an epoch fallback would put them.
      return sorted.sort((a, b) => {
        if (!a.published_at && !b.published_at) {
          return b.updated_at.localeCompare(a.updated_at);
        }
        if (!a.published_at) return 1;
        if (!b.published_at) return -1;
        return b.published_at.localeCompare(a.published_at);
      });

    case "edited":
    default:
      return sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

export function PostList() {
  const router = useRouter();

  const [site, setSite] = React.useState<Site | null>(null);
  const [posts, setPosts] = React.useState<PostListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<PostTab>("all");
  const [sort, setSort] = React.useState<PostSort>("edited");
  const [query, setQuery] = React.useState("");

  // Which cards are open. A Set rather than a single id, so a writer can
  // have two posts open side by side to compare them.
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  const [creating, setCreating] = React.useState(false);
  const [duplicatingId, setDuplicatingId] = React.useState<number | null>(null);
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

      setPosts(await getAllPosts({ site: currentSite.id }));
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
    // Wrapped rather than called directly: `load` sets state, and the lint
    // rule (rightly) objects to a setState reachable synchronously from an
    // effect body.
    void (async () => {
      await load();
    })();
  }, [load]);

  const counts = React.useMemo(
    () => ({
      all: posts.length,
      published: posts.filter((p) => p.status === "published").length,
      draft: posts.filter((p) => p.status === "draft").length,
    }),
    [posts],
  );

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = posts.filter((post) => {
      if (tab !== "all" && post.status !== tab) return false;
      if (!needle) return true;
      return searchableText(post).includes(needle);
    });

    return sortPosts(filtered, sort);
  }, [posts, tab, sort, query]);

  function toggleExpanded(id: number) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

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

  async function handleDuplicate(post: PostListItem) {
    if (duplicatingId !== null) return;
    setDuplicatingId(post.id);
    try {
      // Always a draft, whatever the original was: a copy made by accident
      // must not appear on the live blog. The excerpt is left out so the
      // backend re-derives it from the body.
      const copy = await createPost({
        site: post.site,
        title: `${post.title} (copy)`,
        content: post.content,
        status: "draft",
      });
      // Placed at the top of the list rather than re-fetching: the copy is
      // the most recently edited post, which is where the default sort puts
      // it anyway.
      setPosts((current) => [copy, ...current]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Could not duplicate the post.",
      );
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deletePost(pendingDelete.id);
      setPosts((current) => current.filter((p) => p.id !== pendingDelete.id));
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(pendingDelete.id);
        return next;
      });
      setPendingDelete(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Could not delete the post.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const searching = query.trim().length > 0;

  return (
    <>
      <DashboardHeader />

      {/* The site link chip: directly under the top bar, above everything
          else, and nowhere else in the product. */}
      <div className="border-b border-border/70 bg-muted/30">
        <Container className="max-w-5xl">
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
        <Container className="max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl tracking-[-0.02em] sm:text-4xl">
                Posts
              </h1>
              <p className="mt-1.5 text-[0.9rem] text-muted-foreground">
                {loading
                  ? "Loading…"
                  : `${counts.all} ${counts.all === 1 ? "post" : "posts"} · ${counts.published} live`}
              </p>
            </div>

            <Button
              className="h-10 rounded-full px-4"
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

          {/* The toolbar is hidden while loading and on a blog with no posts:
              there is nothing to filter, and an empty state reads better
              without a row of controls above it. */}
          {!loading && site && posts.length > 0 ? (
            <div className="mt-8">
              <PostToolbar
                tab={tab}
                onTabChange={setTab}
                counts={counts}
                sort={sort}
                onSortChange={setSort}
                query={query}
                onQueryChange={setQuery}
              />
            </div>
          ) : null}

          <div className="mt-6">
            {loading ? (
              <LoadingCards />
            ) : !site ? (
              <NoSiteState />
            ) : posts.length === 0 ? (
              <EmptyState onCreate={handleCreate} creating={creating} />
            ) : visible.length === 0 ? (
              <NoMatchesState
                searching={searching}
                onClear={() => {
                  setQuery("");
                  setTab("all");
                }}
              />
            ) : (
              <div className="space-y-4">
                {visible.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    expanded={expanded.has(post.id)}
                    onToggle={() => toggleExpanded(post.id)}
                    onDuplicate={() => void handleDuplicate(post)}
                    onDelete={() => setPendingDelete(post)}
                    duplicating={duplicatingId === post.id}
                  />
                ))}
              </div>
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
              “{pendingDelete?.title}” will be permanently deleted
              {pendingDelete?.status === "published"
                ? " and will disappear from your live blog"
                : ""}
              . This cannot be undone.
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

/**
 * Skeleton cards, not a spinner: the shapes are the shapes that are coming,
 * so the page does not jump when the data lands.
 */
function LoadingCards() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-card px-6 py-6 ring-1 ring-foreground/10 sm:px-8 sm:py-7"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="mt-4 h-7 w-2/3" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/6" />
          </div>
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
    <div className="rounded-2xl bg-card px-6 py-20 text-center ring-1 ring-foreground/10">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <PenLine aria-hidden className="size-5" />
      </span>
      <h2 className="mt-5 font-display text-2xl">Nothing written yet</h2>
      <p className="mx-auto mt-2.5 max-w-sm text-[0.95rem] text-pretty text-muted-foreground">
        Your first post does not have to be good. It only has to exist. You can
        always come back and fix it.
      </p>
      <Button
        className="mt-7 h-10 rounded-full px-5"
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

/** There are posts, but none of them match the current filter or search. */
function NoMatchesState({
  searching,
  onClear,
}: {
  searching: boolean;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
      <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <SearchX aria-hidden className="size-4.5" />
      </span>
      <h2 className="mt-4 font-display text-xl">
        {searching ? "No posts match that" : "Nothing in here yet"}
      </h2>
      <Button
        variant="outline"
        size="sm"
        className="mt-5 rounded-full"
        onClick={onClear}
      >
        Show all posts
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
    <div className="rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/10">
      <h2 className="font-display text-xl">Setting things up</h2>
      <p className="mx-auto mt-2 max-w-md text-[0.9rem] text-pretty text-muted-foreground">
        Taking you to name your blog…
      </p>
    </div>
  );
}
