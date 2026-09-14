import { ArrowUpRight } from "lucide-react";
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
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              label="Examples"
              title="Real blogs, running on Postly"
              description="Four of the ten thousand. Same platform, four very different rooms."
              className="max-w-xl"
            />
            <a
              href="#"
              className="group inline-flex shrink-0 items-center gap-1.5 text-[0.9rem] font-medium text-brand"
            >
              Browse the directory
              <ArrowUpRight
                aria-hidden
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
          </div>
        </Reveal>

        <Stagger
          stagger={0.07}
          className="mt-12 grid gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4"
        >
          {EXAMPLE_BLOGS.map((blog) => (
            <StaggerItem key={blog.url}>
              <a
                href="#"
                className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none"
              >
                <BrowserFrame
                  url={blog.url}
                  size="sm"
                  secure={false}
                  className="shadow-soft transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-lift group-hover:ring-brand/30"
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
                  <span className="truncate font-mono text-[0.72rem] text-muted-foreground transition-colors group-hover:text-brand">
                    {blog.url}
                  </span>
                  <Badge
                    variant="outline"
                    className="shrink-0 bg-background text-[0.62rem] font-medium text-muted-foreground"
                  >
                    {blog.niche}
                  </Badge>
                </div>
              </a>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
