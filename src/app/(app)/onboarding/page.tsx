import type { Metadata } from "next";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = {
  title: "Name your blog — Codomain",
};

export default function OnboardingPage() {
  return <OnboardingForm />;
}
