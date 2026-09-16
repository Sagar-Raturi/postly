"use client";

import { ArrowUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type PostTab = "all" | "published" | "draft";
export type PostSort = "edited" | "published" | "title";

export const SORT_LABELS: Record<PostSort, string> = {
  edited: "Recently edited",
  published: "Recently published",
  title: "Title A–Z",
};

const TABS: { value: PostTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
];

/**
 * Filtering, sorting and search for the post list.
 *
 * All three are applied in the browser rather than round-tripped to the
 * API: the whole set is already loaded to render the cards, so filtering it
 * is a synchronous array operation and the list responds on the keystroke.
 */
export function PostToolbar({
  tab,
  onTabChange,
  counts,
  sort,
  onSortChange,
  query,
  onQueryChange,
}: {
  tab: PostTab;
  onTabChange: (tab: PostTab) => void;
  counts: Record<PostTab, number>;
  sort: PostSort;
  onSortChange: (sort: PostSort) => void;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Segmented control. `role="tablist"` would promise tab panels that
          do not exist here, so these are plain buttons with pressed state. */}
      <div className="flex items-center gap-0.5 rounded-full bg-muted p-1">
        {TABS.map(({ value, label }) => {
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onTabChange(value)}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "font-mono text-[0.68rem] tabular-nums",
                  active ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {counts[value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="relative w-full max-w-64 min-w-40">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search posts"
            aria-label="Search posts by title or content"
            // WebKit draws its own clear button inside a search input,
            // which would sit next to the one below it.
            className="h-9 rounded-full pr-8 pl-8 text-[0.85rem] [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full text-muted-foreground"
              onClick={() => onQueryChange("")}
            >
              <X aria-hidden />
            </Button>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                className="h-9 shrink-0 rounded-full px-3 text-[0.8rem] font-normal"
                // The label is hidden below `sm`, so the name has to come
                // from the attribute rather than from the visible text.
                aria-label={`Sort posts — currently ${SORT_LABELS[sort]}`}
              />
            }
          >
            <ArrowUpDown aria-hidden className="text-muted-foreground" />
            <span className="max-sm:hidden">{SORT_LABELS[sort]}</span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuRadioGroup
              value={sort}
              onValueChange={(value) => onSortChange(value as PostSort)}
            >
              {(Object.keys(SORT_LABELS) as PostSort[]).map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {SORT_LABELS[value]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
