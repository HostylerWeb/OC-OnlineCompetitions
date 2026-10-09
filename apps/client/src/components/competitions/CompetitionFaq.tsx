"use client";

import { HelpCircle } from "@oc/icons";
import type { Competition } from "@oc/types";
import { formatDate, useTranslation } from "@/lib/i18n";

export default function CompetitionFaq({
  competition,
}: {
  competition: Pick<Competition, "drawDate" | "question">;
}) {
  const { t, locale } = useTranslation();
  const hasQuiz = !!competition.question;

  const drawDateAnswer = competition.drawDate
    ? t("competitions.faq.questions.drawScheduled", {
        date: formatDate(competition.drawDate, undefined, locale),
      })
    : t("competitions.faq.questions.drawToBeAnnounced");

  const entryAnswer = hasQuiz
    ? t("competitions.faq.questions.howToEnterAnswerQuiz")
    : t("competitions.faq.questions.howToEnterAnswerNoQuiz");

  const faqs = [
    { question: t("competitions.faq.questions.howToEnter"), answer: entryAnswer },
    {
      question: t("competitions.faq.questions.howWinnerSelected"),
      answer: t("competitions.faq.questions.howWinnerSelectedAnswer"),
    },
    { question: t("competitions.faq.questions.whenDraw"), answer: drawDateAnswer },
    {
      question: t("competitions.faq.questions.howKnowIfWon"),
      answer: t("competitions.faq.questions.howKnowIfWonAnswer"),
    },
    {
      question: t("competitions.faq.questions.deliveryTime"),
      answer: t("competitions.faq.questions.deliveryTimeAnswer"),
    },
  ];

  return (
    <section className="pt-6 lg:pt-8 mt-6 lg:mt-8">
      <div className="relative overflow-hidden rounded-xl lg:rounded-[2rem]">
        <div className="p-1 lg:p-1.5 rounded-xl lg:rounded-[2rem] bg-white/5 ring-1 ring-white/10">
          <div className="rounded-[calc(1.25rem-0.25rem)] lg:rounded-[calc(2rem-0.375rem)] bg-card p-4 lg:p-8">
            <div className="flex items-center gap-2.5 lg:gap-3 mb-4 lg:mb-6">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl bg-gold/10 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 lg:w-5 lg:h-5 text-gold" />
              </div>
              <h2 className="text-lg lg:text-xl font-bold text-foreground">
                {t("competitions.faq.heading")}
              </h2>
            </div>
            <div className="space-y-3 lg:space-y-4">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-white/5 rounded-lg lg:rounded-xl p-3.5 lg:p-5"
                >
                  <p className="font-medium text-sm lg:text-base text-foreground mb-1.5 lg:mb-2">
                    {faq.question}
                  </p>
                  <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
