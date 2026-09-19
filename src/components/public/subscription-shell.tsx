import * as React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/public/page-container";

/**
 * The frame the two subscription pages are drawn in.
 *
 * A single narrow column rather than the blog's two — these pages are one
 * sentence and at most one button, and putting the writer's profile panel
 * beside an unsubscribe form would be an odd thing to do to somebody who
 * has just decided to leave.
 *
 * Presentational and server-rendered on purpose: the client components
 * inside it own the token, the request and every state that follows, and
 * this owns none of them.
 */
export function SubscriptionShell({
  title,
  children,
  siteSlug,
  siteName,
}: {
  title: string;
  children: React.ReactNode;
  /** Omitted until the API has said which blog the token belongs to. */
  siteSlug?: string;
  siteName?: string;
}) {
  return (
    <PageContainer className="py-16 lg:py-24">
      <div className="mx-auto max-w-[520px]">
        <h1 className="font-blog-heading text-[30px] leading-[1.2] tracking-[-0.02em] text-balance text-foreground">
          {title}
        </h1>

        <div className="mt-6">{children}</div>

        {siteSlug ? (
          <p className="mt-10 border-t border-border/70 pt-6 text-[15px]">
            <Link
              href={`/${siteSlug}`}
              className="rounded-sm text-brand transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              {siteName ? `Back to ${siteName}` : "Back to the blog"}
            </Link>
          </p>
        ) : null}
      </div>
    </PageContainer>
  );
}

/** Body copy on these pages — one size, used by both. */
export function SubscriptionText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[16px] leading-[1.7] text-pretty text-muted-foreground">
      {children}
    </p>
  );
}
