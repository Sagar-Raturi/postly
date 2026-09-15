import type { Metadata } from "next";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = {
  title: "Name your blog — Postly",
};

export default function OnboardingPage() {
  return <OnboardingForm />;
}
