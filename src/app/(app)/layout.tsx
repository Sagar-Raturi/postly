import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";

/**
 * The Postly product: marketing homepage, the account flows, and the
 * dashboard. Everything under here may ask who is signed in.
 *
 * Published blogs deliberately sit outside this group — see `[siteSlug]/`
 * and the note in the root layout. Both providers are here rather than at
 * the root for the same reason: a blog has neither a session nor a Postly
 * theme preference, and should not be paying for either.
 *
 * A route group adds no path segment, so these routes keep their URLs: this
 * file wraps `/`, `/login`, `/dashboard` and the rest exactly as before.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
