import { AuthProvider } from "@/components/auth-provider";

/**
 * The Postly product: marketing homepage, the account flows, and the
 * dashboard. Everything under here may ask who is signed in.
 *
 * Published blogs deliberately sit outside this group — see `[siteSlug]/`
 * and the note in the root layout.
 *
 * A route group adds no path segment, so these routes keep their URLs: this
 * file wraps `/`, `/login`, `/dashboard` and the rest exactly as before.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AuthProvider>{children}</AuthProvider>;
}
