import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";

/**
 * The document shell, and nothing else.
 *
 * Codomain serves two independent things from one Next.js app: the product
 * (marketing, auth, dashboard) under `(app)/`, and every writer's published
 * blog under `[siteSlug]/`. Only the first needs to know who is signed in,
 * so `AuthProvider` lives in `(app)/layout.tsx` rather than here — a reader
 * on somebody's blog should not have their browser asking the Codomain API
 * about a session they do not have.
 *
 * The same goes for the theme. `next-themes` is the *product's* light/dark
 * switch, and it lives in `(app)/layout.tsx` for the same reason: a blog's
 * appearance is its writer's setting, published with the blog, and a reader
 * who once put the Codomain marketing site into dark mode should not thereby
 * restyle somebody else's writing.
 *
 * What is shared is genuinely shared: the document, and the fonts.
 */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs in link previews and canonical tags are built on this, so
  // it must be the domain Codomain actually serves from. It was once
  // postly.com — someone else's site — which told search engines that every
  // blog's canonical copy lived there.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.codomain.in",
  ),
  title: "Codomain — Publish your blog in minutes. Own it for good.",
  description:
    "Codomain gives every writer a fast, beautiful blog at their own address. Email subscribers, readable themes, no code, no ads — and your words stay yours.",
  openGraph: {
    title: "Codomain — Publish your blog in minutes. Own it for good.",
    description:
      "A fast, beautiful blog at your own address. Email subscribers, readable themes, no code, no ads.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${newsreader.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Scroll reveals start hidden; without JS they must not stay that way. */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
