import { Navbar } from "@/components/site/navbar";
import { Hero } from "@/components/site/hero";
import { HowItWorks } from "@/components/site/how-it-works";
import { Features } from "@/components/site/features";
import { SocialProof } from "@/components/site/social-proof";
import { Examples } from "@/components/site/examples";
import { Pricing } from "@/components/site/pricing";
import { CtaBanner } from "@/components/site/cta-banner";
import { Footer } from "@/components/site/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <SocialProof />
        <Examples />
        <Pricing />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
