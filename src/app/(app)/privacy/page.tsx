import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { CONTACT_EMAIL, OPERATOR_LOCATION, OPERATOR_NAME } from "@/lib/operator";

export const metadata: Metadata = {
  title: "Privacy Policy — Codomain",
  description: "What Codomain collects, why, who it is shared with, and how to have it deleted.",
};

/*
 * Written from what the code actually does, so it has to change when that
 * does. The facts it depends on, and where they live:
 *
 *   what a writer's account stores        postly-backend/accounts/models.py
 *   what a subscriber row stores          blog/models.py (Subscriber)
 *   the three cookies                     accounts/middleware.py, Django
 *   account deletion                      accounts/views.py (DeleteAccountView)
 *   suppression after bounce / complaint  blog/webhooks.py
 *   no analytics, no ad scripts           nothing in src/ loads any
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="Codomain collects what it needs to run your blog and email your readers, and nothing else. There are no ads, no analytics scripts and no selling of data — ever."
    >
      <h2>Who we are</h2>
      <p>
        Codomain is run by {OPERATOR_NAME}, an individual based in{" "}
        {OPERATOR_LOCATION}. In this policy, “Codomain”, “we” and “us” mean
        them. For anything about your data, write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>If you have a Codomain account</h2>
      <p>We store:</p>
      <ul>
        <li>
          <strong>Your email address</strong>, to sign you in and to send you
          account email: address confirmation and password resets.
        </li>
        <li>
          <strong>Your password</strong>, only as a one-way hash (Argon2). We
          cannot read it.
        </li>
        <li>
          <strong>Your display name, bio and profile photo</strong>, which
          appear publicly on your blog because that is what they are for.
        </li>
        <li>
          <strong>Your blog and everything you write in it</strong>, drafts
          included. Drafts are never shown to anyone but you.
        </li>
      </ul>
      <p>
        Your email address is <strong>not</strong> shown on your blog unless
        you switch that on in Settings. When the switch is off, it never
        leaves our servers.
      </p>

      <h2>If you subscribe to a blog</h2>
      <p>
        When you subscribe to a blog hosted on Codomain we store your email
        address, which blog it is for, whether you have confirmed, and when you
        subscribed, confirmed or left. We use it for one thing: emailing you
        when that blog publishes a post.
      </p>
      <ul>
        <li>
          Nothing is sent until you click the link in the confirmation email.
        </li>
        <li>
          Every email has an unsubscribe link that works in one click, with no
          login.
        </li>
        <li>
          The writer of the blog can see your address and export their
          subscriber list. They are responsible for how they use it once it
          leaves Codomain.
        </li>
        <li>
          If you unsubscribe, or an email to you bounces or is marked as spam,
          we keep a record of that so we never email you again from that
          blog — or, after a bounce or spam report, from any blog on Codomain.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Published blogs set no cookies for readers. The Codomain website and
        dashboard use three, all strictly necessary:
      </p>
      <ul>
        <li>
          <code>sessionid</code> keeps you signed in. It cannot be read by
          scripts on the page.
        </li>
        <li>
          <code>csrftoken</code> protects your account against forged
          requests from other sites.
        </li>
        <li>
          <code>postly_auth</code> says only whether you are signed in, so the
          site knows whether to show you the dashboard. It holds no identity.
        </li>
      </ul>
      <p>
        Your light or dark mode choice for the Codomain website is saved in
        your browser, not sent to us. We use no analytics, advertising or
        tracking cookies, so there is no cookie banner to dismiss.
      </p>

      <h2>Who else handles your data</h2>
      <p>
        We do not sell or rent personal data, and we do not share it for
        advertising. A few services run parts of Codomain for us and process
        data only to do that:
      </p>
      <ul>
        <li>
          <strong>Vercel</strong> hosts the website and published blogs.
        </li>
        <li>
          <strong>Render</strong> hosts the application server and database.
        </li>
        <li>
          <strong>Resend</strong> delivers email: account messages and posts
          sent to subscribers.
        </li>
      </ul>
      <p>
        These providers may store and process data outside India, including
        in the United States. Like any website, their servers keep short-lived
        technical logs, such as IP addresses, to keep the service running and
        secure. We may also disclose data where the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Your account:</strong> until you delete it. You can do that
          any time from Settings, and your account, blog, posts and subscriber
          list are removed immediately. Copies in backups are overwritten as
          backups roll over.
        </li>
        <li>
          <strong>A subscription:</strong> until the blog is deleted, apart from
          the record that keeps an unsubscribed or bounced address from being
          emailed again.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Wherever you live, you can ask us what we hold about you, have it
        corrected or deleted, or get a copy of it. Writers can delete their
        account themselves in Settings; subscribers can leave through any
        email’s unsubscribe link. For anything else, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will
        answer within 30 days. If you think we have mishandled your data, you
        can also complain to the data protection authority where you live.
      </p>

      <h2>Children</h2>
      <p>
        Codomain is not meant for anyone under 18, and we do not knowingly hold
        their data. If you think a child has signed up, tell us and we will
        delete the account.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we will update the date at the top of the
        page. If a change affects how we use data we already hold, we will tell
        account holders by email before it takes effect.
      </p>
    </LegalPage>
  );
}
