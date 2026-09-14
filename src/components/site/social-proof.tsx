import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/site/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { PUBLICATIONS, STATS, TESTIMONIALS } from "@/lib/content";
import { cn } from "@/lib/utils";

/** Placeholder mastheads, set in type rather than shipped as image files. */
const LOGO_STYLES = [
  "font-display text-lg tracking-[-0.01em]",
  "font-display text-[1.05rem] italic",
  "text-[0.8rem] font-semibold tracking-[0.18em] uppercase",
  "font-display text-lg tracking-[-0.01em]",
  "text-[0.8rem] font-semibold tracking-[0.18em] uppercase",
  "font-display text-[1.05rem] italic",
];

export function SocialProof() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        {/* logo strip */}
        <Reveal>
          <p className="text-center text-[0.72rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Trusted by writers from
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 sm:gap-x-14">
            {PUBLICATIONS.map((name, i) => (
              <span
                key={name}
                className={cn(
                  "text-foreground/45 transition-colors duration-300 hover:text-foreground/75",
                  LOGO_STYLES[i % LOGO_STYLES.length],
                )}
              >
                {name}
              </span>
            ))}
          </div>
        </Reveal>

        {/* testimonials */}
        <Stagger className="mt-16 grid gap-4 sm:mt-20 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <StaggerItem key={t.name} className="h-full">
              <Card className="h-full [--card-spacing:--spacing(6)] bg-card transition-shadow duration-300 hover:shadow-soft">
                <CardContent className="flex h-full flex-col">
                  <span
                    aria-hidden
                    className="font-display text-3xl leading-none text-brand/30"
                  >
                    &ldquo;
                  </span>
                  <blockquote className="mt-2 mb-6 font-display text-[1.05rem] leading-[1.6] text-pretty text-foreground/90">
                    {t.quote}
                  </blockquote>
                  <div className="mt-auto flex items-center gap-3 border-t border-border/70 pt-5">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-brand/12 text-[0.7rem] font-semibold text-brand">
                        {t.initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.85rem] font-medium">
                        {t.name}
                      </span>
                      <span className="block truncate text-[0.78rem] text-muted-foreground">
                        {t.role}
                      </span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>

        {/* stats */}
        <Reveal delay={0.05}>
          <div className="mt-16 grid divide-y divide-border rounded-2xl bg-muted/50 ring-1 ring-foreground/[0.06] sm:mt-20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-6 py-8 text-center">
                <div className="font-display text-4xl leading-none tracking-[-0.02em] sm:text-[2.75rem]">
                  {stat.value}
                </div>
                <div className="mt-2.5 text-[0.85rem] text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
