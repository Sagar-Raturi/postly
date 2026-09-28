import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Container } from "@/components/site/primitives";
import { LEGAL_UPDATED } from "@/lib/operator";

/**
 * The shell for /privacy and /terms: the marketing navbar and footer around
 * a single column of prose.
 *
 * `prose prose-postly` is the same typography a published post gets, which
 * already follows the light/dark palette — see globals.css.
 */
export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-14 sm:py-20">
        <Container className="max-w-3xl">
          <h1 className="font-display text-4xl tracking-[-0.02em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-[0.85rem] text-muted-foreground">
            Last updated {LEGAL_UPDATED}
          </p>
          <p className="mt-6 max-w-prose text-[1.05rem] leading-relaxed text-pretty text-muted-foreground">
            {summary}
          </p>

          <div className="prose prose-postly mt-10 max-w-none">{children}</div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
