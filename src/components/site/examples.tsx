import { Badge } from "@/components/ui/badge";
import { Container, SectionHeading } from "@/components/site/primitives";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { BrowserFrame } from "@/components/mockups/browser-frame";
import { BlogPreviewScreen } from "@/components/mockups/screens";
import { EXAMPLE_BLOGS } from "@/lib/content";

export function Examples() {
  return (
    <section
      id="examples"
      className="border-y border-border bg-muted/70 py-20 sm:py-28"
    >
      <Container>
        <Reveal>
          {/* Illustrations, and labelled as such: these are not real blogs,
              and nothing here should suggest otherwise. */}
          <SectionHeading
            label="Examples"
            title="One platform, any kind of writing"
            description="Four sketches of what a Codomain blog can be — an essay blog, an engineer's notebook, a recipe box, a photo journal. Illustrations, not real sites."
            className="max-w-xl"
          />
        </Reveal>

        <Stagger
          stagger={0.07}
          className="mt-12 grid gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4"
        >
          {EXAMPLE_BLOGS.map((blog) => (
            <StaggerItem key={blog.url}>
              <div>
                <BrowserFrame
                  url={blog.url}
                  size="sm"
                  secure={false}
                  className="shadow-soft"
                >
                  <BlogPreviewScreen
                    title={blog.title}
                    tagline={blog.tagline}
                    headline={blog.headline}
                    excerpt={blog.excerpt}
                    accent={blog.accent}
                  />
                </BrowserFrame>

                <div className="mt-3.5 flex items-center justify-between gap-3 px-0.5">
                  <span className="truncate font-mono text-[0.72rem] text-muted-foreground">
                    {blog.url}
                  </span>
                  <Badge
                    variant="outline"
                    className="shrink-0 bg-background text-[0.62rem] font-medium text-muted-foreground"
                  >
                    {blog.niche}
                  </Badge>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
