import type { Metadata } from "next";
import { CompanyContactEmail, RegisteredOfficeAddress } from "@/components/company-details";

export const metadata: Metadata = {
  title: "About",
  description:
    "Discover OC — a premium streetwear brand founded in London. Heavyweight fabrics, British design, timeless collections.",
  openGraph: {
    title: "About — Online Competitions",
    description:
      "Discover OC — a premium streetwear brand founded in London. Heavyweight fabrics, British design, timeless collections.",
  },
};

export default function AboutPage() {
  return (
    <main className="oc-container py-12">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold">
          Our Story
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          Built in London. Made to Last.
        </h1>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">
          OC was founded with a single belief: streetwear should feel as good as it looks. Every
          piece is engineered from premium materials, cut to a precise fit, and finished with
          details that set it apart.
        </p>
      </section>

      {/* Brand Story */}
      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight">The Brand</h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Born in the heart of London, OC brings together British design sensibility and
          uncompromising quality. We work exclusively with heavyweight fabrics — 500GSM French Terry
          for our hoodies, 280GSM combed-ring spun cotton for tees — because weight translates to
          durability, structure, and a feel that cheap garments can&apos;t replicate.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Every piece features custom-moulded silicone logos and proprietary spine-print graphics
          developed in-house. These aren&apos;t off-the-shelf blanks with a screen-printed logo;
          they are original garments designed from the thread up.
        </p>
      </section>

      {/* Collections */}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight">Collections</h2>

        <div className="mt-8 space-y-10">
          <div>
            <h3 className="text-lg font-semibold text-gold">The Essentials Collection Vol. 1</h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              The debut collection. A tightly curated set of staples — heavyweight hoodies, premium
              tees, accessories — built around the fit and finish that define OC. Every piece is
              designed to be worn hard and hold its shape.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gold">The Founder Collection</h3>
            <p className="mt-2 text-muted-foreground leading-relaxed">
              A limited-edition run where each item is individually numbered. Elevated materials,
              exclusive colourways, and packaging that reflects the care put into every garment.
              Once sold out, these pieces will not return.
            </p>
          </div>
        </div>
      </section>

      {/* Quality */}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight">Quality Commitment</h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          We don&apos;t cut corners. Heavyweight fabrics that hold their shape. Reinforced seams.
          Custom packaging that makes unboxing part of the experience. Every detail — from the
          thread count to the hang tag — is deliberate.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Our quality commitment means every order is inspected before it ships. If it doesn&apos;t
          meet our standard, it doesn&apos;t leave the warehouse.
        </p>
      </section>

      {/* Values */}
      <section className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight">Our Values</h2>
        <ul className="mt-4 space-y-4">
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <div>
              <strong className="font-semibold">Quality Over Quantity</strong>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Small drops, deliberate designs. We&apos;d rather make one great hoodie than ten
                forgettable ones.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <div>
              <strong className="font-semibold">Timeless Design</strong>
              <p className="text-muted-foreground text-sm leading-relaxed">
                No logos for the sake of logos. Clean silhouettes that stay relevant beyond a single
                season.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            <div>
              <strong className="font-semibold">British Design Ethos</strong>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Conceived and designed in London. Every silhouette, every stitch reflects the
                city&apos;s influence.
              </p>
            </div>
          </li>
        </ul>
      </section>

      {/* Contact / Address */}
      <section className="mx-auto mt-16 max-w-3xl border-t border-border-subtle pt-12">
        <h2 className="text-2xl font-bold tracking-tight">Visit Us</h2>
        <RegisteredOfficeAddress className="mt-4 text-muted-foreground leading-relaxed" />
        <p className="mt-4 text-muted-foreground">
          Email: <CompanyContactEmail className="text-gold underline-offset-2 hover:underline" />
        </p>
      </section>

      <footer className="mx-auto mt-16 max-w-3xl border-t border-border-subtle pt-6 text-center text-xs text-muted-foreground">
        Last updated: June 2026
      </footer>
    </main>
  );
}
