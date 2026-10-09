import Link from "next/link";
import { BRAND_LOGO_PATH, BRAND_NAME } from "@oc/utils";
import Image from "next/image";
import { ShopFooterLegal } from "@/components/company-details";

const footerLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/shipping", label: "Shipping" },
  { href: "/refunds", label: "Refunds" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function Footer() {
  return (
    <footer className="border-t border-border-subtle mt-16">
      <div className="oc-container py-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src={BRAND_LOGO_PATH}
              alt={BRAND_NAME}
              width={160}
              height={40}
              className="h-10 w-auto max-w-[200px] object-contain md:h-12"
            />
          </Link>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-gold">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-6 text-center text-[10px] text-muted-foreground/60">
          <ShopFooterLegal year={new Date().getFullYear()} />
        </p>
      </div>
    </footer>
  );
}
