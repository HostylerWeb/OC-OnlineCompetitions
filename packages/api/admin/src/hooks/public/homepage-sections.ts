"use client";
import type { Competition } from "@oc/types";
import {
  type ResolvedHomepageSection,
  resolveHomepageNavSections,
  resolveHomepageSections,
} from "@oc/utils";
import { useMemo } from "react";
import { useCompetitionCategories } from "./categories";
import { useCompetitions } from "./competitions";
import { useEndingSoonCompetitions } from "./ending-soon-competitions";
import { useHomepageLayoutSettings } from "./homepage-layout-settings";

export function useHomepageSections(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { data: layoutResponse, ...layoutQuery } = useHomepageLayoutSettings();
  const { data: categoriesResponse, ...categoriesQuery } = useCompetitionCategories();
  const { data: compsResponse, ...compsQuery } = useCompetitions({ limit: 24, enabled });
  const { competitions: endingSoon, ...endingSoonQuery } = useEndingSoonCompetitions({ enabled });

  const categories = categoriesResponse?.data ?? [];
  const allComps = compsResponse?.data ?? [];

  const competitionsByCategory = useMemo(() => {
    const map: Record<string, Competition[]> = {};
    for (const cat of categories) {
      map[cat.slug] = [];
    }
    for (const comp of allComps) {
      const slug = comp.category;
      if (slug && map[slug]) {
        map[slug].push(comp);
      }
    }
    return map;
  }, [categories, allComps]);

  const categoriesWithComps = useMemo(
    () =>
      categories.filter(
        (cat) => cat.isActive !== false && (competitionsByCategory[cat.slug]?.length ?? 0) > 0
      ),
    [categories, competitionsByCategory]
  );

  const layout = layoutResponse?.data;
  const hasEndingSoon = endingSoon.length > 0;

  const sections = useMemo(
    (): ResolvedHomepageSection[] =>
      resolveHomepageSections(layout, {
        hasEndingSoon,
        categoriesWithComps,
      }),
    [layout, hasEndingSoon, categoriesWithComps]
  );

  const navSections = useMemo(
    () =>
      resolveHomepageNavSections(layout, {
        hasEndingSoon,
        categoriesWithComps,
      }),
    [layout, hasEndingSoon, categoriesWithComps]
  );

  const defaultActiveSection = navSections[0]?.sectionId ?? "";

  return {
    layout,
    sections,
    navSections,
    defaultActiveSection,
    categories,
    categoriesWithComps,
    competitionsByCategory,
    endingSoon,
    allComps,
    isLoading:
      layoutQuery.isLoading ||
      categoriesQuery.isLoading ||
      compsQuery.isLoading ||
      endingSoonQuery.isLoading,
    isError:
      layoutQuery.isError ||
      categoriesQuery.isError ||
      compsQuery.isError ||
      endingSoonQuery.isError,
    refetch: async () => {
      await Promise.all([
        layoutQuery.refetch(),
        categoriesQuery.refetch(),
        compsQuery.refetch(),
        endingSoonQuery.refetch(),
      ]);
    },
  };
}

export type { ResolvedHomepageSection };
