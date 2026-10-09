import type { Metadata } from "next";
import { CompanyContactEmail, CompanyNameAndAddress } from "@/components/company-details";

export const metadata: Metadata = {
  title: "Refund Policy | OC",
  description: "OC return and refund policy for UK-based premium streetwear.",
};

export default function RefundsPage() {
  return (
    <main className="oc-container py-12">
      <h1 className="text-3xl font-bold tracking-tight">Refund Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

      <div className="mt-10 space-y-10">
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Return Window</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            You have&nbsp;
            <span className="text-foreground font-medium">14 calendar days</span> from the date your
            order is delivered to initiate a return. Requests received after this period will not be
            accepted.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Condition Requirements</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            To be eligible for a refund, items must be&nbsp;
            <span className="text-foreground font-medium">unworn, unwashed, unaltered</span>, and in
            their original condition with all tags attached and original packaging included. We
            reserve the right to refuse returns that show signs of wear, washing, or damage.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">
            How to Initiate a Return
          </h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            Email us at&nbsp;
            <CompanyContactEmail />{" "}
            with your order number and the item(s) you wish to return. Our team will respond within
            24 hours with instructions and your return authorisation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Return Shipping</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            Customers are responsible for return shipping costs. A prepaid UK return label can be
            provided for&nbsp;
            <span className="text-foreground font-medium">£3.99</span>, which will be deducted from
            your refund. We recommend using a tracked service for non-UK returns, as OC is not
            responsible for lost return parcels.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Refund Processing</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            Once your return is received and inspected, refunds are processed within&nbsp;
            <span className="text-foreground font-medium">5 business days</span>. The amount will be
            credited back to your original payment method. You will receive a confirmation email
            once the refund has been issued.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Exchanges</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            We do not offer direct exchanges. If you need a different size or colour, please return
            your item for a refund and place a new order. This ensures you receive the correct item
            as quickly as possible.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">
            Defective or Incorrect Items
          </h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            If you receive a defective, damaged, or incorrect item, we will provide a&nbsp;
            <span className="text-foreground font-medium">
              full refund including return shipping costs
            </span>
            . Please include photos of the issue             when contacting&nbsp;
            <CompanyContactEmail />{" "}
            so we can resolve your case promptly.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Non-Returnable Items</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            For hygiene reasons,&nbsp;
            <span className="text-foreground font-medium">face masks</span> cannot be returned. All
            items from the&nbsp;
            <span className="text-foreground font-medium">Founder Collection</span> and&nbsp;
            <span className="text-foreground font-medium">Limited Edition</span> drops are final
            sale and are not eligible for return or refund unless defective.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Sale Items</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            Items purchased on sale are subject to the same 14-day return policy as full-price
            items, provided they meet the condition requirements above.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">
            Contact & Business Address
          </h2>
          <div className="mt-2 space-y-1 text-muted-foreground leading-relaxed">
            <p>
              Email:&nbsp;
              <CompanyContactEmail />
            </p>
            <p>
              <CompanyNameAndAddress />
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
