"use client";

import * as React from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The writer's public address, with a way to copy it and a way to open it.
 *
 * This is the **only** place in Postly that shows somebody their own site
 * URL. Not the marketing navbar, not the footer, not the account menu — a
 * visitor to postly.com is being sold a product, and a signed-in writer's
 * personal address has no business appearing there.
 *
 * On the two URLs: `domain` is what the chip displays and what a blog will
 * be served from once Phase 3 lands (`sagar.postly.com`). `href` is what
 * actually resolves today (`/sagar`). They are different strings for now,
 * which is why "View live" and "Copy link" both use `href` — the button's
 * job is to hand over a link that opens, and a copied `sagar.postly.com`
 * would not. When subdomains land, the two collapse into one value and this
 * component loses its only piece of cleverness.
 */
export function SiteLinkChip({
  domain,
  href,
  className,
}: {
  domain: string;
  href: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  // Cleared on unmount so a writer who copies and immediately navigates away
  // does not leave a timer setting state on a gone component.
  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    // Relative href → the absolute URL a reader could actually open.
    const absolute = new URL(href, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (an insecure origin, a locked-down
      // browser). Nothing was copied, so the button must not claim it was.
      setCopied(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border border-border bg-card/60 py-1 pr-1 pl-3 text-[0.8rem] shadow-sm",
        className,
      )}
    >
      <Link2 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />

      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="group/link inline-flex min-w-0 items-center gap-1.5 rounded-full px-1 font-mono text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="truncate">{domain}</span>
        <ExternalLink
          aria-hidden
          className="size-3 shrink-0 opacity-50 transition-opacity group-hover/link:opacity-100"
        />
      </a>

      <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />

      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 rounded-full px-2.5 text-[0.75rem] font-normal text-muted-foreground hover:text-foreground"
        aria-label={`Copy the link to ${domain}`}
        onClick={handleCopy}
      >
        {copied ? (
          <Check aria-hidden className="text-brand" />
        ) : (
          <Copy aria-hidden />
        )}
        {/* The label changes rather than a toast appearing — it is the
            element that was just clicked, so it is where the eye is. */}
        <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 rounded-full px-2.5 text-[0.75rem] font-normal text-muted-foreground hover:text-foreground max-sm:hidden"
        // Renders as an anchor so "open in a new tab" works the way it does
        // everywhere else; base-ui needs telling it is not a <button>.
        nativeButton={false}
        render={<a href={href} target="_blank" rel="noreferrer" />}
      >
        View live
      </Button>
    </div>
  );
}
