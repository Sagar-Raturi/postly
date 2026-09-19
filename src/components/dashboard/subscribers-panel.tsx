"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/site/primitives";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  ApiError,
  getSubscriberStats,
  getSubscribers,
  subscriberExportUrl,
  type Subscriber,
  type SubscriberStats,
  type SubscriberStatus,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Who is on the blog's mailing list.
 *
 * ## Why this is numbers and a table rather than a chart
 *
 * Five counts and a list of addresses is not data with a shape. A bar
 * chart of five statuses would be five labelled numbers drawn as
 * rectangles, which is strictly less legible than five labelled numbers,
 * and a trend line would need history nothing records. So: one figure the
 * page leads with, a row of counts under it, and the rows themselves.
 *
 * ## The one number
 *
 * "Active" is confirmed subscribers, and it is bigger than everything else
 * because it is the only number that answers the question a writer
 * actually has — how many people will get the next post. The rest are
 * context for it. `total` is deliberately not the headline: a list whose
 * total is flattered by four hundred bounces is not a bigger list.
 *
 * Every tile renders even at zero. A tile that disappears when its count
 * empties reads as a page that has broken, and "0 bounced" is information.
 *
 * ## Statuses are named, never colour-coded alone
 *
 * Each row says its status in words. Nothing here encodes meaning in
 * colour on its own — the same rule the rest of the dashboard follows, and
 * the reason `StatusBadge` on a post card carries a dot *and* a label.
 */
export function SubscribersPanel() {
  const [stats, setStats] = React.useState<SubscriberStats | null>(null);
  const [rows, setRows] = React.useState<Subscriber[] | null>(null);
  const [count, setCount] = React.useState(0);
  const [status, setStatus] = React.useState<SubscriberStatus | "">("");
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Debounced, so typing in the box is not one request per keystroke.
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = React.useMemo(
    () => ({
      ...(status ? { status } : null),
      ...(query ? { search: query } : null),
    }),
    [status, query],
  );

  React.useEffect(() => {
    let cancelled = false;

    // Both in one pass, because the counts describe the rows underneath
    // them — fetching them separately lets the page show a total that does
    // not match what is listed.
    //
    // Nothing is set synchronously in this effect body, including clearing
    // the error: a setState there cascades a render before the request has
    // even gone out. The error is cleared on success instead, which is the
    // moment it actually stops being true.
    void Promise.all([getSubscriberStats(filters), getSubscribers(filters)])
      .then(([nextStats, page]) => {
        if (cancelled) return;
        setStats(nextStats);
        setRows(page.results);
        setCount(page.count);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setError(
          err instanceof ApiError
            ? err.detail
            : "Could not load your subscribers.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <>
      <DashboardHeader />

      <main className="flex-1 pb-24">
        <Container className="max-w-5xl">
          <div className="py-5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md text-[0.85rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft aria-hidden className="size-4" />
              All posts
            </Link>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl">Subscribers</h1>
              <p className="mt-1 text-[0.875rem] text-muted-foreground">
                Readers who asked to hear when you publish.
              </p>
            </div>

            {/*
              A real link, not a fetch. The browser streams the file
              straight to disk and puts it in the downloads tray; building
              a blob in JavaScript would throw that away and hold the whole
              list in memory on the way past.

              **What actually forces the download is the server's
              `Content-Disposition: attachment`, not the `download`
              attribute here** — that attribute is specified to have no
              effect on a cross-origin URL, and the API is a different
              origin from the app in every environment. It is kept because
              it is correct and free if the two ever share one. The session
              cookie rides along because this is a top-level GET navigation
              and the cookie is SameSite=Lax.

              Styled with `buttonVariants` rather than rendered through
              <Button>, because that component expects a native <button>
              and warns — correctly — that anything else loses button
              semantics. This is a link. It should be one.
            */}
            <a
              href={subscriberExportUrl(filters)}
              download
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-9 rounded-full px-4 text-[0.85rem]",
              )}
            >
              <Download aria-hidden />
              Export CSV
            </a>
          </div>

          <StatRow stats={stats} />

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search addresses"
                aria-label="Search addresses"
                className="h-9 pl-9"
              />
            </div>

            <StatusFilter value={status} onChange={setStatus} />
          </div>

          {error ? (
            <p className="mt-8 text-[0.875rem] text-destructive">{error}</p>
          ) : (
            <SubscriberTable rows={rows} count={count} />
          )}
        </Container>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The numbers
 * ------------------------------------------------------------------ */

function StatRow({ stats }: { stats: SubscriberStats | null }) {
  if (!stats) {
    return (
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-[4.5rem] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* The hero figure. Sized well above everything else on the page
          because it is the only number that answers "how many people get
          my next post". */}
      <div className="mt-8 rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
        <p className="text-[0.75rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Active subscribers
        </p>
        <p className="mt-1 font-display text-5xl tabular-nums">
          {stats.active.toLocaleString()}
        </p>
        <p className="mt-2 text-[0.85rem] text-muted-foreground">
          {stats.active === 0
            ? "Nobody has confirmed a subscription yet."
            : `Everyone here gets your next post. ${stats.total.toLocaleString()} ${
                stats.total === 1 ? "address" : "addresses"
              } on record in total.`}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Awaiting confirmation" value={stats.pending} />
        <Stat label="Unsubscribed" value={stats.unsubscribed} />
        <Stat label="Bounced" value={stats.bounced} />
        <Stat label="Reported as spam" value={stats.complained} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="font-display text-2xl tabular-nums">
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[0.8rem] leading-snug text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The rows
 * ------------------------------------------------------------------ */

const STATUS_LABELS: Record<SubscriberStatus, string> = {
  confirmed: "Confirmed",
  pending: "Awaiting confirmation",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  complained: "Reported as spam",
};

const FILTERS: { value: SubscriberStatus | ""; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Awaiting" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "bounced", label: "Bounced" },
  { value: "complained", label: "Spam reports" },
];

function StatusFilter({
  value,
  onChange,
}: {
  value: SubscriberStatus | "";
  onChange: (next: SubscriberStatus | "") => void;
}) {
  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
      {FILTERS.map((option) => (
        <button
          key={option.value || "all"}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-[0.8rem] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            value === option.value
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SubscriberTable({
  rows,
  count,
}: {
  rows: Subscriber[] | null;
  count: number;
}) {
  if (!rows) {
    return (
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="mt-10 text-[0.9rem] text-muted-foreground">
        Nobody here yet. Subscribers appear once a reader signs up on your
        blog and confirms by email.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-left text-[0.875rem]">
          <thead className="bg-muted/50 text-[0.75rem] tracking-[0.04em] text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Address
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Status
              </th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                Signed up
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-border/70 align-middle"
              >
                <td className="px-4 py-3 break-all">{row.email}</td>
                {/* In words, never colour alone. */}
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {STATUS_LABELS[row.status]}
                </td>
                <td className="hidden px-4 py-3 whitespace-nowrap text-muted-foreground sm:table-cell">
                  {formatDate(row.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {count > rows.length ? (
        <p className="mt-3 text-[0.8rem] text-muted-foreground">
          Showing {rows.length} of {count.toLocaleString()}. Export the CSV for
          the full list.
        </p>
      ) : null}
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
