import { Check } from "lucide-react";
import { Container, SectionHeading } from "@/components/site/primitives";
import { Reveal } from "@/components/motion/reveal";
import { BrowserFrame } from "@/components/mockups/browser-frame";
import {
  ClaimNameScreen,
  FocusEditorScreen,
  PublishedBlogScreen,
} from "@/components/mockups/screens";
import { STEPS } from "@/lib/content";
import { cn } from "@/lib/utils";

const SCREENS = [ClaimNameScreen, FocusEditorScreen, PublishedBlogScreen];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            label="How it works"
            title={
              <>
                Three steps, and then you are{" "}
                <span className="italic">just writing</span>.
              </>
            }
            description="No theme marketplace, no build step, no deploy. The distance between an idea and a published page is about ninety seconds."
            align="center"
            className="mx-auto max-w-2xl"
          />
        </Reveal>

        <div className="mt-16 flex flex-col gap-20 sm:mt-20 sm:gap-28">
          {STEPS.map((step, i) => {
            const Screen = SCREENS[i];
            const flipped = i % 2 === 1;

            return (
              <div
                key={step.number}
                className="grid items-center gap-10 md:grid-cols-2 md:gap-14"
              >
                <Reveal
                  delay={0.05}
                  className={cn(flipped && "md:order-2 md:pl-4")}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-display text-4xl leading-none text-brand/35">
                      {step.number}
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-border" />
                  </div>

                  <h3 className="mt-5 font-display text-2xl leading-tight tracking-[-0.02em] text-balance sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-md text-[1.0625rem] leading-relaxed text-pretty text-muted-foreground">
                    {step.description}
                  </p>

                  <ul className="mt-6 space-y-2.5">
                    {step.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-[0.9rem] text-foreground/80"
                      >
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand/12 text-brand">
                          <Check aria-hidden className="size-2.5" />
                        </span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </Reveal>

                <Reveal
                  delay={0.12}
                  y={24}
                  className={cn(flipped && "md:order-1")}
                >
                  <BrowserFrame url={step.url}>
                    <Screen />
                  </BrowserFrame>
                </Reveal>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
