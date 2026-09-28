import {
  BookOpen,
  Download,
  Mail,
  Palette,
  PenLine,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/*
 * Every claim on the homepage lives in this file, and every claim in it is
 * meant to be true of the product as it ships today. Anything that is only
 * planned — custom domains, RSS, analytics, scheduling, Markdown export,
 * paid plans — says so where it appears, or does not appear at all.
 *
 * The mockups in components/mockups/ are illustrations and can show made-up
 * blogs. Numbers, quotes and "N writers use this" cannot: there are no
 * testimonials or usage stats here until there are real ones to show.
 */

// Absolute ("/#…") rather than bare anchors so they also work from the
// legal pages, which share the navbar and footer.
export const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Examples", href: "/#examples" },
];

export const STEPS = [
  {
    number: "01",
    title: "Sign up and claim your name",
    description:
      "Pick a name, check the address, and you have a live blog. No templates to choose, no install, no server to point at anything.",
    bullets: [
      "Your address is checked and reserved as you type it",
      "An email and a password — nothing else to set up",
    ],
    url: "postly.com/new",
  },
  {
    number: "02",
    title: "Write in an editor that stays out of the way",
    description:
      "Type. Format from the toolbar or with Markdown shortcuts. Every change is saved as you go, and nothing loads while you think.",
    bullets: [
      "Markdown shortcuts, or just write — both work",
      "Drafts live in your account, so you can pick up on any device",
    ],
    url: "postly.com/editor/writing-in-public",
  },
  {
    number: "03",
    title: "Publish, and it is already live",
    description:
      "One button. Your post is online straight away, and your email subscribers hear about it a few minutes later — long enough to unpublish if you spot a typo.",
    bullets: [
      "Pages are rendered on the server, readable before any script runs",
      "Readers can subscribe from your blog and the end of every post",
    ],
    url: "nina.postly.com",
  },
] as const;

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const FEATURES: Feature[] = [
  {
    title: "A calm, fast editor",
    description:
      "Autosaves as you type, with Markdown shortcuts and a toolbar for everything else. Publish or unpublish in one click.",
    icon: PenLine,
  },
  {
    title: "Themes that stay readable",
    description:
      "Four palettes in light and dark, three type pairings and an accent colour of your choosing — every combination keeps its contrast.",
    icon: Palette,
  },
  {
    title: "Email subscribers, done properly",
    description:
      "Readers confirm by email, every message has a one-click unsubscribe, and new posts go out to your list automatically.",
    icon: Mail,
  },
  {
    title: "Built for readers",
    description:
      "Server-rendered pages with proper titles and link previews. No ads, no trackers, no pop-ups asking for anything.",
    icon: BookOpen,
  },
  {
    title: "Your list is yours",
    description:
      "See who has subscribed, how many have confirmed, and export the whole list as CSV whenever you like.",
    icon: Download,
  },
  {
    title: "A profile beside your posts",
    description:
      "Your photo, a short bio and — only if you choose — your email address, on every page of your blog.",
    icon: UserRound,
  },
];

/** Planned, not built. Shown as "coming next", never as a feature. */
export const COMING_NEXT = [
  "custom domains",
  "RSS feeds",
  "image uploads",
  "post scheduling",
  "Markdown export",
];

/**
 * Illustrations of what a blog can look like, not real blogs. The section
 * that shows them says so.
 */
export const EXAMPLE_BLOGS = [
  {
    title: "Small Hours",
    tagline: "Essays about attention, mostly.",
    headline: "The year I stopped reading the news",
    excerpt:
      "In January I cancelled every alert on my phone and replaced them with a single rule.",
    niche: "Personal essay",
    url: "nina.postly.com",
    accent: "oklch(0.72 0.09 45)",
  },
  {
    title: "Compile Time",
    tagline: "Notes from a working engineer.",
    headline: "Our queue was slow. Our metrics were wrong.",
    excerpt:
      "Six weeks of chasing a p99 that did not exist, and what the flame graph finally showed.",
    niche: "Tech blog",
    url: "danielo.postly.com",
    accent: "oklch(0.58 0.1 220)",
  },
  {
    title: "Ginger & Salt",
    tagline: "Weeknight food, written down.",
    headline: "A dal that survives a bad day",
    excerpt:
      "Twenty minutes, one pot, and nothing you need to shop for on the way home.",
    niche: "Recipes",
    url: "gingerandsalt.postly.com",
    accent: "oklch(0.68 0.12 70)",
  },
  {
    title: "Field Report",
    tagline: "Photographs and the walk that found them.",
    headline: "Three weeks on the Kyushu coast",
    excerpt:
      "Ferry timetables, borrowed rain gear, and the light at four in the afternoon.",
    niche: "Photography",
    url: "fieldreport.postly.com",
    accent: "oklch(0.5 0.07 160)",
  },
];

/**
 * What the free plan includes — which, until paid plans exist, is
 * everything. No limits are listed that the product does not enforce.
 */
export const FREE_PLAN_FEATURES = [
  "Your own blog address",
  "Unlimited posts and drafts",
  "The full editor",
  "Email subscribers, with double opt-in",
  "Four themes, in light and dark",
  "Export your subscriber list any time",
];

export const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Examples", href: "/#examples" },
      { label: "Start writing", href: "/signup" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Content rules", href: "/terms#content" },
    ],
  },
];
