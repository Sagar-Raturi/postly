import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Rise } from "@/components/site/primitives";
import { BrowserFrame } from "@/components/mockups/browser-frame";
import { EditorScreen } from "@/components/mockups/screens";

function FloatingChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`absolute hidden items-center gap-2 rounded-full bg-card px-3.5 py-2 text-[0.78rem] font-medium shadow-lift ring-1 ring-foreground/10 lg:flex ${className}`}
    >
      {children}
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* soft brand wash + paper grain behind the fold */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(65%_55%_at_50%_0%,var(--brand-soft)_0%,transparent_72%)] opacity-70"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-paper-dots text-foreground/[0.08] [mask-image:radial-gradient(ellipse_at_top,black_10%,transparent_70%)]"
      />

      <Container className="relative pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <Rise>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full bg-card/80 py-1.5 pr-3 pl-1.5 text-[0.78rem] shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-colors hover:bg-card"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/12 px-2 py-0.5 text-[0.7rem] font-semibold text-brand">
                <Sparkles aria-hidden className="size-3" />
                New
              </span>
              <span className="text-muted-foreground">
                Custom domains now on every paid plan
              </span>
              <ArrowRight
                aria-hidden
                className="size-3.5 text-muted-foreground"
              />
            </a>
          </Rise>

          <Rise delay={80}>
            <h1 className="mt-7 font-display text-5xl leading-[1.02] font-normal tracking-[-0.03em] text-balance sm:text-6xl md:text-7xl">
              Publish your blog in minutes.{" "}
              <span className="text-brand italic">Own it for good.</span>
            </h1>
          </Rise>

          <Rise delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
              Postly gives every writer a fast, beautiful blog at an address of
              their own. Custom domains, email subscribers, and not a line of
              code — your words stay yours.
            </p>
          </Rise>

          <Rise delay={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                className="h-12 w-full rounded-full px-7 text-[0.95rem] shadow-lift transition-transform hover:-translate-y-0.5 sm:w-auto"
                nativeButton={false}
                render={<a href="#pricing" />}
              >
                Start your blog — free
                <ArrowRight aria-hidden data-icon="inline-end" />
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full rounded-full bg-card/70 px-7 text-[0.95rem] backdrop-blur transition-transform hover:-translate-y-0.5 sm:w-auto"
                nativeButton={false}
                render={<a href="#examples" />}
              >
                See examples
              </Button>
            </div>
          </Rise>

          <Rise delay={300}>
            <p className="mt-5 text-[0.82rem] text-muted-foreground">
              Free forever plan · No credit card ·{" "}
              <span className="font-mono text-[0.78rem]">
                yourname.postly.com
              </span>{" "}
              in under a minute
            </p>
          </Rise>
        </div>

        <Rise delay={380}>
          <div className="relative mx-auto mt-14 max-w-5xl sm:mt-16">
            <BrowserFrame url="postly.com/editor/writing-in-public">
              <EditorScreen />
            </BrowserFrame>

            <FloatingChip className="-top-4 -right-5">
              <span className="flex size-4 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <Check aria-hidden className="size-2.5" />
              </span>
              Live at nina.postly.com
            </FloatingChip>

            <FloatingChip className="-bottom-5 -left-6">
              <span className="size-1.5 rounded-full bg-brand" />
              1,942 subscribers emailed
              <span className="font-mono text-[0.7rem] font-normal text-muted-foreground">
                0.4s
              </span>
            </FloatingChip>
          </div>
        </Rise>
      </Container>
    </section>
  );
}
