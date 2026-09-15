import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in — Postly",
};

export default function LoginPage() {
  // LoginForm reads ?next= with useSearchParams, which Next requires to sit
  // inside a Suspense boundary or the route cannot be prerendered.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
