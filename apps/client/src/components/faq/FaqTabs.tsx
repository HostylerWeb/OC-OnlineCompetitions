"use client";

import { ChevronDown, HelpCircle } from "@oc/icons";
import { cn } from "@oc/utils";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

interface FaqTabsProps {
  categories: { id: string; name: string }[];
  faqsByCategory: Record<string, { question: string; answer: string }[]>;
}

export default function FaqTabs({ categories, faqsByCategory }: FaqTabsProps) {
  const { t } = useTranslation();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const sections = categories
    .map((cat) => ({ ...cat, faqs: faqsByCategory[cat.id] ?? [] }))
    .filter((section) => section.faqs.length > 0);

  if (sections.length === 0) {
    return (
      <div className="text-center py-8 mb-8 text-muted-foreground">{t("staticPages.faq.noFaqs")}</div>
    );
  }

  return (
    <div className="space-y-12 mb-12">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`faq-${section.id}`}>
          <h2
            id={`faq-${section.id}`}
            className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-4"
          >
            {section.name}
          </h2>
          <div className="space-y-3">
            {section.faqs.map((faq, i) => {
              const key = `${section.id}-${i}`;
              const open = openKey === key;
              return (
                <div key={key} className="relative overflow-hidden rounded-[1.5rem]">
                  <div className="p-1.5 rounded-[1.5rem] bg-white/5 ring-1 ring-white/10 hover:ring-gold/20 transition-all duration-300">
                    <div className="rounded-[calc(1.5rem-0.375rem)] bg-card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenKey(open ? null : key)}
                        className="w-full flex items-center gap-3 px-6 py-5 text-left hover:bg-gold/5 transition-colors"
                        aria-expanded={open}
                      >
                        <HelpCircle className="w-4 h-4 text-gold flex-shrink-0" />
                        <span className="text-base sm:text-lg font-semibold capitalize text-foreground flex-1 pr-4">
                          {faq.question}
                        </span>
                        <ChevronDown
                          className={cn(
                            "w-5 h-5 text-gold flex-shrink-0 transition-transform duration-300",
                            open && "rotate-180"
                          )}
                        />
                      </button>
                      {open && (
                        <div className="px-6 pb-5 text-foreground text-base leading-relaxed border-t border-white/5 pt-4 whitespace-pre-wrap">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
