import type { Metadata } from "next";
import { CompanyContactEmail } from "@/components/company-details";

export const metadata: Metadata = {
  title: "Shipping Policy | OC",
  description: "UK and international shipping information for OC premium streetwear.",
};

export default function ShippingPage() {
  return (
    <main className="oc-container py-12">
      <h1 className="text-3xl font-bold tracking-tight">Shipping Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

      <div className="mt-10 space-y-10">
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Processing Time</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            All orders are processed within&nbsp;
            <span className="text-foreground font-medium">1–3 business days</span>. During
            high-demand periods or collection drops, processing may take up to 5 business days. You
            will receive a confirmation email once your order has been dispatched.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">UK Shipping</h2>
          <div className="mt-2 space-y-1 text-muted-foreground leading-relaxed">
            <p>
              <span className="text-foreground font-medium">Standard</span> (3–5 business days) —
              £4.99
            </p>
            <p>
              <span className="text-foreground font-medium">Express</span> (1–2 business days) —
              £8.99
            </p>
            <p>
              <span className="text-foreground font-medium">Free Shipping</span> on all UK orders
              over £75 — automatically applied at checkout.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">International Shipping</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            We ship worldwide. Shipping rates to the EU and Rest of World are calculated at checkout
            based on destination, weight, and selected service. Estimated delivery time is&nbsp;
            <span className="text-foreground font-medium">7–14 business days</span>, excluding
            customs clearance delays.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Tracking</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            Every order is shipped with full tracking. Once dispatched, you will receive an email
            containing your tracking number and a link to monitor your parcel in real time.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">
            Customs, Duties & Taxes
          </h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            International customers are responsible for any customs fees, import duties, or local
            taxes levied by their country. OC is not responsible for delays caused by customs
            processing. Please check your local import regulations before ordering.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">
            Shipping Address Accuracy
          </h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            Please ensure your shipping address is correct at the time of purchase. OC cannot be
            held responsible for parcels delivered to an incorrectly provided address. If you spot
            an error immediately after placing your order, contact us at&nbsp;
            <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />{" "}
            and we will do our best to update it before dispatch.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">
            Missing or Delayed Packages
          </h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            If your tracking information shows delivered but you have not received your parcel,
            please contact the carrier directly with your tracking number. For packages lost in
            transit beyond the estimated delivery window, reach out to&nbsp;
            <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />{" "}
            and we will investigate on your behalf.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">
            PO Box & Military Addresses
          </h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            We are unable to ship to PO Box addresses at this time. Please provide a physical street
            address for delivery.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight text-gold">Contact</h2>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            For any shipping-related enquiries, email us at&nbsp;
            <CompanyContactEmail className="text-gold transition-colors hover:text-gold/80" />
            .
          </p>
        </section>
      </div>
    </main>
  );
}
