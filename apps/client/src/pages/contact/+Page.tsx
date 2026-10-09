"use client";

import { useContactForm } from "@oc/api-client";
import {
  CONTACT_INFO_CARDS as CONTACT_INFO_CARDS_EN,
  contactFooterNote as contactFooterNoteEN,
  contactHero as contactHeroEN,
} from "@oc/content/contact";
import { Building2, Mail, MapPin, Phone, SocialLinksChips } from "@oc/icons";
import { useEffect, useState } from "react";
import { GoldButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";

const ICON_MAP = {
  Email: Mail,
  Phone,
  Telefon: Phone,
  Address: MapPin,
  Adresă: MapPin,
  Registered: Building2,
  Înregistrat: Building2,
} as const;

type InfoCard = (typeof CONTACT_INFO_CARDS_EN)[number];

function ContactInfoGrid({ cards }: { cards: InfoCard[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 lg:mb-10">
      {cards.map(({ label, value, href, subvalue }) => {
        const Icon = ICON_MAP[label as keyof typeof ICON_MAP] ?? Mail;
        const isEmail = label === "Email";
        const content = (
          <div className="flex h-full flex-col gap-3 rounded-2xl border border-gold/10 bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/10">
                <Icon className="h-4 w-4 text-gold" aria-hidden />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
              </p>
            </div>
            <div className="space-y-1.5 min-w-0">
              <p
                className={
                  isEmail
                    ? "text-[15px] sm:text-base font-semibold text-foreground leading-snug break-all"
                    : "text-[15px] sm:text-base font-semibold text-foreground leading-snug"
                }
              >
                {value}
              </p>
              {subvalue ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{subvalue}</p>
              ) : null}
            </div>
          </div>
        );

        return (
          <div key={label} className="min-w-0">
            {href ? (
              <a
                href={href}
                className="block h-full rounded-2xl outline-none transition-colors hover:border-gold/30 focus-visible:ring-2 focus-visible:ring-gold/40"
                data-umami-event="contact:info-link-click"
                data-umami-event-type={label}
              >
                {content}
              </a>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ContactPage() {
  const { t, locale } = useTranslation();
  const contactHero = contactHeroEN;
  const contactFooterNote = contactFooterNoteEN;
  const infoCards = CONTACT_INFO_CARDS_EN;

  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const mutation = useContactForm();

  useEffect(() => {
    if (mutation.isSuccess) {
      setSuccessMsg(t("staticPages.contact.messageSent"));
      setFormData({ name: "", email: "", subject: "", message: "" });
    }
    if (mutation.isError) {
      setErrorMsg(t("staticPages.contact.sendError"));
    }
  }, [mutation.isSuccess, mutation.isError, t]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    mutation.mutate(formData);
  }

  return (
    <div className="oc-container-content pb-10 lg:pb-14 animate-fade-in">
      <div className="py-6 lg:py-12 max-w-3xl mx-auto">
        <header className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-5 ring-1 ring-gold/15">
            <Mail className="w-8 h-8 text-gold" aria-hidden />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4 text-balance">
            {t("staticPages.contact.heading")}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed text-pretty">
            {contactHero.subtitle}
          </p>
        </header>

        <ContactInfoGrid cards={infoCards} />

        <section className="rounded-2xl border border-gold/10 bg-card p-5 sm:p-8 shadow-sm">
          {successMsg && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">
                  {t("staticPages.contact.fullName")}
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t("staticPages.contact.namePlaceholder")}
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="h-11 sm:h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                  {t("staticPages.contact.emailAddress")}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={t("staticPages.contact.emailPlaceholder")}
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="h-11 sm:h-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-xs font-medium text-muted-foreground">
                {t("staticPages.contact.subject")}
              </Label>
              <Input
                id="subject"
                name="subject"
                placeholder={t("staticPages.contact.subjectPlaceholder")}
                required
                value={formData.subject}
                onChange={handleChange}
                className="h-11 sm:h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-xs font-medium text-muted-foreground">
                {t("staticPages.contact.message")}
              </Label>
              <Textarea
                id="message"
                name="message"
                placeholder={t("staticPages.contact.messagePlaceholder")}
                required
                value={formData.message}
                onChange={handleChange}
                rows={4}
                className="min-h-[100px] sm:min-h-[120px] text-sm"
              />
            </div>

            <GoldButton
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
              data-umami-event="contact:form-submit"
            >
              {mutation.isPending
                ? t("staticPages.contact.sending")
                : t("staticPages.contact.sendMessage")}
            </GoldButton>
          </form>
        </section>

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-gold/10 bg-card p-5 sm:p-6">
            <p className="text-sm font-semibold text-foreground">{t("staticPages.contact.followUs")}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              {t("staticPages.contact.followUsSubtitle")}
            </p>
            <SocialLinksChips />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground text-center sm:text-left px-1">
            {contactFooterNote}{" "}
            <Link
              href="/faq"
              className="text-gold hover:underline font-medium"
              data-umami-event="contact:faq-link"
            >
              {t("staticPages.contact.browseFaq")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
