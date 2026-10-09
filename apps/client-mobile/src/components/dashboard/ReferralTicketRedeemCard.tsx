"use client";

import type { ContextualError } from "@oc/api-client";
import {
  ApiResponseError,
  type CompetitionAvailability,
  resolveContextualErrorFromUnknown,
  useCompetitions,
  useCompetitionsAvailability,
  useMyTicketCountsByCompetition,
  useRedeemReferralTickets,
} from "@oc/api-client";
import { Clock, Minus, Plus, Search, Ticket, Trophy } from "@oc/icons";
import type { Competition } from "@oc/types";
import { CountdownLabel, cn, getAvailableTickets } from "@oc/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GoldOutlineButton } from "@/components/buttons";
import { ContextualErrorMessage } from "@/components/ContextualErrorMessage";
import { Link } from "@/components/Link";
import { useCountdown as useSharedCountdown } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { VirtualList } from "@/components/VirtualList";
import { useTranslation } from "@/lib/i18n";
import {
  dashboardCardClass,
  dashboardCardContentClass,
  dashboardCardHeaderClass,
} from "./dashboardStyles";

const REDEEM_OPTION_HEIGHT = 96;
const REDEEM_OPTION_GAP = 8;
const REDEEM_ROW_HEIGHT = REDEEM_OPTION_HEIGHT + REDEEM_OPTION_GAP;
const REDEEM_LIST_MAX_HEIGHT = 320;
const VIRTUALIZE_THRESHOLD = 8;

export interface CompetitionEligibility {
  selectable: boolean;
  reason?: string;
  maxRedeemQuantity: number;
  availableTickets: number;
  userTickets: number;
  maxTicketsPerUser: number;
}

function getCompetitionId(comp: Competition): string {
  return comp.id ?? comp._id ?? "";
}

function getImageUrl(comp: Competition): string | undefined {
  return comp.prizeImageUrl ?? comp.imageUrl;
}

function getCountdownDate(comp: Competition): string | undefined {
  const date = comp.drawDate ?? comp.endDate;
  if (!date) return undefined;
  return date instanceof Date ? date.toISOString() : date;
}

function formatMaxTicketsReason(
  userTickets: number,
  maxTicketsPerUser: number,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  return t("dashboard.referrals.redeem.alreadyHaveMax", {
    count: userTickets,
    max: maxTicketsPerUser,
  });
}

function isCompetitionEnded(comp: Competition): boolean {
  const endDate = comp.drawDate ?? comp.endDate;
  if (!endDate) return false;
  return new Date(endDate).getTime() <= Date.now();
}

function getCompetitionEligibility(
  competition: Competition,
  awardedTickets: number,
  availability: CompetitionAvailability | undefined,
  userTickets: number,
  t: (key: string, params?: Record<string, string | number>) => string
): CompetitionEligibility {
  const availableTickets = availability?.available ?? getAvailableTickets(competition);
  const maxTicketsPerUser = availability?.maxPerUser ?? competition.maxTicketsPerUser ?? 0;
  const remainingUserCapacity =
    maxTicketsPerUser > 0 ? Math.max(0, maxTicketsPerUser - userTickets) : Number.POSITIVE_INFINITY;

  const maxRedeemQuantity = Math.min(
    awardedTickets,
    availableTickets,
    Number.isFinite(remainingUserCapacity) ? remainingUserCapacity : awardedTickets
  );

  const base = {
    maxRedeemQuantity,
    availableTickets,
    userTickets,
    maxTicketsPerUser,
  };

  if (isCompetitionEnded(competition)) {
    return {
      ...base,
      selectable: false,
      reason: t("dashboard.referrals.redeem.compEnded"),
      maxRedeemQuantity: 0,
    };
  }

  if (availableTickets <= 0) {
    return {
      ...base,
      selectable: false,
      reason: t("dashboard.referrals.redeem.noTicketsLeft"),
      maxRedeemQuantity: 0,
    };
  }

  if (maxTicketsPerUser > 0 && userTickets >= maxTicketsPerUser) {
    return {
      ...base,
      selectable: false,
      reason: formatMaxTicketsReason(userTickets, maxTicketsPerUser, t),
      maxRedeemQuantity: 0,
    };
  }

  if (maxRedeemQuantity <= 0) {
    return {
      ...base,
      selectable: false,
      reason:
        maxTicketsPerUser > 0
          ? formatMaxTicketsReason(userTickets, maxTicketsPerUser, t)
          : t("dashboard.referrals.redeem.cannotRedeem"),
      maxRedeemQuantity: 0,
    };
  }

  return {
    ...base,
    selectable: true,
  };
}

function formatRedeemError(err: unknown, t: (key: string) => string): ContextualError {
  const fallback = t("dashboard.referrals.redeem.failedToRedeem");
  if (err instanceof ApiResponseError) {
    const resolved = resolveContextualErrorFromUnknown(err, fallback);
    if (resolved.code || resolved.action) return resolved;
    if (err.message.length > 0) return { message: err.message, code: err.code };
  }
  if (err instanceof Error && err.message.length > 0) return { message: err.message };
  return { message: fallback };
}

function useCountdown(endDate: string | undefined, enabled: boolean) {
  return useSharedCountdown(endDate, enabled);
}

interface RedeemCompetitionOptionProps {
  competition: Competition;
  eligibility: CompetitionEligibility;
  selected: boolean;
  onSelect: () => void;
}

function RedeemCompetitionOption({
  competition,
  eligibility,
  selected,
  onSelect,
}: RedeemCompetitionOptionProps) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getImageUrl(competition);
  const ticketsLeft = eligibility.availableTickets;
  const countdownDate = getCountdownDate(competition);
  const timeLeft = useCountdown(countdownDate, competition.status === "active");
  const disabled = !eligibility.selectable;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const showImage = imageUrl && !imageFailed;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-disabled={disabled}
      data-umami-event="referrals:redeem-select-competition"
      className={cn(
        "flex h-full w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        disabled
          ? "cursor-not-allowed border-border/50 bg-muted/10 opacity-70"
          : selected
            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
            : "border-border/70 bg-muted/15 hover:border-border hover:bg-muted/25"
      )}
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/30 sm:size-16">
        {showImage ? (
          <img
            src={imageUrl}
            alt=""
            className="object-cover"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Trophy className="size-5 text-muted-foreground/50" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            disabled ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {competition.title}
        </p>
        <div className="mt-1 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {ticketsLeft.toLocaleString()} {t("dashboard.referrals.redeem.ticketsLeft")}
            </span>
            {countdownDate ? (
              <CountdownLabel
                timeLeft={timeLeft}
                endDate={countdownDate}
                size="sm"
                icon={<Clock className="size-3 shrink-0" aria-hidden="true" />}
                className="text-foreground/80"
              />
            ) : null}
          </div>
          {disabled && eligibility.reason ? (
            <p className="text-xs text-destructive/90">{eligibility.reason}</p>
          ) : null}
        </div>
      </div>

      <span
        className={cn(
          "size-4 shrink-0 rounded-full border-2 transition-colors",
          disabled
            ? "border-muted-foreground/20 bg-muted/20"
            : selected
              ? "border-primary bg-primary"
              : "border-muted-foreground/40"
        )}
        aria-hidden="true"
      >
        {selected && !disabled ? (
          <span className="flex size-full items-center justify-center">
            <span className="size-1.5 rounded-full bg-primary-foreground" />
          </span>
        ) : null}
      </span>
    </button>
  );
}

interface RedeemCompetitionRowProps {
  competitions: Competition[];
  eligibilityById: Record<string, CompetitionEligibility>;
  selectedId: string;
  onSelect: (id: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function RedeemCompetitionRow({
  index,
  style,
  competitions,
  eligibilityById,
  selectedId,
  onSelect,
  t: rowT,
}: {
  index: number;
  style: React.CSSProperties;
} & RedeemCompetitionRowProps) {
  const competition = competitions[index];
  if (!competition) return null;

  const id = getCompetitionId(competition);
  const eligibility =
    eligibilityById[id] ??
    getCompetitionEligibility(competition, 0, undefined, 0, (key: string, p?: any) =>
      rowT(key as any, p)
    );

  return (
    <div
      style={{
        ...style,
        height: REDEEM_OPTION_HEIGHT,
        marginTop: index > 0 ? REDEEM_OPTION_GAP : 0,
      }}
    >
      <RedeemCompetitionOption
        competition={competition}
        eligibility={eligibility}
        selected={selectedId === id}
        onSelect={() => onSelect(id)}
      />
    </div>
  );
}

function RedeemCompetitionPickerSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-3"
        >
          <Skeleton className="size-14 shrink-0 rounded-md sm:size-16" shimmer />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4 max-w-[200px]" shimmer />
            <Skeleton className="h-3 w-1/2 max-w-[140px]" shimmer />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface ReferralTicketRedeemCardProps {
  awardedTickets: number;
  onRedeemed: () => void;
}

export function ReferralTicketRedeemCard({
  awardedTickets,
  onRedeemed,
}: ReferralTicketRedeemCardProps) {
  const { t } = useTranslation();
  const { data: competitionsResponse, isLoading: competitionsLoading } = useCompetitions({
    status: "active",
    limit: 100,
  });
  const redeemMutation = useRedeemReferralTickets();
  const [competitionId, setCompetitionId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<ContextualError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeCompetitions = useMemo(
    () => competitionsResponse?.data ?? [],
    [competitionsResponse?.data]
  );

  const competitionIds = useMemo(
    () => activeCompetitions.map(getCompetitionId).filter(Boolean),
    [activeCompetitions]
  );

  const { availabilityByCompetition, isFetching: availabilityFetching } =
    useCompetitionsAvailability(competitionIds);
  const { counts: userTicketCounts, isFetching: userTicketsFetching } =
    useMyTicketCountsByCompetition();

  const eligibilityById = useMemo(() => {
    const map: Record<string, CompetitionEligibility> = {};
    for (const comp of activeCompetitions) {
      const id = getCompetitionId(comp);
      if (!id) continue;
      map[id] = getCompetitionEligibility(
        comp,
        awardedTickets,
        availabilityByCompetition[id],
        userTicketCounts[id] ?? 0,
        (key: string, params?: any) => t(key as any, params)
      );
    }
    return map;
  }, [activeCompetitions, awardedTickets, availabilityByCompetition, userTicketCounts]);

  const sortedCompetitions = useMemo(() => {
    return [...activeCompetitions].sort((a, b) => {
      const aId = getCompetitionId(a);
      const bId = getCompetitionId(b);
      const aSelectable = eligibilityById[aId]?.selectable ?? false;
      const bSelectable = eligibilityById[bId]?.selectable ?? false;
      if (aSelectable !== bSelectable) return aSelectable ? -1 : 1;
      return a.title.localeCompare(b.title, "en-GB");
    });
  }, [activeCompetitions, eligibilityById]);

  const selectableCompetitions = useMemo(
    () => sortedCompetitions.filter((comp) => eligibilityById[getCompetitionId(comp)]?.selectable),
    [sortedCompetitions, eligibilityById]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredCompetitions = useMemo(() => {
    if (!normalizedSearch) return sortedCompetitions;
    return sortedCompetitions.filter((comp) => comp.title.toLowerCase().includes(normalizedSearch));
  }, [sortedCompetitions, normalizedSearch]);

  const selectedCompetition = useMemo(
    () => selectableCompetitions.find((comp) => getCompetitionId(comp) === competitionId),
    [selectableCompetitions, competitionId]
  );

  const selectedEligibility = selectedCompetition
    ? eligibilityById[getCompetitionId(selectedCompetition)]
    : undefined;

  const shouldVirtualize = filteredCompetitions.length > VIRTUALIZE_THRESHOLD;
  const listHeight = Math.min(
    filteredCompetitions.length * REDEEM_ROW_HEIGHT,
    REDEEM_LIST_MAX_HEIGHT
  );

  const maxQuantity = selectedEligibility?.maxRedeemQuantity ?? 0;

  const dataLoading =
    competitionsLoading ||
    (competitionIds.length > 0 && (availabilityFetching || userTicketsFetching));

  useEffect(() => {
    const selectableFiltered = filteredCompetitions.filter(
      (comp) => eligibilityById[getCompetitionId(comp)]?.selectable
    );

    if (selectableFiltered.length === 1) {
      const onlyCompetition = selectableFiltered[0];
      if (onlyCompetition) {
        setCompetitionId(getCompetitionId(onlyCompetition));
      }
    } else if (
      competitionId &&
      !selectableFiltered.some((comp) => getCompetitionId(comp) === competitionId)
    ) {
      setCompetitionId("");
    }
  }, [filteredCompetitions, eligibilityById, competitionId]);

  const handleSelectCompetition = useCallback(
    (id: string) => {
      const eligibility = eligibilityById[id];
      if (!eligibility?.selectable) return;
      setCompetitionId(id);
      setError(null);
      setSuccessMessage(null);
    },
    [eligibilityById]
  );

  useEffect(() => {
    if (maxQuantity > 0 && quantity > maxQuantity) {
      setQuantity(maxQuantity);
    } else if (maxQuantity > 0 && quantity < 1) {
      setQuantity(1);
    }
  }, [maxQuantity, quantity]);

  const handleRedeem = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!competitionId || !selectedCompetition || !selectedEligibility?.selectable) {
      setError({ message: t("dashboard.referrals.redeem.selectCompError") });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError({ message: t("dashboard.referrals.redeem.validQuantityError") });
      return;
    }
    if (quantity > awardedTickets) {
      setError({
        message: t("dashboard.referrals.redeem.onlyHaveTickets", { count: awardedTickets }),
      });
      return;
    }
    if (quantity > maxQuantity) {
      if (
        selectedEligibility.maxTicketsPerUser > 0 &&
        selectedEligibility.userTickets + quantity > selectedEligibility.maxTicketsPerUser
      ) {
        setError({
          message: formatMaxTicketsReason(
            selectedEligibility.userTickets,
            selectedEligibility.maxTicketsPerUser,
            (key: string, p?: any) => t(key as any, p)
          ),
          action: {
            label: t("dashboard.referrals.redeem.viewYourTickets"),
            href: "/dashboard/tickets",
          },
        });
      } else if (quantity > selectedEligibility.availableTickets) {
        setError({
          message: t("dashboard.referrals.redeem.onlyAvailableForComp", {
            count: selectedEligibility.availableTickets,
          }),
          action: {
            label: t("dashboard.referrals.redeem.browseCompetitions"),
            href: "/competitions",
          },
        });
      } else {
        setError({
          message: t("dashboard.referrals.redeem.canRedeemUpTo", { count: maxQuantity }),
        });
      }
      return;
    }

    try {
      const response = await redeemMutation.mutateAsync({
        competitionId,
        quantity,
      });
      const ticketNumbers = response.data.ticketNumbers.join(", ");
      setSuccessMessage(
        t("dashboard.referrals.redeem.redeemedSuccess", {
          count: response.data.redeemed,
          ids: ticketNumbers ? `#${ticketNumbers}` : "",
        })
      );
      setQuantity(1);
      onRedeemed();
    } catch (err: unknown) {
      setError(formatRedeemError(err, (key: string) => t(key as any)));
    }
  };

  const canRedeem =
    !redeemMutation.isPending &&
    !dataLoading &&
    selectableCompetitions.length > 0 &&
    !!competitionId &&
    !!selectedEligibility?.selectable &&
    maxQuantity > 0 &&
    quantity >= 1 &&
    quantity <= maxQuantity;

  if (awardedTickets <= 0) return null;

  return (
    <Card className={dashboardCardClass()}>
      <CardHeader className={dashboardCardHeaderClass}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ticket className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("dashboard.referrals.redeem.heading")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t("dashboard.referrals.redeem.description", { count: awardedTickets })}
        </CardDescription>
      </CardHeader>
      <CardContent className={`${dashboardCardContentClass} flex flex-col gap-4`}>
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">
            {t("dashboard.referrals.redeem.chooseCompetition")}
          </Label>
          {competitionsLoading ? (
            <RedeemCompetitionPickerSkeleton />
          ) : activeCompetitions.length === 0 ? (
            <Empty className="rounded-lg border border-dashed border-border/70 bg-muted/10 py-8">
              <EmptyHeader className="gap-2">
                <EmptyMedia variant="icon" className="size-8">
                  <Ticket className="size-4" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-sm">
                  {t("dashboard.referrals.redeem.noActiveCompetitions")}
                </EmptyTitle>
                <EmptyDescription className="text-xs">
                  {t("dashboard.referrals.redeem.noActiveCompsDesc")}
                </EmptyDescription>
                <Link
                  href="/competitions"
                  data-umami-event="referrals:redeem-browse"
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 mt-1"
                >
                  {t("dashboard.referrals.redeem.browseCompetitions")}
                </Link>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg">
              <InputGroup className="h-9">
                <InputGroupAddon align="inline-start">
                  <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  placeholder={t("dashboard.referrals.redeem.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-label={t("dashboard.referrals.redeem.searchAria")}
                  data-umami-event="referrals:redeem-search"
                />
              </InputGroup>

              {filteredCompetitions.length === 0 ? (
                <Empty className="rounded-lg border border-dashed border-border/70 bg-muted/10 py-6">
                  <EmptyHeader className="gap-2">
                    <EmptyMedia variant="icon" className="size-8">
                      <Search className="size-4" aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">
                      {t("dashboard.referrals.redeem.noSearchResults")}
                    </EmptyTitle>
                    <EmptyDescription className="text-xs">
                      {t("dashboard.referrals.redeem.noSearchResultsDesc")}
                    </EmptyDescription>
                    {normalizedSearch ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={() => setSearchQuery("")}
                      >
                        {t("dashboard.referrals.redeem.clearSearch")}
                      </Button>
                    ) : null}
                  </EmptyHeader>
                </Empty>
              ) : shouldVirtualize ? (
                <div
                  className="max-h-[min(320px,50vh)] overflow-hidden rounded-lg border border-border/60 p-1 overscroll-contain"
                  role="listbox"
                  aria-label={t("dashboard.referrals.redeem.activeCompsAria")}
                >
                  <VirtualList<RedeemCompetitionRowProps>
                    rowCount={filteredCompetitions.length}
                    rowHeight={REDEEM_ROW_HEIGHT}
                    rowComponent={RedeemCompetitionRow}
                    rowProps={{
                      competitions: filteredCompetitions,
                      eligibilityById,
                      selectedId: competitionId,
                      onSelect: handleSelectCompetition,
                      t: (key: string, p?: any) => t(key as any, p),
                    }}
                    height={listHeight}
                    className="overscroll-contain"
                  />
                </div>
              ) : (
                <div
                  className="flex max-h-[min(320px,50vh)] flex-col gap-2 overflow-y-auto overscroll-contain rounded-lg border border-border/60 p-1"
                  role="listbox"
                  aria-label={t("dashboard.referrals.redeem.activeCompsAria")}
                >
                  {filteredCompetitions.map((comp) => {
                    const id = getCompetitionId(comp);
                    const eligibility =
                      eligibilityById[id] ??
                      getCompetitionEligibility(
                        comp,
                        awardedTickets,
                        undefined,
                        0,
                        (key: string, p?: any) => t(key as any, p)
                      );
                    return (
                      <RedeemCompetitionOption
                        key={id}
                        competition={comp}
                        eligibility={eligibility}
                        selected={competitionId === id}
                        onSelect={() => handleSelectCompetition(id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {activeCompetitions.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t("dashboard.referrals.redeem.howManyTickets")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {competitionId && maxQuantity > 0 ? (
                  <>
                    {t("dashboard.referrals.redeem.upToDraw", { count: maxQuantity })}
                    {maxQuantity < awardedTickets ? (
                      <span className="text-muted-foreground/80">
                        {t("dashboard.referrals.redeem.walletInfo", { count: awardedTickets })}
                      </span>
                    ) : null}
                    {selectedEligibility &&
                    selectedEligibility.maxTicketsPerUser > 0 &&
                    selectedEligibility.userTickets > 0 ? (
                      <span className="text-muted-foreground/80">
                        {t("dashboard.referrals.redeem.userTickets", {
                          count: selectedEligibility.userTickets,
                        })}
                      </span>
                    ) : null}
                  </>
                ) : selectableCompetitions.length === 0 ? (
                  t("dashboard.referrals.redeem.noSelectableComps")
                ) : (
                  t("dashboard.referrals.redeem.selectCompToChoose")
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <GoldOutlineButton
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  disabled={
                    redeemMutation.isPending || !competitionId || maxQuantity <= 0 || quantity <= 1
                  }
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label={t("dashboard.referrals.redeem.useOneLess")}
                  data-umami-event="referrals:redeem-qty-decrement"
                >
                  <Minus className="size-4" />
                </GoldOutlineButton>
                <span
                  className="w-10 text-center text-sm font-semibold tabular-nums"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {quantity}
                </span>
                <GoldOutlineButton
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  disabled={
                    redeemMutation.isPending ||
                    !competitionId ||
                    maxQuantity <= 0 ||
                    quantity >= maxQuantity
                  }
                  onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                  aria-label={t("dashboard.referrals.redeem.useOneMore")}
                  data-umami-event="referrals:redeem-qty-increment"
                >
                  <Plus className="size-4" />
                </GoldOutlineButton>
              </div>

              <Button
                type="button"
                onClick={handleRedeem}
                disabled={!canRedeem}
                data-umami-event="referrals:redeem-submit"
                data-umami-event-quantity={quantity}
                className="min-w-[9.5rem] flex-1 sm:ml-auto sm:flex-none"
              >
                {redeemMutation.isPending
                  ? t("dashboard.referrals.redeem.redeeming")
                  : t("dashboard.referrals.redeem.redeemTickets")}
              </Button>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                <ContextualErrorMessage error={error} />
              </p>
            ) : null}
            {successMessage ? (
              <p role="status" className="text-sm text-success">
                {successMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
