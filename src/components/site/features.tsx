import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Container, SectionHeading } from "@/components/site/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { FEATURES } from "@/lib/content";

export function Features() {
  return (
    <section
      id="features"
      className="border-y border-border bg-muted/70 py-20 sm:py-28"
    >
      <Container>
        <Reveal>
          <SectionHeading
            label="Features"
            title={
              <>
                Everything a blog needs.{" "}
                <span className="italic">Nothing it doesn&rsquo;t.</span>
              </>
            }
            description="Postly is deliberately small. Each of these earns its place by removing a decision you would otherwise have to make."
            align="center"
            className="mx-auto max-w-2xl"
          />
        </Reveal>

        <Stagger className="mt-14 grid gap-4 sm:grid-cols-2 sm:mt-16 lg:grid-cols-3">
          {FEATURES.map(({ title, description, icon: Icon }) => (
            <StaggerItem key={title} className="h-full">
              <Card className="group h-full [--card-spacing:--spacing(6)] bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift hover:ring-foreground/20">
                <CardHeader className="gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand/15">
                    <Icon aria-hidden className="size-[1.15rem]" />
                  </span>
                  <CardTitle className="mt-2 font-display text-lg leading-snug font-normal tracking-[-0.01em]">
                    {title}
                  </CardTitle>
                  <CardDescription className="text-[0.9rem] leading-relaxed text-pretty">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal delay={0.1}>
          <p className="mt-10 text-center text-[0.9rem] text-muted-foreground">
            Also: post scheduling, draft sharing links, image optimisation,
            imports from Ghost, WordPress and Substack.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
