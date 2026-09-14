import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/site/primitives";
import { Reveal } from "@/components/motion/reveal";

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden bg-[oklch(0.215_0.015_62)] text-[oklch(0.97_0.005_95)] dark:bg-[oklch(0.245_0.014_68)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_75%_at_50%_115%,oklch(0.435_0.082_157/0.55)_0%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-paper-dots text-white/[0.07] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />

      <Container className="relative py-24 text-center sm:py-32">
        <Reveal>
          <p className="text-[0.72rem] font-semibold tracking-[0.18em] text-brand-muted uppercase">
            Start today
          </p>
        </Reveal>

        <Reveal delay={0.06}>
          <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            Your best writing is{" "}
            <span className="italic">one post away</span>.
          </h2>
        </Reveal>

        <Reveal delay={0.12}>
          <p className="mx-auto mt-6 max-w-lg text-[1.05rem] leading-relaxed text-pretty text-white/65">
            Claim your name, write the first thing, press publish. Bring a
            custom domain across whenever you are ready — or never.
          </p>
        </Reveal>

        <Reveal delay={0.18}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              className="h-12 w-full rounded-full bg-[oklch(0.97_0.005_95)] px-7 text-[0.95rem] text-[oklch(0.215_0.015_62)] shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-white sm:w-auto"
              nativeButton={false}
              render={<a href="#pricing" />}
            >
              Start your blog — free
              <ArrowRight aria-hidden data-icon="inline-end" />
            </Button>
            <Button
              variant="ghost"
              className="h-12 w-full rounded-full px-7 text-[0.95rem] text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white sm:w-auto"
              nativeButton={false}
              render={<a href="#examples" />}
            >
              See examples
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.24}>
          <p className="mt-6 text-[0.82rem] text-white/45">
            Free forever plan · No credit card · Export everything any time
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
