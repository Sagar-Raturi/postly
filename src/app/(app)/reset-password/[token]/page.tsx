import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password — Postly",
};

export default async function ResetPasswordPage({
  params,
}: PageProps<"/reset-password/[token]">) {
  // params is a Promise in Next 16 and has to be awaited.
  const { token } = await params;

  // The other half of the link, ?uid=, is read from the client component.
  return (
    <Suspense>
      <ResetPasswordForm token={token} />
    </Suspense>
  );
}
