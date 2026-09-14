import {
  ChartNoAxesColumn,
  Download,
  Globe,
  Mail,
  PenLine,
  ShieldOff,
  type LucideIcon,
} from "lucide-react";

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Examples", href: "#examples" },
  { label: "Blog", href: "#blog" },
];

export const STEPS = [
  {
    number: "01",
    title: "Sign up and claim your name",
    description:
      "Pick a name, check the address, and you have a live blog. No templates to choose, no install, no server to point at anything.",
    bullets: [
      "yourname.postly.com, reserved the moment you type it",
      "Sign in with email or a passkey — no password to forget",
    ],
    url: "postly.com/new",
  },
  {
    number: "02",
    title: "Write in an editor that stays out of the way",
    description:
      "Type. Paste an image and it uploads. Hit slash for anything else. Every keystroke is saved, and nothing loads while you think.",
    bullets: [
      "Markdown shortcuts, or just write — both work",
      "Drafts sync across devices; pick up mid-sentence on your phone",
    ],
    url: "postly.com/editor/writing-in-public",
  },
  {
    number: "03",
    title: "Publish, and it is already live",
    description:
      "One button. Your post is online, sent to your email subscribers, and in your RSS feed before you have switched tabs.",
    bullets: [
      "Loads in under a second, on any connection",
      "Connect yourdomain.com whenever you are ready",
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
    title: "Custom domains",
    description:
      "Point your own domain at Postly with two DNS records. Certificates and renewals are handled for you.",
    icon: Globe,
  },
  {
    title: "A fast, clean editor",
    description:
      "Autosave on every keystroke, drag-in images, and keyboard shortcuts that match what you already know.",
    icon: PenLine,
  },
  {
    title: "Built-in analytics",
    description:
      "Privacy-first stats that show what actually got read. No cookie banner, no third-party trackers.",
    icon: ChartNoAxesColumn,
  },
  {
    title: "No ads, ever",
    description:
      "Readers see your writing and nothing else. We are paid by writers, so we never have to sell your audience.",
    icon: ShieldOff,
  },
  {
    title: "RSS and email subscribers",
    description:
      "Every post goes out by email and RSS the moment you publish. Import an existing list in one CSV.",
    icon: Mail,
  },
  {
    title: "Full ownership of your work",
    description:
      "Export every post as Markdown, with images, any time you like. Your domain, your list, your words.",
    icon: Download,
  },
];

export const PUBLICATIONS = [
  "The Kindling",
  "Northwind Review",
  "Field Notes Weekly",
  "Meridian Quarterly",
  "Longform Daily",
  "The Pressroom",
];

export const TESTIMONIALS = [
  {
    quote:
      "I moved four hundred posts off my old setup in an afternoon and have not thought about hosting since. That is the entire point.",
    name: "Nina Alvarez",
    role: "Essayist, Small Hours",
    initials: "NA",
  },
  {
    quote:
      "The editor gets out of the way. I open a tab, write, press publish. My newsletter and my blog are finally the same thing.",
    name: "Daniel Okafor",
    role: "Staff engineer, Compile Time",
    initials: "DO",
  },
  {
    quote:
      "My recipe blog loads in under a second on my mother's ancient phone. Nothing else I tried managed that.",
    name: "Priya Raman",
    role: "Food writer, Ginger & Salt",
    initials: "PR",
  },
];

export const STATS = [
  { value: "10,000+", label: "blogs published" },
  { value: "50M+", label: "words written" },
  { value: "99.9%", label: "uptime, measured monthly" },
];

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

export type Plan = {
  name: string;
  price: { monthly: number; yearly: number } | null;
  priceNote: string;
  tagline: string;
  features: string[];
  cta: string;
  recommended?: boolean;
};

export const PLANS: Plan[] = [
  {
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    priceNote: "Free forever",
    tagline: "Everything you need to get the first post out.",
    features: [
      "yourname.postly.com address",
      "Unlimited posts and drafts",
      "The full editor, no limits",
      "RSS feed and up to 100 email subscribers",
      "Basic analytics",
    ],
    cta: "Start writing — free",
  },
  {
    name: "Pro",
    price: { monthly: 8, yearly: 6 },
    priceNote: "per month",
    tagline: "For writers building a readership of their own.",
    features: [
      "Everything in Free",
      "Your own custom domain, HTTPS included",
      "Unlimited email subscribers",
      "Full analytics and referrer reports",
      "Scheduling, drafts sharing, and custom themes",
      "No Postly badge",
    ],
    cta: "Start 14-day trial",
    recommended: true,
  },
  {
    name: "Publication",
    price: { monthly: 24, yearly: 20 },
    priceNote: "per month",
    tagline: "For multi-author sites and paid newsletters.",
    features: [
      "Everything in Pro",
      "Up to 10 authors with editorial review",
      "Multiple publications on one account",
      "Paid subscriptions via Stripe",
      "Publishing API and webhooks",
      "Priority support from a human",
    ],
    cta: "Talk to us",
  },
];

export const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Examples", href: "#examples" },
      { label: "Custom domains", href: "#features" },
      { label: "Changelog", href: "#blog" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#blog" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Content policy", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
];
