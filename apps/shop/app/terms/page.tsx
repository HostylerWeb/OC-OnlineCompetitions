import type { Metadata } from "next";
import {
  CompanyContactEmail,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_WEBSITE,
  ShopLegalContactList,
} from "@/components/company-details";

export const metadata: Metadata = {
  title: "Terms of Service  -  Online Competitions",
  description:
    "Terms of service governing the use of our website and purchase of products. UK e-commerce terms for premium streetwear.",
  openGraph: {
    title: "Terms of Service  -  Online Competitions",
    description: "Terms of service governing the use of our website and purchase of products.",
  },
};

export default function TermsPage() {
  return (
    <main className="oc-container py-12">
      <div className="mx-auto max-w-3xl">
        <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          Legal
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              1. Introduction
            </h2>
            <p className="mt-3">
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the
              website at {LEGAL_WEBSITE} (the &ldquo;Site&rdquo;) and the purchase of products from{" "}
              {LEGAL_COMPANY_NAME}. By using the Site or placing an order, you agree to be bound
              by these Terms.
            </p>
            <p className="mt-2">
              {LEGAL_COMPANY_NAME} is a company registered in Scotland (company number{" "}
              {LEGAL_COMPANY_NUMBER}). Registered office: {LEGAL_REGISTERED_OFFICE}.
            </p>
            <p className="mt-2">
              If you have any questions about these Terms, please contact us at{" "}
              <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              2. Account Registration
            </h2>
            <p className="mt-3">
              To place an order, you may be required to create an account. You agree to provide
              accurate, current, and complete information during the registration process and to
              update such information as necessary. You are responsible for maintaining the
              confidentiality of your account credentials and for all activities that occur under
              your account.
            </p>
            <p className="mt-2">
              We reserve the right to suspend or terminate your account if we suspect any breach of
              these Terms or any unauthorised use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              3. Product Descriptions and Pricing
            </h2>
            <p className="mt-3">
              We take reasonable care to ensure that all product descriptions, images,
              specifications, and pricing are accurate at the time of listing. However, errors may
              occasionally occur. We reserve the right to correct any errors and to update product
              information without prior notice.
            </p>
            <p className="mt-2">
              All prices displayed on the Site are in pounds sterling (GBP) and include VAT where
              applicable. Shipping costs are calculated at checkout and are not included in the
              listed price unless stated otherwise. Promotional discounts and coupon codes are
              subject to specific terms and may be withdrawn at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              4. Orders and Acceptance
            </h2>
            <p className="mt-3">
              When you place an order, you are making an offer to purchase the products in your
              basket. We will confirm receipt of your order via email. This confirmation does not
              constitute acceptance of your order.
            </p>
            <p className="mt-2">
              Acceptance of your order occurs when we dispatch the products and send you a despatch
              confirmation email. If we are unable to fulfil your order (for example, because a
              product is out of stock or we cannot process your payment), we will inform you and any
              amount charged will be refunded in full.
            </p>
            <p className="mt-2">
              We reserve the right to cancel any order at our discretion, including where we suspect
              fraudulent activity or where an item has been mispriced.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              5. Payment Methods
            </h2>
            <p className="mt-3">
              We accept the following payment methods: Visa, Mastercard, American Express, Apple
              Pay, Google Pay, and cleared bank transfers for wholesale orders.
            </p>
            <p className="mt-2">
              Payment is taken at the time of order. All transactions are processed securely through
              our PCI DSS-compliant payment partners. We do not store your full card details on our
              servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              6. Shipping and Delivery
            </h2>
            <p className="mt-3">
              We aim to dispatch all in-stock orders within 1&ndash;3 business days of order
              confirmation. Delivery times vary by destination:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                UK Standard (2&ndash;5 business days after dispatch) &mdash; free on orders over
                £100
              </li>
              <li>UK Express (next working day after dispatch) &mdash; £6.99</li>
              <li>EU Standard (5&ndash;10 business days after dispatch) &mdash; £15</li>
              <li>International (10&ndash;20 business days after dispatch) &mdash; £25</li>
            </ul>
            <p className="mt-2">
              Risk in the products passes to you upon delivery. You are responsible for any customs
              duties, import taxes, or brokerage fees that may apply to international orders.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              7. Returns and Refunds
            </h2>
            <p className="mt-3">
              You have the right to cancel your order and return any unused, unworn products within
              14 calendar days of receiving your order, in accordance with the Consumer Contracts
              Regulations 2013.
            </p>
            <p className="mt-2">
              To be eligible for a return, items must be in their original condition with all tags
              attached. We recommend trying on products carefully before removing tags. Products
              that show signs of wear, washing, or damage will not be accepted.
            </p>
            <p className="mt-2">
              To initiate a return, please contact us at{" "}
              <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />{" "}
              with your order number. We will provide a returns address and instructions. Return
              shipping costs are borne by the customer unless the item is faulty or incorrect.
            </p>
            <p className="mt-2">
              Refunds will be processed within 14 business days of receiving the returned items and
              will be issued to the original payment method. Faulty or incorrectly shipped items
              will be refunded in full, including return shipping costs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              8. Limitation of Liability
            </h2>
            <p className="mt-3">
              To the fullest extent permitted by Scottish law, {LEGAL_COMPANY_NAME} shall not be
              liable for any indirect, incidental, or consequential damages arising out of or in
              connection with the use of the Site or the purchase of products, including but not
              limited to loss of profits, data, or business opportunity.
            </p>
            <p className="mt-2">
              Our total liability to you in respect of any claim shall not exceed the total amount
              paid by you for the products giving rise to the claim. Nothing in these Terms excludes
              or limits our liability for death or personal injury caused by our negligence, fraud,
              or any other liability that cannot be excluded by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              9. Intellectual Property
            </h2>
            <p className="mt-3">
              The name &ldquo;OC&rdquo;, the OC logo, and all related product names,
              designs, graphics, slogans, and trade dress are trademarks or registered trademarks of
              {LEGAL_COMPANY_NAME}. All content on the Site, including text, images, graphics,
              videos, and software, is the property of {LEGAL_COMPANY_NAME} or its licensors and
              is protected by copyright and other intellectual property laws.
            </p>
            <p className="mt-2">
              You may not reproduce, distribute, modify, create derivative works from, or exploit
              any content from the Site without our prior written consent. Unauthorised use of our
              trademarks or intellectual property may result in legal action.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              10. Governing Law
            </h2>
            <p className="mt-3">
              These Terms and any disputes arising out of or in connection with them (including
              non-contractual disputes) shall be governed by and construed in accordance with the
              laws of Scotland. The courts of Scotland shall have exclusive jurisdiction over any
              disputes.
            </p>
            <p className="mt-2">
              We encourage you to contact us before initiating any proceedings so that we may
              attempt to resolve the matter amicably.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              11. Contact Information
            </h2>
            <p className="mt-3">
              If you have any questions, concerns, or complaints regarding these Terms, please
              contact us:
            </p>
            <ShopLegalContactList />
          </section>
        </div>

        <hr className="my-10 border-border-subtle" />
        <p className="text-xs text-muted-foreground">
          These Terms of Service were last updated on 1 June 2026.
        </p>
      </div>
    </main>
  );
}
