import type { LegalSection } from "../content-types";
import {
  BRAND_NAME,
  CompanyEmailLink,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_REGISTRY_EN,
  LEGAL_REGISTERED_OFFICE_POSTAL,
} from "./company-legal";

export const privacySections = [
  {
    id: "introduction",
    title: "1. Introduction",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          {LEGAL_COMPANY_NAME} (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed
          to protecting and respecting your privacy. This Privacy Policy explains how we collect,
          use, disclose, and safeguard your information when you use our website and services.
        </p>
        <p>
          This policy complies with the UK General Data Protection Regulation (UK GDPR) and the Data
          Protection Act 2018. Please read this Privacy Policy carefully. By accessing or using our
          services, you acknowledge that you have read, understood, and agree to be bound by all the
          terms of this Privacy Policy.
        </p>
      </div>
    ),
  },
  {
    id: "data-collected",
    title: "2. Information We Collect",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>We collect the following types of information:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Full name, email address, phone number, and postal address</li>
          <li>Date of birth and proof of age information</li>
          <li>Payment and transaction information (processed securely)</li>
          <li>Competition entries and ticket purchase history</li>
          <li>Communication preferences and marketing consent</li>
          <li>
            Usage data and analytics when you visit our website (including device information,
            browsing history, and session statistics)
          </li>
          <li>
            Unique identifiers for advertising (Google Advertiser ID, IDFA) for interest-based
            advertising purposes
          </li>
        </ul>
        <p>
          Unless specified otherwise, all Data requested by this Website is mandatory and failure to
          provide this Data may make it impossible for this Website to provide its services.
        </p>
      </div>
    ),
  },
  {
    id: "how-used",
    title: "3. How We Use Your Information",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>We use your information to:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Process competition entries and ticket purchases</li>
          <li>Notify winners and arrange prize delivery</li>
          <li>Provide customer support and respond to enquiries</li>
          <li>Send promotional communications (with your consent)</li>
          <li>Improve our website and services</li>
          <li>Detect and prevent fraud and malicious activity</li>
          <li>Analyse usage trends and determine the effectiveness of promotional campaigns</li>
        </ul>
        <p className="font-semibold text-foreground mt-4">
          We never sell your personal information.
        </p>
      </div>
    ),
  },
  {
    id: "legal-basis",
    title: "4. Legal Basis for Processing",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>We process your data under the following legal bases:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Contract:</strong> To fulfil our agreement with you when you purchase tickets
          </li>
          <li>
            <strong>Consent:</strong> For marketing communications you have opted into
          </li>
          <li>
            <strong>Legitimate interests:</strong> For fraud prevention, security, service
            improvement, and certain direct marketing activities
          </li>
          <li>
            <strong>Legal obligation:</strong> To comply with applicable laws and regulations
          </li>
        </ul>
        <p className="mt-3">
          When we process your personal information for our legitimate interests, we make sure to
          consider and balance any potential impact on you (both positive and negative), and your
          rights under data protection laws.
        </p>
      </div>
    ),
  },
  {
    id: "data-sharing",
    title: "5. Data Sharing and Third-Party Services",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>We may share your data with the following third-party service providers:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>PayPal</strong> — Payment processing. Their privacy policy governs their use of
            your data.
          </li>
          <li>
            <strong>Resend</strong> — Email delivery service for transactional and marketing emails.
          </li>
          <li>
            <strong>Google Analytics 4</strong> — Website analytics. Personal Data processed: number
            of Users, session statistics, Trackers, Usage Data.{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong>Meta Pixel</strong> — Advertising conversion tracking. Personal Data processed:
            Trackers, Usage Data.{" "}
            <a
              href="https://www.facebook.com/privacy/policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong>Microsoft Clarity</strong> — Heat mapping and session recording. Personal Data
            processed: Usage Data.{" "}
            <a
              href="https://privacy.microsoft.com/privacystatement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong>Klaviyo</strong> — Email marketing. Personal Data processed: country, email
            address, first name, last name, phone number, purchase history.{" "}
            <a
              href="https://www.klaviyo.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong>Sentry</strong> — Error monitoring and infrastructure monitoring.{" "}
            <a
              href="https://sentry.io/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong>Google Fonts</strong> — Typeface visualisation service for displaying content.
          </li>
          <li>
            <strong>Google Cloud CDN</strong> — Traffic optimisation and distribution.
          </li>
        </ul>
        <p className="mt-3">
          We also share data with legal authorities when required by law, and with competition
          partners for prize fulfilment.
        </p>
        <p className="mt-3">
          We require all third parties to handle your data securely and in accordance with
          applicable laws.
        </p>
      </div>
    ),
  },
  {
    id: "advertising",
    title: "6. Interest-Based Advertising",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          We use tracking technologies and advertising services to display personalised
          advertisements based on your interests. These include:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>Meta ads conversion tracking (Meta Pixel)</li>
          <li>Microsoft Advertising Universal Event Tracking</li>
          <li>Taboola advertising service</li>
          <li>Adalyser advertising service</li>
        </ul>
        <p className="mt-3">
          You can opt out of interest-based advertising by visiting the relevant opt-out sections in
          our Cookie Policy or by contacting us at{" "}
          <CompanyEmailLink />
          .
        </p>
      </div>
    ),
  },
  {
    id: "rights",
    title: "7. Your Rights",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Under the UK GDPR and the Data Protection Act 2018, you have the following rights:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Access:</strong> Obtain a copy of the personal data we hold about you
          </li>
          <li>
            <strong>Rectification:</strong> Correct any inaccurate or incomplete information
          </li>
          <li>
            <strong>Erasure:</strong> Request deletion of your data (subject to legal requirements)
          </li>
          <li>
            <strong>Restriction:</strong> Request restriction of processing of your data
          </li>
          <li>
            <strong>Object:</strong> Object to certain processing activities, including direct
            marketing
          </li>
          <li>
            <strong>Portability:</strong> Receive your data in a structured, commonly used format
          </li>
          <li>
            <strong>Withdraw consent:</strong> Withdraw consent at any time where processing is
            based on your consent
          </li>
          <li>
            <strong>Lodge a complaint:</strong> Contact the Information Commissioner&apos;s Office
            (ICO) if you believe we have not handled your data properly — visit{" "}
            <a
              href="https://ico.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              ico.org.uk
            </a>
          </li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, contact us at{" "}
          <CompanyEmailLink />
          . We will respond within one month.
        </p>
      </div>
    ),
  },
  {
    id: "cookies",
    title: "8. Cookies",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          We use cookies and similar technologies (Trackers) to maintain session state, remember
          your preferences, understand how you use our website, and deliver relevant advertising.
        </p>
        <p>
          When you first visit our website, you will be shown a cookie consent banner where you can
          choose which categories of cookies you consent to.
        </p>
        <p>
          Essential cookies are required for the website to function properly and are always active.
          Optional cookies require your consent and can be managed through your browser settings or
          by revisiting our cookie preferences.
        </p>
        <p>
          For full details on the cookies we use and how to manage your preferences, please see our{" "}
          <a href="/cookie-policy" className="text-gold hover:underline">
            Cookie Policy
          </a>
          .
        </p>
      </div>
    ),
  },
  {
    id: "security",
    title: "9. Data Security",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          We implement appropriate security measures to protect your personal data against
          unauthorized access, disclosure, modification, or destruction. These include SSL
          encryption, secure servers, and regular security audits.
        </p>
        <p>
          While we strive to protect your information, no method of transmission over the internet
          is 100% secure. We cannot guarantee absolute security.
        </p>
      </div>
    ),
  },
  {
    id: "retention",
    title: "10. Data Retention",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          We retain your personal data only for as long as necessary to fulfil the purposes for
          which it was collected, including to satisfy any legal, accounting, or reporting
          requirements.
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Competition entries and purchase history:</strong> Retained for 7 years after
            your last activity for legal and accounting purposes
          </li>
          <li>
            <strong>Account data:</strong> Retained until you request deletion or close your account
          </li>
          <li>
            <strong>Marketing preferences:</strong> Retained until you withdraw consent or request
            deletion
          </li>
          <li>
            <strong>Communication records:</strong> Retained for 3 years after the last
            communication
          </li>
        </ul>
        <p className="mt-3">
          After these periods, data is securely deleted or anonymised in accordance with our data
          retention policy. The right of access, the right to erasure, the right to rectification,
          and the right to data portability cannot be enforced after expiration of the retention
          period.
        </p>
      </div>
    ),
  },
  {
    id: "international",
    title: "11. International Data Transfers",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Your personal data may be transferred to and processed in countries other than your own.
          When we transfer data internationally, we ensure appropriate safeguards are in place, such
          as Standard Contractual Clauses or adequacy decisions by the UK Government.
        </p>
        <p>
          You are entitled to learn about the legal basis for Data transfers abroad including to any
          international organisation governed by public international law.
        </p>
      </div>
    ),
  },
  {
    id: "changes",
    title: "12. Changes to This Policy",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          We may update this Privacy Policy from time to time. Any changes will be posted on this
          page with an updated &quot;Last updated&quot; date. We encourage you to review this policy
          periodically to stay informed about how we protect your information.
        </p>
        <p>
          Should the changes affect processing activities performed on the basis of your consent, we
          shall collect new consent from you where required.
        </p>
      </div>
    ),
  },
  {
    id: "contact",
    title: "13. Contact Us",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          If you have any questions about this Privacy Policy or our data practices, please contact
          us:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            Email:{" "}
            <CompanyEmailLink />
          </li>
          <li>
            Post: {BRAND_NAME}, {LEGAL_REGISTERED_OFFICE_POSTAL}
          </li>
          <li>Company: {LEGAL_COMPANY_REGISTRY_EN}</li>
        </ul>
      </div>
    ),
  },
];

export type { LegalSection };
