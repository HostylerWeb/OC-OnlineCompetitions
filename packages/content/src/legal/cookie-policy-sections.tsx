import type { LegalSection } from "../content-types";
import {
  CompanyEmailLink,
  LEGAL_COMPANY_REGISTRY_EN,
  LEGAL_REGISTERED_OFFICE_POSTAL,
} from "./company-legal";

export const cookiePolicySections = [
  {
    id: "what-are-cookies",
    title: "1. What Are Cookies?",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Cookies are small text files that are placed on your device when you visit a website. They
          help websites remember your preferences, understand how you use the site, and improve your
          overall browsing experience.
        </p>
        <p>
          Cookies are widely used across the internet, and our website uses cookies to provide you
          with a safe, efficient, and personalised experience.
        </p>
      </div>
    ),
  },
  {
    id: "how-we-use",
    title: "2. How We Use Cookies",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>We use cookies for several purposes:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Maintain your session and keep you logged in</li>
          <li>Remember your preferences (such as language and cart items)</li>
          <li>Understand how you use our website through analytics</li>
          <li>Deliver relevant advertising based on your browsing behaviour</li>
          <li>Monitor website performance and loading speeds</li>
        </ul>
      </div>
    ),
  },
  {
    id: "cookie-categories",
    title: "3. Cookie Categories",
    content: (
      <div className="space-y-4 text-muted-foreground">
        <div className="p-4 rounded-xl border border-gold/20 bg-gold/5">
          <h3 className="font-semibold text-foreground mb-1">Necessary Cookies</h3>
          <p className="text-sm mb-2">
            These cookies are essential for the website to function properly. They enable core
            functionality such as security, session management, and accessibility.
          </p>
          <p className="text-sm">
            <strong>Examples:</strong> authenticated session, shopping cart, language preference
          </p>
          <p className="text-sm mt-2">
            These cookies cannot be disabled as they are required for the website to work.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-card">
          <h3 className="font-semibold text-foreground mb-1">Functional Cookies</h3>
          <p className="text-sm mb-2">
            These cookies enable enhanced functionality and personalisation, such as social media
            integration and embedded content from third-party platforms.
          </p>
          <p className="text-sm">
            <strong>Examples:</strong> social media share buttons, YouTube video embeds, live chat
            widgets
          </p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-card">
          <h3 className="font-semibold text-foreground mb-1">Analytics Cookies</h3>
          <p className="text-sm mb-2">
            These cookies help us understand how visitors interact with our website by collecting
            and reporting information anonymously. This helps us improve the site structure and
            content.
          </p>
          <p className="text-sm">
            <strong>Examples:</strong> Google Analytics, Microsoft Clarity
          </p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-card">
          <h3 className="font-semibold text-foreground mb-1">Performance Cookies</h3>
          <p className="text-sm mb-2">
            These cookies monitor how the website performs, including page load times and any errors
            encountered. This data helps us optimise site speed and reliability.
          </p>
          <p className="text-sm">
            <strong>Examples:</strong> Real-user monitoring, error tracking (Sentry)
          </p>
        </div>
        <div className="p-4 rounded-xl border border-white/10 bg-card">
          <h3 className="font-semibold text-foreground mb-1">Advertisement Cookies</h3>
          <p className="text-sm mb-2">
            These cookies are used to deliver relevant advertisements to you based on your interests
            and browsing behaviour. They may also be used to measure the effectiveness of our
            advertising campaigns.
          </p>
          <p className="text-sm">
            <strong>Examples:</strong> Meta Pixel, retargeting campaigns, Taboola
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "third-party",
    title: "4. Third-Party Cookies",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Some cookies are placed by third-party services that appear on our website:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>PayPal</strong> - Payment processing and fraud prevention
          </li>
          <li>
            <strong>Resend</strong> - Email delivery service
          </li>
          <li>
            <strong>Google Analytics</strong> - Website traffic and user behaviour analysis
          </li>
          <li>
            <strong>Meta Pixel</strong> - Advertising and conversion tracking
          </li>
          <li>
            <strong>Microsoft Clarity</strong> - User session recording and heatmaps
          </li>
          <li>
            <strong>Klaviyo</strong> - Email marketing and customer preferences
          </li>
          <li>
            <strong>Sentry</strong> - Application error monitoring
          </li>
        </ul>
        <p className="mt-3">
          Third-party cookies are governed by the respective privacy policies of each provider.
        </p>
      </div>
    ),
  },
  {
    id: "managing-preferences",
    title: "5. Managing Your Preferences",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          When you first visit our website, you will be shown a cookie consent banner where you can
          choose which categories of cookies you consent to.
        </p>
        <p>You can change your preferences at any time by:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Clicking "Cookie Preferences" in our footer</li>
          <li>
            Revisiting the cookie consent banner (clearing your saved preferences will show it
            again)
          </li>
          <li>Adjusting your browser settings to manage or block cookies</li>
        </ul>
        <p className="mt-3">
          Please note that disabling certain cookies may affect the functionality of our website.
        </p>
      </div>
    ),
  },
  {
    id: "updates",
    title: "6. Updates to This Policy",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          We may update this Cookie Policy from time to time to reflect changes in our cookie usage
          or legal requirements. Any changes will be posted on this page with an updated &quot;Last
          updated&quot; date.
        </p>
      </div>
    ),
  },
  {
    id: "contact",
    title: "7. Contact Us",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>If you have questions about our use of cookies, please contact us:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            Email:{" "}
            <CompanyEmailLink />
          </li>
          <li>Company: {LEGAL_COMPANY_REGISTRY_EN}</li>
          <li>
            Registered office: {LEGAL_REGISTERED_OFFICE_POSTAL}
          </li>
        </ul>
      </div>
    ),
  },
];

export type { LegalSection };
