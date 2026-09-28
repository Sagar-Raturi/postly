import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/site/primitives";
import { Reveal } from "@/components/motion/reveal";
import { COMING_NEXT, FREE_PLAN_FEATURES } from "@/lib/content";

/**
 * One plan, because there is one plan.
 *
 * Paid tiers are not built — there is no billing — so showing prices for
 * them would be selling something that cannot be bought. What is planned is
 * named underneath as planned, and the free plan lists only what the product
 * actually does. When billing exists this grows back into a grid.
 */
export function Pricing() {
  return (
    <section id="pricing" className="py-20 sm:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            label="Pricing"
            title="Free while Postly is young."
            description="Everything Postly does today is included, with no card and no trial clock. Paid plans come later, for features that do not exist yet — never by taking these away."
            align="center"
            className="mx-auto max-w-2xl"
          />
        </Reveal>

        <Reveal delay={0.06} y={22}>
          <div className="relative mx-auto mt-12 max-w-md rounded-2xl bg-card p-7 shadow-lift ring-2 ring-brand sm:p-9">
            <Badge className="absolute -top-2.5 left-7 h-6 bg-brand px-3 text-[0.68rem] tracking-wide text-brand-foreground uppercase">
              Early access
            </Badge>

            <h3 className="font-display text-xl tracking-[-0.01em]">Free</h3>
            <p className="mt-1.5 text-[0.88rem] text-pretty text-muted-foreground">
              Everything you need to get the first post out, and the hundredth.
            </p>

            <div className="mt-6 flex items-baseline gap-1.5">
              <span className="font-display text-5xl leading-none tracking-[-0.03em]">
                $0
              </span>
              <span className="text-[0.85rem] text-muted-foreground">
                No card required
              </span>
            </div>

            <Button
              className="mt-6 h-11 w-full rounded-full text-[0.9rem] transition-transform hover:-translate-y-px"
              nativeButton={false}
              render={<Link href="/signup" />}
            >
              Start writing — free
            </Button>

            <ul className="mt-7 space-y-3 border-t border-border/70 pt-7">
              {FREE_PLAN_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-[0.88rem] leading-snug text-foreground/85"
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand">
                    <Check aria-hidden className="size-2.5" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mx-auto mt-10 max-w-xl text-center text-[0.85rem] text-pretty text-muted-foreground">
            On the way: {COMING_NEXT.join(", ")}. No ads on any plan, ever.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
