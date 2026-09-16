import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmail } from "@/components/auth/verify-email";

export const metadata: Metadata = {
  title: "Confirm your email — Postly",
};

export default function VerifyEmailPage() {
  // Reads ?key= and ?email= from the link in the confirmation email.
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
