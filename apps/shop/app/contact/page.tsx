import type { Metadata } from "next";
import { CompanyContactEmail, RegisteredOfficeAddress } from "@/components/company-details";
import { CONTACT_PHONE_HOURS } from "@oc/utils";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with OC. General inquiries, order support, returns, and press contacts.",
  openGraph: {
    title: "Contact — Online Competitions",
    description:
      "Get in touch with OC. General inquiries, order support, returns, and press contacts.",
  },
};

export default function ContactPage() {
  return (
    <main className="oc-container py-12">
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          Get in Touch
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">Contact Us</h1>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">
          We&apos;d love to hear from you. Whether it&apos;s a question about your order, a press
          inquiry, or just to say hello — we&apos;re here to help.
        </p>
      </section>

      <section className="mx-auto mt-16 max-w-2xl">
        <h2 className="text-2xl font-bold tracking-tight">Email</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We aim to respond within 24 hours on business days.
        </p>
        <div className="mt-8 space-y-6">
          <ContactRow label="General Inquiries" />
          <ContactRow label="Order Support" />
          <ContactRow label="Returns" />
          <ContactRow label="Press" />
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-2xl">
        <h2 className="text-2xl font-bold tracking-tight">Business Details</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold">Address</h3>
            <RegisteredOfficeAddress className="mt-2 not-italic text-muted-foreground leading-relaxed" />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold">
              Customer Service Hours
            </h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">{CONTACT_PHONE_HOURS}</p>
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-16 max-w-3xl border-t border-border-subtle pt-6 text-center text-xs text-muted-foreground">
        Last updated: June 2026
      </footer>
    </main>
  );
}

function ContactRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border-subtle px-5 py-4 transition-colors hover:border-gold/40">
      <span className="font-medium text-sm">{label}</span>
      <CompanyContactEmail className="text-sm text-gold underline-offset-2 transition-colors hover:underline" />
    </div>
  );
}
