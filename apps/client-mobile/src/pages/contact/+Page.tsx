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
  Address: MapPin,
  Registered: Building2,
} as const;

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
  }, [mutation.isSuccess, mutation.isError]);

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
    <>
      <section className="py-8 sm:py-12 border-b border-gold/10">
        <div className="oc-container-medium text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-3 text-balance">
            {t("staticPages.contact.heading")}
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">{contactHero.subtitle}</p>
        </div>
      </section>

      <section className="py-8 sm:py-10">
        <div className="oc-container-medium">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {infoCards.map(({ label, value, href, subvalue }) => {
              const Icon = ICON_MAP[label as keyof typeof ICON_MAP] ?? Mail;
              return (
                <div
                  key={label}
                  className="bg-card rounded-xl border border-gold/10 p-3 sm:p-4 text-center"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gold/10 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gold" />
                  </div>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 sm:mb-2">
                    {label}
                  </p>
                  {href ? (
                    <a
                      href={href}
                      className="text-xs sm:text-sm font-semibold text-gold hover:underline block truncate"
                      data-umami-event="contact:info-link-click"
                      data-umami-event-type={label}
                    >
                      {value}
                    </a>
                  ) : (
                    <>
                      <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug">
                        {value}
                      </p>
                      {subvalue && (
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 sm:mt-1">
                          {subvalue}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-8 border-y border-gold/10">
        <div className="oc-container-medium">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("staticPages.contact.followUs")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("staticPages.contact.followUsSubtitle")}
              </p>
            </div>
            <SocialLinksChips className="sm:gap-2.5" />
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-10">
        <div className="oc-container-narrow">
          <div className="bg-card rounded-xl border border-gold/10 p-5 sm:p-8">
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
          </div>
        </div>
      </section>

      <section className="pb-8 sm:pb-10">
        <div className="oc-container-narrow">
          <div className="mx-auto max-w-sm space-y-3 rounded-xl border border-gold/10 bg-card/50 p-4 text-center sm:p-5">
            <p className="text-xs leading-relaxed text-muted-foreground">{contactFooterNote}</p>
            <div className="h-px bg-gold/10" />
            <p className="text-xs text-muted-foreground">
              {t("staticPages.contact.preferSelfHelp")}{" "}
              <Link
                href="/faq"
                className="text-gold hover:underline whitespace-nowrap font-medium"
                data-umami-event="contact:faq-link"
              >
                {t("staticPages.contact.browseFaq")}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
