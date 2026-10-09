import { Car, ChevronRight, Smartphone, Trophy, Watch, Zap } from "@oc/icons";
import type { NavHomepageSection } from "@oc/utils";
import { cn } from "@oc/utils";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

interface NavCategory {
  id: string;
  label: string;
  href: string;
  sectionId: string;
  iconName: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Smartphone: Smartphone,
  Car: Car,
  Watch: Watch,
  Zap: Zap,
  Trophy: Trophy,
};

export function CategoryNav({
  navSections,
  defaultActiveSection,
}: {
  navSections: NavHomepageSection[];
  defaultActiveSection: string;
}) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const dynamicCategories: NavCategory[] = navSections.map((section) => {
    if (section.type === "ending_soon") {
      return {
        id: "ending-soon",
        label: t("home.endingSoonNav"),
        href: "#ending-soon",
        sectionId: section.sectionId,
        iconName: "Zap",
      };
    }

    return {
      id: section.category.slug,
      label: section.category.label,
      href: `#${section.category.slug}`,
      sectionId: section.sectionId,
      iconName: section.category.iconName ?? "Trophy",
    };
  });

  useEffect(() => {
    if (defaultActiveSection) {
      setActiveSection(defaultActiveSection);
    }
  }, [defaultActiveSection]);

  useEffect(() => {
    const sections = document.querySelectorAll("[data-section-id]");
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.getAttribute("data-section-id") ?? "");
          }
        });
      },
      {
        rootMargin: "-40% 0px -55% 0px",
        threshold: 0,
      }
    );

    sections.forEach((section) => {
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, [dynamicCategories]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const activeLink = scrollRef.current.querySelector(
      "[data-active='true']"
    ) as HTMLElement | null;
    if (!activeLink) return;

    const containerRect = scrollRef.current.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const offset =
      linkRect.left - containerRect.left - (containerRect.width / 2 - linkRect.width / 2);

    scrollRef.current.scrollTo({ left: scrollRef.current.scrollLeft + offset, behavior: "smooth" });
  }, [activeSection]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (element) {
      const headerHeight = 56 + 35 + 40;
      const top = element.getBoundingClientRect().top + window.scrollY - headerHeight;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  if (dynamicCategories.length === 0) {
    return null;
  }

  return (
    <nav className="sticky top-[91px] z-30 w-full border-b transition-all duration-300 animate-fade-in bg-card/95 backdrop-blur-2xl border-border">
      <div className="oc-container-wide">
        <div className="flex items-center h-10">
          <div ref={scrollRef} className="flex overflow-x-auto touch-manipulation scrollbar-none">
            <div className="flex items-center gap-0.5 w-max">
              {dynamicCategories.map((category) => {
                const Icon = iconMap[category.iconName] || Trophy;
                const isActive = activeSection === category.sectionId;

                return (
                  <a
                    key={category.id}
                    href={category.href}
                    data-active={isActive}
                    onClick={(e) => handleNavClick(e, category.sectionId)}
                    data-umami-event="home:category-nav-click"
                    data-umami-event-category={category.label}
                    className={cn(
                      "group relative flex items-center gap-1.5 px-2.5 py-1 rounded text-sm font-medium transition-all duration-200 flex-shrink-0",
                      isActive ? "text-gold" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{category.label}</span>
                    <span
                      className={cn(
                        "absolute -bottom-px left-1/2 -translate-x-1/2 w-1 h-0.5 rounded-full bg-gold transition-all duration-200",
                        isActive ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </a>
                );
              })}
            </div>
          </div>

          <Link
            href="/competitions"
            data-umami-event="home:category-view-all"
            className="inline-flex md:flex items-center gap-1 text-xs sm:text-sm font-medium text-gold hover:text-gold/80 ml-3 flex-shrink-0 transition-colors"
          >
            <span>{t("home.competitions.viewAll")}</span>
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
