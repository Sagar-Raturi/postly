import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal-page";
import { CONTACT_EMAIL, OPERATOR_LOCATION, OPERATOR_NAME } from "@/lib/operator";

export const metadata: Metadata = {
  title: "Terms of Service — Codomain",
  description: "The rules for using Codomain, including what may and may not be published.",
};

/*
 * The content rules sit under id="content" because the footer links to
 * them directly ("Content rules" → /terms#content).
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="The short version: your writing stays yours, you publish only what you have the right to publish, you email only people who asked to hear from you, and Codomain is free and provided as it is while it is young."
    >
      <h2>Agreement</h2>
      <p>
        Codomain is run by {OPERATOR_NAME}, an individual based in{" "}
        {OPERATOR_LOCATION} (“Codomain”, “we”, “us”). By creating an account,
        you agree to these terms. If you do not agree, please do not use
        Codomain. Readers who only read a blog or subscribe to one are covered by
        the <Link href="/privacy">Privacy Policy</Link> rather than these
        terms.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 years old to create an account.</li>
        <li>
          Give a real email address that you control, and keep your password
          to yourself. You are responsible for what happens under your
          account.
        </li>
        <li>
          Each account can have one blog. You cannot change your blog’s
          address yourself once it is chosen, because that would break every
          link to it — email us if it really has to move.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        You own what you write on Codomain. By publishing it, you give us
        permission to store it, show it on your blog, and email it to your
        subscribers — only as needed to run the service. That permission ends
        when you delete the content or your account. We will not sell your
        writing or use it to advertise.
      </p>
      <p>
        You are responsible for what you publish, and you confirm that you
        have the right to publish it, including any images you link to.
      </p>

      <h2 id="content">Content rules</h2>
      <p>You may not use Codomain to publish or send:</p>
      <ul>
        <li>anything illegal in India or where you live;</li>
        <li>sexual content involving minors, of any kind;</li>
        <li>
          harassment, threats, incitement to violence, or attacks on people
          for who they are;
        </li>
        <li>
          someone else’s private information, such as addresses, phone numbers
          or ID documents, without their consent;
        </li>
        <li>work that infringes someone else’s copyright or trademark;</li>
        <li>
          malware, phishing, scams, or pages pretending to be another person
          or organisation;
        </li>
        <li>spam, including pages that exist only to game search engines.</li>
      </ul>
      <p>
        <strong>Email subscribers.</strong> Your list must be made up of people
        who subscribed themselves through your blog. Do not try to add people
        who did not ask, or use Codomain to send email that breaks anti-spam
        law. Codomain limits how much email each blog can send per day, and may
        pause sending that is harming delivery for other writers.
      </p>
      <p>
        If content breaks these rules, we may remove it or suspend the
        account, usually after telling you why. For serious or illegal
        content we may act first and explain afterwards. To report something,
        email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with a
        link to it.
      </p>

      <h2>Copyright complaints</h2>
      <p>
        If you believe something on Codomain infringes your copyright, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with a link to
        it, the work you own, and your contact details. We will review it and
        remove the content where appropriate.
      </p>

      <h2>The service</h2>
      <p>
        Codomain is free during early access. It is new, and it is provided “as
        is” and “as available”: we work to keep it running and your content
        safe, but we cannot promise it will always be available or free of
        errors, and you should keep your own copy of anything you cannot
        afford to lose. We may change or remove features. If we introduce paid
        plans, we will not take away what you already have for free without
        telling you first.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        As far as the law allows, Codomain is not liable for indirect or
        consequential losses, or for lost data, profits or reputation, arising
        from your use of the service. Because the service is free, our total
        liability to you for any claim is limited to ₹1,000. Nothing in these
        terms limits liability that cannot legally be limited.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time from Settings; your blog,
        posts and subscriber list are removed immediately. We may suspend or
        close an account that breaks these terms. We may also close Codomain
        itself — if we do, we will give you at least 30 days’ notice by email.
      </p>

      <h2>Changes and governing law</h2>
      <p>
        If we change these terms, we will update the date at the top of the
        page and email account holders about significant changes before they
        take effect. Continuing to use Codomain after that means you accept the
        new terms.
      </p>
      <p>
        These terms are governed by the laws of India, and the courts of New
        Delhi have jurisdiction over any dispute. Questions go to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
