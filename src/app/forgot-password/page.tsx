import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password — Postly",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
