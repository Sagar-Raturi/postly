"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ensureCsrf,
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  setUnauthorizedHandler,
  signup as apiSignup,
  type SignupInput,
  type User,
} from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  /** True until the first `/auth/user/` call settles. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  signup: (data: SignupInput) => Promise<void>;
  /** Re-read the account, after a display-name change for instance. */
  refresh: () => Promise<void>;
  /**
   * Replace the account with one the API just handed back.
   *
   * For endpoints that answer with the whole user — the avatar ones do —
   * so the header updates on the same tick as the form, without a second
   * round trip to be told what we were already told.
   */
  applyUser: (user: User) => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Read inside the 401 handler without making it a dependency, so the
  // handler is registered once rather than on every navigation.
  const pathnameRef = React.useRef(pathname);
  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      await ensureCsrf();
      const current = await getCurrentUser().catch(() => null);

      if (!cancelled) {
        setUser(current);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // One place decides what an expired session means, for every call in the
  // app. lib/api.ts fires this on any 401 that is not the mount-time check.
  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);

      const path = pathnameRef.current ?? "/";
      const next = path.startsWith("/dashboard")
        ? `?next=${encodeURIComponent(path)}`
        : "";
      router.replace(`/login${next}`);
    });

    return () => setUnauthorizedHandler(null);
  }, [router]);

  const login = React.useCallback(async (email: string, password: string) => {
    const account = await apiLogin(email, password);
    setUser(account);
    return account;
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // Even a failed logout should end the session locally — leaving the
      // UI signed in after someone clicked "log out" is the worse failure.
      setUser(null);
      router.replace("/login");
    }
  }, [router]);

  const signup = React.useCallback(async (data: SignupInput) => {
    // No user is set: verification is mandatory, so the account cannot log
    // in until the emailed link is followed.
    await apiSignup(data);
  }, []);

  const refresh = React.useCallback(async () => {
    setUser(await getCurrentUser().catch(() => null));
  }, []);

  const applyUser = React.useCallback((account: User) => setUser(account), []);

  const value = React.useMemo(
    () => ({ user, loading, login, logout, signup, refresh, applyUser }),
    [user, loading, login, logout, signup, refresh, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Nothing ever changes after hydration, so there is nothing to subscribe to. */
function subscribeToNothing() {
  return () => {};
}

/**
 * The account, as this component is allowed to see it on this render.
 *
 * The server always renders signed out and loading — it has no session to
 * ask about. The provider starts the same way, so it is tempting to assume
 * every consumer's first client render does too. It does not: the provider
 * hydrates with the root, runs its effect and can have the user back before
 * a component further down has hydrated at all. The dashboard nav sits in
 * its own Suspense boundary (it reads the query string), whose HTML streams
 * in after the shell and is hydrated in a later, interruptible pass — on a
 * slow first load, after `/auth/user/` has answered. The nav then hydrated
 * with a user, rendered the account menu where the server had put nothing,
 * and React reported a mismatch.
 *
 * So the answer depends on the reader, not the provider: while a component
 * is hydrating it is told exactly what the server was told, and React
 * re-renders it with the real account as soon as it has hydrated. A
 * component mounted fresh on the client — after a navigation — gets the
 * real value on its first render, with no extra pass.
 */
export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  const hydrated = React.useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return hydrated ? context : { ...context, user: null, loading: true };
}
