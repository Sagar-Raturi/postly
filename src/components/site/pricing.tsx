"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container, SectionHeading } from "@/components/site/primitives";
import { Reveal } from "@/components/motion/reveal";
import { PLANS } from "@/lib/content";
import { cn } from "@/lib/utils";

type Period = "monthly" | "yearly";

export function Pricing() {
  const [period, setPeriod] = React.useState<Period>("monthly");
  const reduceMotion = useReducedMotion();

  return (
    <section id="pricing" className="py-20 sm:py-28">
      <Container>
        <Reveal>
          <SectionHeading
            label="Pricing"
            title="Start free. Upgrade when it matters."
            description="No reader limits on any plan, and no surprise bill when a post does well. Prices are per writer, in US dollars."
            align="center"
            className="mx-auto max-w-2xl"
          />
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-9 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1 ring-1 ring-foreground/[0.07]">
              {(["monthly", "yearly"] as const).map((value) => {
                const active = period === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPeriod(value)}
                    aria-pressed={active}
                    className={cn(
                      "relative rounded-full px-4 py-1.5 text-[0.85rem] font-medium transition-colors",
                      active ? "text-background" : "text-muted-foreground",
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId={reduceMotion ? undefined : "billing-pill"}
                        className="absolute inset-0 rounded-full bg-foreground"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 32,
                        }}
                      />
                    ) : null}
                    <span className="relative z-10 capitalize">{value}</span>
                    {value === "yearly" ? (
                      <span
                        className={cn(
                          "relative z-10 ml-1.5 text-[0.72rem]",
                          active ? "text-background/70" : "text-brand",
                        )}
                      >
                        −25%
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid items-start gap-5 lg:grid-cols-3">
          {PLANS.map((plan, i) => {
            const amount = plan.price
              ? plan.price[period]
              : null;

            return (
              <Reveal key={plan.name} delay={0.06 * i} y={22}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl p-7 transition-shadow duration-300",
                    plan.recommended
                      ? "bg-card shadow-lift ring-2 ring-brand lg:-my-3 lg:py-10"
                      : "bg-card ring-1 ring-foreground/10 hover:shadow-soft",
                  )}
                >
                  {plan.recommended ? (
                    <Badge className="absolute -top-2.5 left-7 h-6 bg-brand px-3 text-[0.68rem] tracking-wide text-brand-foreground uppercase">
                      Most popular
                    </Badge>
                  ) : null}

                  <h3 className="font-display text-xl tracking-[-0.01em]">
                    {plan.name}
                  </h3>
                  <p className="mt-1.5 text-[0.88rem] text-pretty text-muted-foreground">
                    {plan.tagline}
                  </p>

                  <div className="mt-6 flex items-baseline gap-1.5">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={`${plan.name}-${period}`}
                        initial={
                          reduceMotion ? false : { opacity: 0, y: 6, filter: "blur(2px)" }
                        }
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={
                          reduceMotion
                            ? undefined
                            : { opacity: 0, y: -6, position: "absolute" }
                        }
                        transition={{ duration: 0.22 }}
                        className="font-display text-5xl leading-none tracking-[-0.03em]"
                      >
                        ${amount}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-[0.85rem] text-muted-foreground">
                      {amount === 0 ? plan.priceNote : `/ month`}
                    </span>
                  </div>
                  <p className="mt-2 h-4 text-[0.75rem] text-muted-foreground">
                    {amount === 0
                      ? "No card required"
                      : period === "yearly"
                        ? "billed annually"
                        : "billed monthly"}
                  </p>

                  <Button
                    variant={plan.recommended ? "default" : "outline"}
                    className="mt-6 h-11 w-full rounded-full text-[0.9rem] transition-transform hover:-translate-y-px"
                    nativeButton={false}
                    render={
                      plan.ctaHref.startsWith("/") ? (
                        <Link href={plan.ctaHref} />
                      ) : (
                        <a href={plan.ctaHref} />
                      )
                    }
                  >
                    {plan.cta}
                  </Button>

                  <ul className="mt-7 space-y-3 border-t border-border/70 pt-7">
                    {plan.features.map((feature) => (
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
            );
          })}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-center text-[0.85rem] text-muted-foreground">
            Every plan includes unlimited posts, HTTPS, a full Markdown export,
            and no ads. Cancel whenever you like — your blog stays readable.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
