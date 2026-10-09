"use client";

import {
  flattenInfinitePages,
  useInfiniteMyBonusAwardWins,
  useInfiniteMyInstantPrizeWins,
  useInfiniteMyWins,
} from "@oc/api-client";
import { Gift, Star, Trophy } from "@oc/icons";
import type { MyBonusAwardWinDto } from "@oc/types";
import { useMemo, useState } from "react";
import { useData } from "vike-react/useData";
import {
  DashboardEmptyCard,
  DashboardFilterTabs,
  DashboardListSkeleton,
  DashboardListToolbar,
  DashboardListViewModeToggle,
  DashboardPageHeader,
  DashboardSection,
  DashboardVirtualList,
  getDashboardCardRowHeightWithGap,
  getDashboardCompactRowHeightWithGap,
  WinGridRow,
  type WinListItem,
  WinListRow,
} from "@/components/dashboard";
import type { DashboardListViewMode } from "@/components/dashboard/dashboard-list-view-mode";
import { EmptyState } from "@/components/EmptyState";
import { useTranslation } from "@/lib/i18n";
import type { Data } from "./+data";
import { isWinVisibleByStatus, shouldShowGlobalNoWinsState } from "./wins-state";

type WinStatusFilter = "all" | "claimed" | "pending";

const WIN_STATUS_FILTERS = [
  { value: "all" as const, labelKey: "dashboard.wins.all" as const },
  { value: "pending" as const, labelKey: "dashboard.wins.pending" as const },
  { value: "claimed" as const, labelKey: "dashboard.wins.claimed" as const },
] as const;

export default function DashboardWinsView() {
  const { t } = useTranslation();
  const data = useData<Data>();
  const winsInitial = data?.winsPage1?.length
    ? { pages: [{ data: data.winsPage1 }], pageParams: [1] }
    : undefined;
  const instantInitial = data?.instantWinsPage1?.length
    ? { pages: [{ data: data.instantWinsPage1 }], pageParams: [1] }
    : undefined;
  const bonusInitial = data?.bonusWinsPage1?.length
    ? { pages: [{ data: data.bonusWinsPage1 }], pageParams: [1] }
    : undefined;
  const {
    data: winsData,
    isLoading,
    isError,
    refetch: _refetch,
    fetchNextPage: fetchNextWins,
    hasNextPage: hasMoreWins,
    isFetchingNextPage: isFetchingMoreWins,
  } = useInfiniteMyWins(20, { initialData: winsInitial });
  const {
    data: instantWinsData,
    isLoading: instantWinsLoading,
    isError: instantWinsError,
    refetch: _refetchInstantWins,
    fetchNextPage: fetchNextInstantWins,
    hasNextPage: hasMoreInstantWins,
    isFetchingNextPage: isFetchingMoreInstantWins,
  } = useInfiniteMyInstantPrizeWins(20, { initialData: instantInitial });
  const {
    data: bonusWinsData,
    isLoading: bonusWinsLoading,
    isError: bonusWinsError,
    refetch: _refetchBonusWins,
    fetchNextPage: fetchNextBonusWins,
    hasNextPage: hasMoreBonusWins,
    isFetchingNextPage: isFetchingMoreBonusWins,
  } = useInfiniteMyBonusAwardWins(20, { initialData: bonusInitial });
  const allWins = useMemo(() => flattenInfinitePages(winsData?.pages), [winsData?.pages]);
  const allInstantWins = useMemo(
    () => flattenInfinitePages(instantWinsData?.pages),
    [instantWinsData?.pages]
  );
  const allBonusWins = useMemo<MyBonusAwardWinDto[]>(
    () => flattenInfinitePages(bonusWinsData?.pages) ?? [],
    [bonusWinsData?.pages]
  );
  const [instantWinStatusFilter, setInstantWinStatusFilter] = useState<WinStatusFilter>("all");
  const [competitionWinStatusFilter, setCompetitionWinStatusFilter] =
    useState<WinStatusFilter>("all");
  const [bonusWinStatusFilter, setBonusWinStatusFilter] = useState<WinStatusFilter>("all");
  const [viewMode, setViewMode] = useState<DashboardListViewMode>("compact");

  const filteredInstantWins = useMemo(
    () => allInstantWins.filter((win) => isWinVisibleByStatus(win, instantWinStatusFilter)),
    [allInstantWins, instantWinStatusFilter]
  );

  const filteredWins = useMemo(
    () => allWins.filter((win) => isWinVisibleByStatus(win, competitionWinStatusFilter)),
    [allWins, competitionWinStatusFilter]
  );

  const filteredBonusWins = useMemo(
    () => allBonusWins.filter((win) => isWinVisibleByStatus(win, bonusWinStatusFilter)),
    [allBonusWins, bonusWinStatusFilter]
  );

  const listViewMode = viewMode === "grid" ? "card" : viewMode;

  const instantWinsRowProps = useMemo<WinListItem[]>(
    () =>
      filteredInstantWins.map((win) => ({
        id: win._id,
        title: win.prize?.title || t("dashboard.wins.instantPrize"),
        subtitle: win.prize?.description,
        imageUrl: win.prize?.image,
        value: win.prize?.value,
        ticketNumber: win.ticketNumber,
        date: win.wonAt,
        claimed: win.claimed ?? false,
        icon: Star,
      })),
    [filteredInstantWins, t]
  );

  const competitionWinsRowProps = useMemo<WinListItem[]>(
    () =>
      filteredWins.map((win) => ({
        id: win._id,
        title: win.prizeTitle || t("dashboard.wins.prize"),
        subtitle: typeof win.competitionId === "object" ? win.competitionId?.title : undefined,
        imageUrl: win.prizeImageUrl,
        value: win.prizeValue,
        ticketNumber: win.ticketNumber,
        date: win.drawnAt,
        claimed: win.claimed ?? false,
        icon: Trophy,
      })),
    [filteredWins, t]
  );

  const bonusWinsRowProps = useMemo<WinListItem[]>(
    () =>
      filteredBonusWins.map((win) => ({
        id: win._id,
        title: win.prize?.title || t("dashboard.wins.bonusAward"),
        subtitle: win.competition?.title,
        imageUrl: win.prize?.image,
        value: win.prize?.value,
        ticketNumber: win.ticketNumber,
        date: win.wonAt,
        claimed: win.claimed ?? false,
        icon: Gift,
      })),
    [filteredBonusWins, t]
  );

  const noWinsAtAll = shouldShowGlobalNoWinsState({
    winsLoading: isLoading,
    winsError: isError,
    instantWinsLoading,
    instantWinsError,
    bonusWinsLoading,
    bonusWinsError,
    filteredWinsCount: filteredWins.length,
    filteredInstantWinsCount: filteredInstantWins.length,
    filteredBonusWinsCount: filteredBonusWins.length,
  });

  const winsFilterOptions = WIN_STATUS_FILTERS.map((f) => ({
    value: f.value,
    label: t(f.labelKey),
  }));
  const winsFilters = (
    filter: WinStatusFilter,
    setFilter: (v: WinStatusFilter) => void,
    umamiEvent: string
  ) => (
    <DashboardFilterTabs
      value={filter}
      onValueChange={setFilter}
      options={winsFilterOptions}
      umamiEvent={umamiEvent}
    />
  );

  const instantWinsToolbar = (
    <DashboardListToolbar
      filters={winsFilters(
        instantWinStatusFilter,
        setInstantWinStatusFilter,
        "wins:instant-filter-change"
      )}
      actions={
        <DashboardListViewModeToggle
          value={viewMode}
          onChange={setViewMode}
          ariaLabel={t("dashboard.wins.instantWinsAria")}
          umamiEvent="wins:view-mode-toggle"
        />
      }
    />
  );

  const competitionWinsToolbar = (
    <DashboardListToolbar
      filters={winsFilters(
        competitionWinStatusFilter,
        setCompetitionWinStatusFilter,
        "wins:competition-filter-change"
      )}
      actions={
        <DashboardListViewModeToggle
          value={viewMode}
          onChange={setViewMode}
          ariaLabel={t("dashboard.wins.compWinsAria")}
          umamiEvent="wins:view-mode-toggle"
        />
      }
    />
  );

  const bonusWinsToolbar = (
    <DashboardListToolbar
      filters={winsFilters(
        bonusWinStatusFilter,
        setBonusWinStatusFilter,
        "wins:bonus-filter-change"
      )}
      actions={
        <DashboardListViewModeToggle
          value={viewMode}
          onChange={setViewMode}
          ariaLabel={t("dashboard.wins.bonusAwardsAria")}
          umamiEvent="wins:view-mode-toggle"
        />
      }
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title={t("dashboard.wins.heading")}
        subtitle={t("dashboard.wins.subtitle")}
      />

      <DashboardSection
        title={t("dashboard.wins.instantPrizeWins")}
        icon={Star}
        count={filteredInstantWins.length}
        toolbar={instantWinsToolbar}
      >
        {instantWinsLoading ? (
          <DashboardListSkeleton viewMode={viewMode} count={2} entity="win" />
        ) : instantWinsError ? (
          <EmptyState
            icon={Star}
            title={t("dashboard.wins.failedToLoadInstant")}
            description={t("dashboard.wins.failedToLoadInstantDesc")}
            umamiEvent="wins:retry"
          />
        ) : filteredInstantWins.length === 0 ? (
          <EmptyState
            icon={Star}
            title={
              instantWinStatusFilter === "all"
                ? t("dashboard.wins.noInstantWins")
                : t("dashboard.wins.noInstantWinsFiltered", { filter: instantWinStatusFilter })
            }
            description={t("dashboard.wins.noInstantWinsDesc")}
          />
        ) : (
          <DashboardVirtualList
            viewMode={viewMode}
            itemCount={instantWinsRowProps.length}
            listRowComponent={WinListRow}
            gridRowComponent={WinGridRow}
            listRowProps={{ wins: instantWinsRowProps, viewMode: listViewMode }}
            gridRowProps={{ wins: instantWinsRowProps }}
            compactRowHeight={getDashboardCompactRowHeightWithGap("win")}
            cardRowHeight={getDashboardCardRowHeightWithGap("win")}
            isInfinite
            fetchNextPage={fetchNextInstantWins}
            hasMore={hasMoreInstantWins}
            isFetchingNextPage={isFetchingMoreInstantWins}
          />
        )}
      </DashboardSection>

      <DashboardSection
        title={t("dashboard.wins.competitionWins")}
        icon={Trophy}
        count={filteredWins.length}
        toolbar={competitionWinsToolbar}
      >
        {isLoading ? (
          <DashboardListSkeleton viewMode={viewMode} count={3} entity="win" />
        ) : isError ? (
          <EmptyState
            icon={Trophy}
            title={t("dashboard.wins.failedToLoadWins")}
            description={t("dashboard.wins.failedToLoadWinsDesc")}
            umamiEvent="wins:retry"
          />
        ) : filteredWins.length === 0 && noWinsAtAll ? (
          <DashboardEmptyCard
            icon={Trophy}
            title={t("dashboard.wins.noWins")}
            description={t("dashboard.wins.noWinsDesc")}
            action={{ label: t("dashboard.wins.browseCompetitions"), href: "/competitions" }}
          />
        ) : filteredWins.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={
              competitionWinStatusFilter === "all"
                ? t("dashboard.wins.noCompWins")
                : t("dashboard.wins.noCompWinsFiltered", { filter: competitionWinStatusFilter })
            }
            description={t("dashboard.wins.noCompWinsDesc")}
          />
        ) : (
          <DashboardVirtualList
            viewMode={viewMode}
            itemCount={competitionWinsRowProps.length}
            listRowComponent={WinListRow}
            gridRowComponent={WinGridRow}
            listRowProps={{ wins: competitionWinsRowProps, viewMode: listViewMode }}
            gridRowProps={{ wins: competitionWinsRowProps }}
            compactRowHeight={getDashboardCompactRowHeightWithGap("win")}
            cardRowHeight={getDashboardCardRowHeightWithGap("win")}
            isInfinite
            fetchNextPage={fetchNextWins}
            hasMore={hasMoreWins}
            isFetchingNextPage={isFetchingMoreWins}
          />
        )}
      </DashboardSection>

      <DashboardSection
        title={t("dashboard.wins.bonusAwards")}
        icon={Gift}
        count={filteredBonusWins.length}
        toolbar={bonusWinsToolbar}
      >
        {bonusWinsLoading ? (
          <DashboardListSkeleton viewMode={viewMode} count={1} entity="win" />
        ) : bonusWinsError ? (
          <EmptyState
            icon={Gift}
            title={t("dashboard.wins.failedToLoadBonus")}
            description={t("dashboard.wins.failedToLoadBonusDesc")}
            umamiEvent="wins:retry"
          />
        ) : filteredBonusWins.length === 0 && noWinsAtAll ? (
          <DashboardEmptyCard
            icon={Gift}
            title={t("dashboard.wins.noWins")}
            description={t("dashboard.wins.noWinsDesc")}
            action={{ label: t("dashboard.wins.browseCompetitions"), href: "/competitions" }}
          />
        ) : filteredBonusWins.length === 0 ? (
          <EmptyState
            icon={Gift}
            title={
              bonusWinStatusFilter === "all"
                ? t("dashboard.wins.noBonusAwards")
                : t("dashboard.wins.noBonusAwardsFiltered", { filter: bonusWinStatusFilter })
            }
            description={t("dashboard.wins.noBonusAwardsDesc")}
          />
        ) : (
          <DashboardVirtualList
            viewMode={viewMode}
            itemCount={bonusWinsRowProps.length}
            listRowComponent={WinListRow}
            gridRowComponent={WinGridRow}
            listRowProps={{ wins: bonusWinsRowProps, viewMode: listViewMode }}
            gridRowProps={{ wins: bonusWinsRowProps }}
            compactRowHeight={getDashboardCompactRowHeightWithGap("win")}
            cardRowHeight={getDashboardCardRowHeightWithGap("win")}
            isInfinite
            fetchNextPage={fetchNextBonusWins}
            hasMore={hasMoreBonusWins}
            isFetchingNextPage={isFetchingMoreBonusWins}
          />
        )}
      </DashboardSection>
    </div>
  );
}
