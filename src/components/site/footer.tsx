import Link from "next/link";
import { Mail } from "lucide-react";
import { Container } from "@/components/site/primitives";
import { Logo } from "@/components/site/logo";
import { FOOTER_LINKS } from "@/lib/content";
import { CONTACT_EMAIL } from "@/lib/operator";

/**
 * Only links that go somewhere. There are no social accounts, no status
 * page and no company blog yet, so none of them appear — an icon that leads
 * nowhere reads as an abandoned product.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-block rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Logo />
              <span className="sr-only">Codomain home</span>
            </Link>
            <p className="mt-4 max-w-xs text-[0.9rem] leading-relaxed text-pretty text-muted-foreground">
              A blog of your own, live in minutes. Built for people who would
              rather be writing than configuring.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-6 inline-flex items-center gap-2 text-[0.9rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Mail aria-hidden className="size-4" />
              {CONTACT_EMAIL}
            </a>
          </div>

          {FOOTER_LINKS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-[0.7rem] font-semibold tracking-[0.16em] text-foreground uppercase">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[0.9rem] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-7">
          <p className="text-[0.82rem] text-muted-foreground">
            © {new Date().getFullYear()} Codomain. Made for people who write.
          </p>
        </div>
      </Container>
    </footer>
  );
}
