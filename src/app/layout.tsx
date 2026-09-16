import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/**
 * The document shell, and nothing else.
 *
 * Postly serves two independent things from one Next.js app: the product
 * (marketing, auth, dashboard) under `(app)/`, and every writer's published
 * blog under `[siteSlug]/`. Only the first needs to know who is signed in,
 * so `AuthProvider` lives in `(app)/layout.tsx` rather than here — a reader
 * on somebody's blog should not have their browser asking the Postly API
 * about a session they do not have.
 *
 * What is shared is genuinely shared: fonts, the palette, and the theme.
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
  metadataBase: new URL("https://postly.com"),
  title: "Postly — Publish your blog in minutes. Own it for good.",
  description:
    "Postly gives every writer a fast, beautiful blog at their own address. Custom domains, email subscribers, no code, no ads — and your words stay yours.",
  openGraph: {
    title: "Postly — Publish your blog in minutes. Own it for good.",
    description:
      "A fast, beautiful blog at your own address. Custom domains, email subscribers, no code, no ads.",
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
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
