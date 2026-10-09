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
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "general");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const displayFaqs = faqsByCategory[activeCategory] ?? faqsByCategory.general ?? [];

  return (
    <>
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setActiveCategory(cat.id);
              setOpenIndex(null);
            }}
            data-umami-event="faq:category-tab-click"
            data-umami-event-category={cat.id}
            className={cn(
              "px-5 py-2.5 rounded-full text-sm font-semibold transition-all",
              activeCategory === cat.id
                ? "bg-gold text-primary-foreground shadow-lg shadow-gold/20"
                : "bg-card text-muted-foreground hover:text-foreground hover:bg-gold/10 border border-gold/10"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-8">
        {displayFaqs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t("staticPages.faq.noFaqs")}
          </div>
        ) : (
          displayFaqs.map((faq, i) => (
            <div key={i} className="relative overflow-hidden rounded-[1.5rem]">
              <div className="p-1.5 rounded-[1.5rem] bg-white/5 ring-1 ring-white/10 hover:ring-gold/20 transition-all duration-300">
                <div className="rounded-[calc(1.5rem-0.375rem)] bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    className="w-full flex items-center gap-3 px-6 py-5 text-left hover:bg-gold/5 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4 text-gold flex-shrink-0" />
                    <span className="font-semibold text-foreground flex-1 pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 text-gold flex-shrink-0 transition-transform duration-300",
                        openIndex === i && "rotate-180"
                      )}
                    />
                  </button>
                  {openIndex === i && (
                    <div className="px-6 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-white/5 pt-4 whitespace-pre-wrap">
                      {faq.answer}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
