"use client";

import type { AboutSection } from "@oc/content";
import {
  AlertTriangle,
  Building,
  CheckCircle,
  ChevronDown,
  Heart,
  ShieldCheck,
  Sparkles,
} from "@oc/icons";
import { cn } from "@oc/utils";
import { useState } from "react";

const ICON_MAP = {
  Sparkles,
  ShieldCheck,
  Heart,
  Building,
  AlertTriangle,
} as const;

function renderSectionContent(section: AboutSection) {
  if (section.whyChooseItems) {
    return (
      <div className="space-y-4">
        {section.whyChooseItems.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle className="w-4 h-4 text-gold" />
            </div>
            <div>
              <span className="font-semibold text-foreground">{item.title}</span>
              <span className="text-muted-foreground"> — {item.description}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section.companyInfo) {
    const { name, number, address, email } = section.companyInfo;
    return (
      <div className="space-y-3 text-muted-foreground">
        <p>
          <strong className="text-foreground">{name}</strong> is registered in Scotland (Company No.{" "}
          {number}).
        </p>
        <p>Registered Office: {address}</p>
        <p>
          Email:{" "}
          <a href={`mailto:${email}`} className="text-gold hover:underline">
            {email}
          </a>
        </p>
      </div>
    );
  }

  if (section.responsibleGambling) {
    return (
      <div className="space-y-3 text-muted-foreground">
        <p>{section.responsibleGambling.intro}</p>
        <ul className="space-y-2">
          {section.responsibleGambling.items.map((item) => (
            <li key={item.text} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
              <span>
                {item.text}
                {item.link && (
                  <>
                    {" "}
                    <a
                      href={item.link.href}
                      className="text-gold hover:underline"
                      target={item.link.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      {item.link.label}
                    </a>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-muted-foreground">
      {section.paragraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

interface AccordionProps {
  sections: AboutSection[];
}

export default function Accordion({ sections }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3 mb-8">
      {sections.map((section, i) => {
        const Icon = ICON_MAP[section.icon as keyof typeof ICON_MAP] ?? Sparkles;
        const isOpen = openIndex === i;
        return (
          <div key={section.id} className="relative overflow-hidden rounded-[1.5rem]">
            <div
              className={cn(
                "p-1.5 rounded-[1.5rem] bg-white/5 ring-1 ring-white/10 hover:ring-gold/20 transition-all duration-300",
                isOpen && "ring-gold/20"
              )}
            >
              <div className="rounded-[calc(1.5rem-0.375rem)] bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  data-umami-event="about:accordion-toggle"
                  className="w-full flex items-center gap-3 px-6 py-5 text-left hover:bg-gold/5 transition-colors"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0",
                      section.iconClass
                    )}
                  >
                    <Icon className="w-5 h-5 text-gold" />
                  </div>
                  <span className="font-semibold text-foreground flex-1 pr-4">{section.title}</span>
                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-gold flex-shrink-0 transition-transform duration-300",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-white/5 pt-4">
                    {renderSectionContent(section)}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
