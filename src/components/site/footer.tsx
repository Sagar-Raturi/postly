import { Mail, Rss } from "lucide-react";
import { Container } from "@/components/site/primitives";
import { Logo } from "@/components/site/logo";
import { FOOTER_LINKS } from "@/lib/content";

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.53 3h3.02l-6.6 7.54L21.75 21h-5.99l-4.7-6.14L5.68 21H2.66l7.06-8.07L2.25 3h6.14l4.25 5.62L17.53 3Zm-1.06 16.2h1.67L7.6 4.71H5.81l10.66 14.49Z" />
    </svg>
  );
}

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

const SOCIALS = [
  { label: "Postly on X", href: "#", Icon: XIcon },
  { label: "Postly on GitHub", href: "#", Icon: GithubIcon },
  { label: "Postly RSS feed", href: "#", Icon: Rss },
  { label: "Email Postly", href: "#", Icon: Mail },
];

export function Footer() {
  return (
    <footer id="blog" className="border-t border-border bg-muted/30">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-[0.9rem] leading-relaxed text-pretty text-muted-foreground">
              A blog of your own, live in minutes. Built for people who would
              rather be writing than configuring.
            </p>
            <div className="mt-6 flex items-center gap-1.5">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_LINKS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-[0.7rem] font-semibold tracking-[0.16em] text-foreground uppercase">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[0.9rem] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-7 sm:flex-row sm:items-center">
          <p className="text-[0.82rem] text-muted-foreground">
            © {new Date().getFullYear()} Postly, Inc. Made for people who write.
          </p>
          <p className="flex items-center gap-2 text-[0.82rem] text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-brand" />
            All systems operational
          </p>
        </div>
      </Container>
    </footer>
  );
}
