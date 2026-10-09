import type { Metadata } from "next";
import {
  CompanyContactEmail,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_WEBSITE,
} from "@/components/company-details";

export const metadata: Metadata = {
  title: "Privacy Policy  -  Online Competitions",
  description:
    "Privacy policy explaining how we collect, use, and protect your personal data in compliance with UK GDPR.",
  openGraph: {
    title: "Privacy Policy  -  Online Competitions",
    description: "Privacy policy explaining how we collect, use, and protect your personal data.",
  },
};

export default function PrivacyPage() {
  return (
    <main className="oc-container py-12">
      <div className="mx-auto max-w-3xl">
        <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          Legal
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">1. Who We Are</h2>
            <p className="mt-3">
              {LEGAL_COMPANY_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
              operates the website at {LEGAL_WEBSITE}. We are a company registered in Scotland (company
              number {LEGAL_COMPANY_NUMBER}) with our registered address at {LEGAL_REGISTERED_OFFICE}.
              We are the data controller of your personal data for the purposes of UK
              data protection law.
            </p>
            <p className="mt-2">
              If you have any questions about this policy or how we handle your data, please contact
              our Data Protection Officer at{" "}
              <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              2. Information We Collect
            </h2>
            <p className="mt-3">
              We collect the following categories of personal data when you interact with our Site
              or place an order:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Identity and Contact Data:</strong> full name, email address, phone number,
                billing address, shipping address.
              </li>
              <li>
                <strong>Order Data:</strong> products purchased, order history, transaction IDs,
                amounts paid, and correspondence with our customer service team.
              </li>
              <li>
                <strong>Payment Data:</strong> payment card details (processed directly by our
                payment providers &mdash; we do not store full card numbers).
              </li>
              <li>
                <strong>Account Data:</strong> username, password (hashed), profile information,
                wishlist items, and saved addresses.
              </li>
              <li>
                <strong>Technical Data:</strong> IP address, browser type and version, time zone
                setting, operating system, device type, and browsing behaviour on our Site collected
                via cookies and similar technologies.
              </li>
              <li>
                <strong>Marketing Data:</strong> your preferences for receiving marketing
                communications and your engagement with our emails.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              3. How We Use Your Information
            </h2>
            <p className="mt-3">We use your personal data for the following purposes:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                To process and fulfil your orders, including payment processing, shipping, and
                returns.
              </li>
              <li>
                To communicate with you about your orders, account, and customer service enquiries.
              </li>
              <li>
                To send marketing communications where you have opted in, including product
                launches, exclusive drops, and promotional offers.
              </li>
              <li>To improve and personalise your shopping experience on our Site.</li>
              <li>To detect, prevent, and investigate fraudulent or illegal activity.</li>
              <li>
                To comply with our legal obligations, including tax and record-keeping requirements.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              4. Legal Basis for Processing (UK GDPR)
            </h2>
            <p className="mt-3">We process your personal data on the following lawful bases:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Performance of a contract:</strong> to fulfil orders, process payments, and
                provide customer support.
              </li>
              <li>
                <strong>Legitimate interests:</strong> to improve our Site, prevent fraud, and send
                direct marketing where you have not objected.
              </li>
              <li>
                <strong>Consent:</strong> where we send marketing communications by email or process
                non-essential cookies.
              </li>
              <li>
                <strong>Legal obligation:</strong> to retain transaction records for tax purposes
                and to comply with regulatory requirements.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              5. Data Retention
            </h2>
            <p className="mt-3">
              We retain your personal data only for as long as necessary to fulfil the purposes for
              which it was collected and to comply with legal obligations:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Order data is retained for six years following the end of the financial year in
                which the transaction occurred (to comply with HMRC requirements).
              </li>
              <li>
                Account data is retained until you delete your account or for two years after your
                last interaction with us, whichever is sooner.
              </li>
              <li>Marketing preferences are retained until you withdraw consent or unsubscribe.</li>
              <li>Technical data (e.g. analytics) is retained for a maximum of 26 months.</li>
            </ul>
            <p className="mt-2">
              When data is no longer required, it is securely deleted or anonymised.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">6. Your Rights</h2>
            <p className="mt-3">
              Under UK data protection law, you have the following rights in relation to your
              personal data:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Right of access:</strong> you may request a copy of the personal data we
                hold about you.
              </li>
              <li>
                <strong>Right to rectification:</strong> you may ask us to correct inaccurate or
                incomplete data.
              </li>
              <li>
                <strong>Right to erasure (&ldquo;right to be forgotten&rdquo;):</strong> you may
                request deletion of your personal data where it is no longer necessary for the
                purposes for which it was collected.
              </li>
              <li>
                <strong>Right to restrict processing:</strong> you may ask us to limit how we use
                your data in certain circumstances.
              </li>
              <li>
                <strong>Right to data portability:</strong> you may request a copy of your data in a
                structured, machine-readable format.
              </li>
              <li>
                <strong>Right to object:</strong> you may object to our processing of your data for
                direct marketing or legitimate interests.
              </li>
              <li>
                <strong>Rights relating to automated decision-making:</strong> we do not use fully
                automated decision-making that produces legal effects concerning you.
              </li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us at{" "}
              <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />
              . We will respond within one month. If you are not satisfied with our response, you
              have the right to lodge a complaint with the Information Commissioner&rsquo;s Office
              (ICO).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">7. Cookies</h2>
            <p className="mt-3">
              Our Site uses cookies and similar tracking technologies to enhance your browsing
              experience, analyse site traffic, and serve relevant marketing. Cookies are small text
              files stored on your device.
            </p>
            <p className="mt-2">We use the following categories of cookies:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Essential cookies:</strong> required for the operation of our Site,
                including authentication, basket management, and security. These cannot be disabled.
              </li>
              <li>
                <strong>Analytics cookies:</strong> provided by our analytics partners to help us
                understand how visitors use our Site, which pages are most popular, and how we can
                improve. We use anonymised data wherever possible.
              </li>
              <li>
                <strong>Marketing cookies:</strong> used to deliver relevant advertisements and
                measure the effectiveness of our campaigns. These may be set by our advertising
                partners.
              </li>
            </ul>
            <p className="mt-2">
              You can manage your cookie preferences at any time through your browser settings or
              our cookie consent tool. Disabling certain cookies may affect the functionality of our
              Site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              8. Third-Party Services
            </h2>
            <p className="mt-3">
              We share your personal data with trusted third-party service providers who help us
              operate our business. These include:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Payment processing:</strong> Paytriot processes your payment data in
                accordance with its own privacy policy. We do not store full payment card numbers.
              </li>
              <li>
                <strong>Shipping and fulfilment:</strong> our logistics partners receive your name,
                address, and phone number solely for delivery purposes.
              </li>
              <li>
                <strong>Email and marketing:</strong> we use email service providers to send
                transactional and marketing communications on our behalf.
              </li>
              <li>
                <strong>Analytics and advertising:</strong> analytics and advertising platforms
                receive anonymised or pseudonymised data to help us measure performance and reach
                relevant audiences.
              </li>
              <li>
                <strong>Cloud infrastructure:</strong> our hosting and infrastructure providers
                store data on secure servers within the UK and European Economic Area.
              </li>
            </ul>
            <p className="mt-2">
              We require all third parties to implement appropriate technical and organisational
              measures to protect your data and to process it only for the specific purposes we have
              instructed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              9. International Transfers
            </h2>
            <p className="mt-3">
              Your personal data may be transferred to and processed in countries outside the United
              Kingdom where our third-party service providers operate. Where we transfer your data
              to a country that has not been deemed to provide adequate data protection by the UK
              government, we ensure appropriate safeguards are in place, such as UK International
              Data Transfer Agreements (IDTA) or Binding Corporate Rules.
            </p>
            <p className="mt-2">
              If you would like further information about the safeguards used for international
              transfers, please contact us at{" "}
              <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">10. Contact</h2>
            <p className="mt-3">
              For any questions, concerns, or requests relating to this Privacy Policy or the
              handling of your personal data, please contact us:
            </p>
            <ul className="mt-2 list-none space-y-1 pl-0">
              <li>
                Data Protection Officer:{" "}
                <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />
              </li>
              <li>
                Post: {LEGAL_COMPANY_NAME}, {LEGAL_REGISTERED_OFFICE}
              </li>
            </ul>
            <p className="mt-2">
              You also have the right to contact the Information Commissioner&rsquo;s Office (ICO),
              the UK supervisory authority for data protection:
            </p>
            <ul className="mt-1 list-none space-y-1 pl-0">
              <li>
                Website:{" "}
                <a
                  href="https://ico.org.uk"
                  className="text-gold transition-colors hover:text-gold/80"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ico.org.uk
                </a>
              </li>
              <li>Phone: +44 303 123 1113</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              11. Updates to This Policy
            </h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time to reflect changes in our
              practices, legal requirements, or operational needs. Any changes will be posted on
              this page with an updated &ldquo;Last updated&rdquo; date. Where significant changes
              are made, we will notify you by email or through a prominent notice on our Site.
            </p>
            <p className="mt-2">
              We encourage you to review this policy periodically to stay informed about how we
              protect your personal data.
            </p>
          </section>
        </div>

        <hr className="my-10 border-border-subtle" />
        <p className="text-xs text-muted-foreground">
          This Privacy Policy was last updated on 1 June 2026.
        </p>
      </div>
    </main>
  );
}
