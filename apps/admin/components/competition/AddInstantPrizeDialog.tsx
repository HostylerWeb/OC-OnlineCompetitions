"use client";

import {
  ApiResponseError,
  api,
  useAdminCompetitionInstantPrizeAssignmentMutations,
  useAdminCompetitions,
  useAdminInstantPrizeCapacity,
  useAdminInstantPrizeTemplateMutations,
  useAdminInstantPrizeTemplates,
} from "@oc/api-admin";
import { Loader2 } from "@oc/icons";
import type {
  AdminCompetition,
  AdminInstantPrize,
  CompetitionInstantPrize,
  UpdateCompetitionInstantPrizePayload,
} from "@oc/types";
import { getAvailableTickets } from "@oc/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AsyncCombobox } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-admin-table-url";
import { InstantPrizeCapacityPanel } from "./InstantPrizeCapacityPanel";
import { WinningTicketNumbersDisplay } from "./WinningTicketNumbersDisplay";
import {
  canSubmitPrizeAssignment,
  isProductPrizeSetup,
  isQuantityControlDisabled,
  type InstantPrizeSetupMode,
} from "./instant-prize-capacity-guards";
import {
  hasAssignFormErrors,
  parseManualTicketNumbersInput,
  validateInstantPrizeAssignForm,
} from "./validateInstantPrizeAssignForm";

function AvailabilityBadge({ competitionId }: { competitionId: string }) {
  const { data } = useAdminCompetitions({ statusFilter: "" });
  const comp = (data?.data ?? []).find((c: AdminCompetition) => c._id === competitionId);
  if (!comp) return null;

  const available = getAvailableTickets(comp);
  const pct = comp.maxTickets ? Math.round((available / comp.maxTickets) * 100) : 0;

  return (
    <FieldDescription>
      {available} / {comp.maxTickets} tickets still available in that competition
      {pct < 20 && available > 0 && <span className="text-destructive"> — running low</span>}
      {available === 0 && <span className="text-destructive"> — sold out</span>}
    </FieldDescription>
  );
}

const FREE_ENTRIES_LABEL = "Tickets per winner";

const PRIZE_NAME_PLACEHOLDER: Record<"cash" | "site_credit" | "physical", string> = {
  cash: "e.g. £50 cash",
  site_credit: "e.g. £10 site credit",
  physical: "e.g. AirPods Pro",
};

function isMongoId(value?: string | null): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

function inferSetupFromInstantPrize(
  ip?: CompetitionInstantPrize["instantPrize"]
): InstantPrizeSetupMode {
  if (ip?.type === "competition_ticket") return "free_tickets";
  const cat = ip?.prizeCategory;
  if (cat === "cash" || cat === "site_credit" || cat === "physical") return cat;
  const t = (ip?.title ?? "").toLowerCase();
  if (t.includes("credit")) return "site_credit";
  if (t.includes("cash")) return "cash";
  return "physical";
}

export function AddPrizeDrawer({
  competitionId,
  open,
  onOpenChange,
  editingCip,
}: {
  competitionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCip?: CompetitionInstantPrize | null;
}) {
  const [setup, setSetup] = useState<InstantPrizeSetupMode>("cash");
  const [selectedPrizeId, setSelectedPrizeId] = useState("");
  const [prizeName, setPrizeName] = useState("");
  const [prizeValue, setPrizeValue] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const debouncedQuantity = useDebouncedValue(quantity);
  const [linkedCompetitionId, setLinkedCompetitionId] = useState("");
  const [ticketCount, setTicketCount] = useState(1);
  const [manualNumbersRaw, setManualNumbersRaw] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [capacityNotice, setCapacityNotice] = useState<string | null>(null);
  const [displayNumbers, setDisplayNumbers] = useState<number[]>([]);
  const [regenerating, setRegenerating] = useState(false);

  const { data: templatesResponse } = useAdminInstantPrizeTemplates({ limit: 200 });
  const templates = (templatesResponse?.data ?? []) as AdminInstantPrize[];
  const { data: competitionsResponse } = useAdminCompetitions({ limit: 100 });
  const allCompetitions = (competitionsResponse?.data ?? []) as AdminCompetition[];
  const selectedComp = allCompetitions.find((c) => c._id === linkedCompetitionId);
  const linkedCompTitle = selectedComp?.title ?? linkedCompetitionId;

  const activeTemplates = templates.filter((t) => {
    if (!t.isActive) return false;
    if (t.type === "competition_ticket" && !t.linkedCompetitionId) return false;
    if (
      t.type === "competition_ticket" &&
      t.linkedCompetition?.status &&
      t.linkedCompetition.status !== "active"
    )
      return false;
    return true;
  });

  const selectedTemplate = templates.find((t) => t._id === selectedPrizeId);

  const isFreeTicketPrize = editingCip
    ? editingCip.instantPrize?.type === "competition_ticket" || setup === "free_tickets"
    : setup === "free_tickets" || selectedTemplate?.type === "competition_ticket";

  const effectiveLinkedId =
    linkedCompetitionId ||
    selectedTemplate?.linkedCompetitionId ||
    editingCip?.instantPrize?.linkedCompetitionId;
  const effectiveTicketCount = isFreeTicketPrize
    ? ticketCount || editingCip?.instantPrize?.ticketCount || selectedTemplate?.ticketCount || 1
    : 1;

  const capacityInstantPrizeId = editingCip
    ? isMongoId(editingCip.instantPrizeId)
      ? editingCip.instantPrizeId
      : undefined
    : setup === "saved" && isMongoId(selectedPrizeId)
      ? selectedPrizeId
      : undefined;

  const capacityParams = useMemo(
    () => ({
      instantPrizeId: capacityInstantPrizeId,
      quantity: debouncedQuantity >= 1 ? debouncedQuantity : undefined,
      linkedCompetitionId:
        isFreeTicketPrize && isMongoId(effectiveLinkedId) ? effectiveLinkedId : undefined,
      ticketCount: isFreeTicketPrize ? effectiveTicketCount : undefined,
      excludeCipId: isMongoId(editingCip?.id) ? editingCip?.id : undefined,
    }),
    [
      editingCip,
      capacityInstantPrizeId,
      debouncedQuantity,
      isFreeTicketPrize,
      effectiveLinkedId,
      effectiveTicketCount,
    ]
  );

  const {
    data: capacityResponse,
    isLoading: capacityLoading,
    isError: hasCapacityError,
    error: capacityError,
  } = useAdminInstantPrizeCapacity(competitionId, capacityParams, {
    enabled: open && !!competitionId,
  });
  const capacity = capacityResponse?.data ?? null;
  const hasAuthoritativeCapacity = !!capacity && !capacityLoading && !hasCapacityError;
  const maxAssignable = capacity?.maxAssignableQty ?? 0;

  const { createMutation, updateMutation } = useAdminCompetitionInstantPrizeAssignmentMutations();
  const { createMutation: createTemplateMutation } = useAdminInstantPrizeTemplateMutations();
  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    createTemplateMutation.isPending ||
    regenerating;

  const minQuantity = editingCip ? Math.max(1, editingCip.claimedCount) : 1;
  const clampedMax = editingCip
    ? Math.max(minQuantity, maxAssignable, editingCip.quantity)
    : Math.max(minQuantity, maxAssignable);

  const resetForm = useCallback(() => {
    setSetup("cash");
    setSelectedPrizeId("");
    setPrizeName("");
    setPrizeValue(0);
    setQuantity(1);
    setLinkedCompetitionId("");
    setTicketCount(1);
    setManualNumbersRaw("");
    setShowAdvanced(false);
    setFieldErrors({});
    setCapacityNotice(null);
    setDisplayNumbers([]);
    setRegenerating(false);
  }, []);

  useEffect(() => {
    if (open) {
      if (editingCip) {
        setSelectedPrizeId("");
        setPrizeName(editingCip.instantPrize?.title ?? "");
        setPrizeValue(editingCip.instantPrize?.value ?? 0);
        setQuantity(Math.max(Math.max(1, editingCip.claimedCount), editingCip.quantity));
        setDisplayNumbers(editingCip.winningEntryNumbers ?? []);
        setSetup(inferSetupFromInstantPrize(editingCip.instantPrize));
        if (editingCip.instantPrize?.type === "competition_ticket") {
          setLinkedCompetitionId(editingCip.instantPrize.linkedCompetitionId ?? "");
          setTicketCount(editingCip.instantPrize.ticketCount ?? 1);
        } else {
          setLinkedCompetitionId("");
          setTicketCount(1);
        }
      } else {
        resetForm();
      }
      setFieldErrors({});
      setCapacityNotice(null);
    }
  }, [open, editingCip, resetForm]);

  useEffect(() => {
    if (!hasAuthoritativeCapacity) return;
    if (debouncedQuantity > clampedMax) {
      setQuantity(clampedMax > 0 ? clampedMax : minQuantity);
      setCapacityNotice(
        capacity?.quantityMessage ??
          `Reduced to ${clampedMax > 0 ? clampedMax : minQuantity} wins to match availability.`
      );
    } else if (capacityNotice && debouncedQuantity <= clampedMax) {
      setCapacityNotice(null);
    }
  }, [
    hasAuthoritativeCapacity,
    debouncedQuantity,
    clampedMax,
    minQuantity,
    capacity,
    capacityNotice,
  ]);

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  const manualParsed = useMemo(() => {
    if (!manualNumbersRaw.trim()) return [] as number[];
    return parseManualTicketNumbersInput(manualNumbersRaw);
  }, [manualNumbersRaw]);

  const manualForValidation =
    manualNumbersRaw.trim() === ""
      ? null
      : manualParsed === null
        ? null
        : manualParsed;

  function buildEditUpdatePayload(): UpdateCompetitionInstantPrizePayload | null {
    if (!editingCip) return null;
    const payload: UpdateCompetitionInstantPrizePayload = {};
    const prevQty = editingCip.quantity;

    if (quantity !== prevQty) {
      if (quantity < prevQty) {
        payload.quantity = quantity;
        payload.absolute = true;
      } else {
        payload.quantity = quantity - prevQty;
      }
    }

    const trimmedName = prizeName.trim();
    if (trimmedName && trimmedName !== (editingCip.instantPrize?.title ?? "")) {
      payload.prizeTitle = trimmedName;
    }

    const prevValue = editingCip.instantPrize?.value ?? 0;
    if (prizeValue !== prevValue) {
      payload.prizeValue = prizeValue;
    }

    if (isProductPrizeSetup(setup)) {
      const currentCategory =
        editingCip.instantPrize?.prizeCategory ??
        inferSetupFromInstantPrize(editingCip.instantPrize);
      if (setup !== currentCategory) {
        payload.prizeCategory = setup;
      }
    }

    if (setup === "free_tickets") {
      if (
        linkedCompetitionId &&
        linkedCompetitionId !== (editingCip.instantPrize?.linkedCompetitionId ?? "")
      ) {
        payload.linkedCompetitionId = linkedCompetitionId;
      }
      if (ticketCount !== (editingCip.instantPrize?.ticketCount ?? 1)) {
        payload.ticketCount = ticketCount;
      }
    }

    return Object.keys(payload).length > 0 ? payload : null;
  }

  async function handleRegenerate() {
    if (!editingCip) return;
    setFieldErrors({});
    try {
      setRegenerating(true);
      const payload: UpdateCompetitionInstantPrizePayload = {
        regenerateWinningNumbers: true,
        ...(buildEditUpdatePayload() ?? {}),
      };
      const result = await updateMutation.mutateAsync({
        id: editingCip.id,
        payload,
      });
      const updated = result.data;
      setDisplayNumbers(updated.winningEntryNumbers ?? []);
      setQuantity(updated.quantity);
      if (updated.quantity !== editingCip.quantity) {
        setCapacityNotice(null);
      }
      toast.success(
        "New random ticket numbers assigned for wins that are not claimed yet. Already-won numbers stay the same."
      );
    } catch (err: unknown) {
      const message =
        err instanceof ApiResponseError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not regenerate numbers";
      toast.error(message);
      setFieldErrors({ form: message });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCip && !hasAuthoritativeCapacity) {
      setFieldErrors({
        form: capacityLoading
          ? "Checking availability… please wait."
          : "Could not verify capacity. Close and try again.",
      });
      return;
    }

    if (manualNumbersRaw.trim() && manualParsed === null) {
      setFieldErrors({ manualTicketNumbers: "Use whole numbers separated by commas" });
      return;
    }

    const errors = validateInstantPrizeAssignForm(
      {
        quantity,
        selectedPrizeId,
        setup,
        linkedCompetitionId,
        ticketCount,
        prizeName,
        manualTicketNumbers: manualForValidation,
      },
      {
        editing: !!editingCip,
        claimedCount: editingCip?.claimedCount ?? 0,
        capacity,
        minQuantity,
      }
    );

    if (hasAssignFormErrors(errors)) {
      setFieldErrors(errors as Record<string, string>);
      return;
    }
    setFieldErrors({});

    try {
      let prizeId = selectedPrizeId;

      if (editingCip) {
        const payload = buildEditUpdatePayload();
        if (!payload) {
          toast.info("No changes to save");
          handleClose();
          return;
        }
        const result = await updateMutation.mutateAsync({
          id: editingCip.id,
          payload,
        });
        setDisplayNumbers(result.data.winningEntryNumbers ?? []);
        toast.success("Instant win prize updated");
      } else {
        if (isProductPrizeSetup(setup)) {
          const result = await createTemplateMutation.mutateAsync({
            title: prizeName.trim(),
            value: prizeValue,
            prizeCategory: setup,
            images: [],
            isActive: true,
            type: "prize",
          });
          prizeId = (result as unknown as { data: { _id: string } }).data._id;
        } else if (setup === "free_tickets") {
          const ticketLabel = ticketCount === 1 ? "Ticket" : "Tickets";
          const result = await createTemplateMutation.mutateAsync({
            title: prizeName.trim() || `Free ${ticketCount} ${ticketLabel} — ${linkedCompTitle}`,
            value: 0,
            images: [],
            isActive: true,
            type: "competition_ticket",
            linkedCompetitionId,
            ticketCount,
          });
          prizeId = (result as unknown as { data: { _id: string } }).data._id;
        }

        await createMutation.mutateAsync({
          payload: {
            instantPrizeId: prizeId,
            quantity,
            competitionId,
            ...(manualParsed && manualParsed.length > 0
              ? { winningEntryNumbers: manualParsed }
              : {}),
          },
        });
        toast.success(
          manualParsed && manualParsed.length > 0
            ? "Instant win prize added with your ticket numbers"
            : "Instant win prize added — winning numbers assigned automatically"
        );
      }
      handleClose();
    } catch (err: unknown) {
      if (err instanceof ApiResponseError) {
        toast.error(err.message);
        setFieldErrors({ form: err.message });
      } else {
        const message = err instanceof Error ? err.message : "Failed to save";
        toast.error(message);
        setFieldErrors({ form: message });
      }
    }
  }

  const capacityErrorMessage =
    capacityError instanceof Error
      ? capacityError.message
      : "Unable to load capacity. Please retry.";

  const quantityControlDisabled = isQuantityControlDisabled({ isPending });

  const canSubmit = canSubmitPrizeAssignment({
    isPending,
    hasAuthoritativeCapacity,
    hasCapacityError,
    maxAssignable,
    minQuantity,
    quantity,
    clampedMax,
    editing: !!editingCip,
    setup,
    selectedPrizeId,
    linkedCompetitionId,
    prizeName,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingCip ? "Edit instant win prize" : "Add instant win prize"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {fieldErrors.form && (
            <Alert variant="destructive">
              <AlertDescription>{fieldErrors.form}</AlertDescription>
            </Alert>
          )}

          <FieldGroup>
            <Field>
              <FieldLabel>Prize Type</FieldLabel>
              <Select
                value={setup}
                onValueChange={(v) => {
                  if (
                    editingCip?.instantPrize?.type === "competition_ticket" &&
                    v !== "free_tickets"
                  ) {
                    toast.error("This assignment is a free-ticket prize. Edit name, target, and counts below.");
                    return;
                  }
                  if (
                    editingCip &&
                    editingCip.instantPrize?.type !== "competition_ticket" &&
                    v === "free_tickets"
                  ) {
                    toast.error("Cannot convert this prize to free tickets after creation.");
                    return;
                  }
                  setSetup(v as InstantPrizeSetupMode);
                  setFieldErrors({});
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!editingCip || editingCip.instantPrize?.type !== "competition_ticket" ? (
                    <>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="site_credit">Site Credit</SelectItem>
                      <SelectItem value="physical">Physical Prize</SelectItem>
                    </>
                  ) : null}
                  {(!editingCip || editingCip.instantPrize?.type === "competition_ticket") && (
                    <SelectItem value="free_tickets">Free Tickets</SelectItem>
                  )}
                  {!editingCip && (
                    <SelectItem value="saved">Pick from Templates</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>

            {isProductPrizeSetup(setup) && (
              <>
                <Field>
                  <FieldLabel htmlFor="prize-name">Prize name</FieldLabel>
                  <Input
                    id="prize-name"
                    value={prizeName}
                    onChange={(e) => setPrizeName(e.target.value)}
                    placeholder={
                      isProductPrizeSetup(setup) ? PRIZE_NAME_PLACEHOLDER[setup] : undefined
                    }
                  />
                  {fieldErrors.prizeName && (
                    <p className="text-xs text-destructive">{fieldErrors.prizeName}</p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="prize-value">Value (£)</FieldLabel>
                  <Input
                    id="prize-value"
                    type="number"
                    min={0}
                    step={0.01}
                    value={prizeValue}
                    onChange={(e) => setPrizeValue(parseFloat(e.target.value) || 0)}
                  />
                </Field>
              </>
            )}

            {setup === "free_tickets" && (
              <>
                <Field>
                  <FieldLabel htmlFor="free-prize-name">Prize name</FieldLabel>
                  <Input
                    id="free-prize-name"
                    value={prizeName}
                    onChange={(e) => setPrizeName(e.target.value)}
                    placeholder={`Free ${ticketCount} tickets — …`}
                  />
                </Field>
                <Field>
                  <FieldLabel>Target competition</FieldLabel>
                  <AsyncCombobox
                    value={linkedCompetitionId}
                    onValueChange={setLinkedCompetitionId}
                    queryKey={editingCip ? "linked-competition-edit" : "linked-competition-free"}
                    fetchOptions={async (search: string) => {
                      const res = await api.get<{ _id: string; title: string }[]>(
                        "/api/admin/competitions",
                        {
                          params: { limit: 20, search, status: "active" },
                        }
                      );
                      return (res.data ?? [])
                        .filter((c) => c._id !== competitionId)
                        .map((c) => ({ value: c._id, label: c.title }));
                    }}
                    placeholder="Search competitions…"
                  />
                  {linkedCompetitionId && (
                    <AvailabilityBadge competitionId={linkedCompetitionId} />
                  )}
                  {fieldErrors.linkedCompetitionId && (
                    <p className="text-xs text-destructive">{fieldErrors.linkedCompetitionId}</p>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="tickets-per-win">{FREE_ENTRIES_LABEL}</FieldLabel>
                  <Input
                    id="tickets-per-win"
                    type="number"
                    min={1}
                    value={ticketCount}
                    onChange={(e) =>
                      setTicketCount(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                  />
                  {fieldErrors.ticketCount && (
                    <p className="text-xs text-destructive">{fieldErrors.ticketCount}</p>
                  )}
                </Field>
              </>
            )}

            {!editingCip && setup === "saved" && (
                <Field>
                  <FieldLabel>Template</FieldLabel>
                  <Select
                    value={selectedPrizeId || undefined}
                    onValueChange={(id) => {
                      setSelectedPrizeId(id);
                      const t = templates.find((x) => x._id === id);
                      if (t?.type === "competition_ticket") {
                        setLinkedCompetitionId(t.linkedCompetitionId ?? "");
                        setTicketCount(t.ticketCount ?? 1);
                      }
                      setFieldErrors({});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a prize…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTemplates.map((t) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.title}
                          {t.type === "competition_ticket" ? " (free tickets)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeTemplates.length === 0 && (
                    <FieldDescription>
                      <Link href="/instant-prizes" className="text-primary underline">
                        Instant Prizes
                      </Link>
                    </FieldDescription>
                  )}
                  {fieldErrors.prize && (
                    <p className="text-xs text-destructive">{fieldErrors.prize}</p>
                  )}
                </Field>
              )}
          </FieldGroup>

          {!editingCip && (
            <InstantPrizeCapacityPanel capacity={capacity} isLoading={capacityLoading} />
          )}

          <div className="min-h-[3rem]" aria-live="polite">
            {hasCapacityError && (
              <Alert variant="destructive">
                <AlertDescription>{capacityErrorMessage}</AlertDescription>
              </Alert>
            )}
            {capacityNotice && !hasCapacityError && (
              <Alert>
                <AlertDescription>{capacityNotice}</AlertDescription>
              </Alert>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="cip-quantity">Instant wins on this competition</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={minQuantity}
                max={clampedMax || quantity || minQuantity}
                value={Math.min(quantity, clampedMax || quantity || minQuantity)}
                disabled={quantityControlDisabled || clampedMax < minQuantity}
                onChange={(e) => {
                  setCapacityNotice(null);
                  setQuantity(parseInt(e.target.value, 10));
                }}
                className="h-2 flex-1 cursor-pointer accent-[hsl(var(--gold))]"
              />
              <Input
                id="cip-quantity"
                type="number"
                className="w-24"
                min={minQuantity}
                max={hasAuthoritativeCapacity ? clampedMax || minQuantity : undefined}
                value={quantity}
                disabled={quantityControlDisabled}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!Number.isFinite(n)) return;
                  if (!editingCip && !hasAuthoritativeCapacity) return;
                  const max = editingCip
                    ? Math.max(minQuantity, clampedMax || n)
                    : clampedMax;
                  const nextQuantity = Math.min(max, Math.max(minQuantity, n));
                  if (!editingCip && nextQuantity !== n) {
                    setCapacityNotice(
                      capacity?.quantityMessage ??
                        `Capped at ${nextQuantity} wins based on availability.`
                    );
                  } else {
                    setCapacityNotice(null);
                  }
                  setQuantity(nextQuantity);
                }}
              />
            </div>
            {editingCip && editingCip.claimedCount > 0 && (
              <FieldDescription>Min {editingCip.claimedCount} (already won)</FieldDescription>
            )}
            {fieldErrors.quantity && (
              <p className="text-xs text-destructive">{fieldErrors.quantity}</p>
            )}
            {editingCip && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2 w-full sm:w-auto"
                disabled={regenerating || updateMutation.isPending}
                onClick={() => void handleRegenerate()}
              >
                {regenerating ? (
                  <>
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                    Regenerating…
                  </>
                ) : (
                  "Regenerate winning ticket numbers"
                )}
              </Button>
            )}
          </Field>

          {editingCip && (
            <WinningTicketNumbersDisplay
              numbers={displayNumbers}
              claimedCount={editingCip.claimedCount}
            />
          )}

          {!editingCip && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-0 text-muted-foreground"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide" : "Show"} advanced — winning ticket numbers
              </Button>
              {showAdvanced && (
                <Field>
                  <FieldLabel htmlFor="manual-numbers">Winning ticket numbers</FieldLabel>
                  <Textarea
                    id="manual-numbers"
                    value={manualNumbersRaw}
                    onChange={(e) => setManualNumbersRaw(e.target.value)}
                    placeholder="e.g. 1, 5, 10, 15, 20"
                    rows={2}
                  />
                  <FieldDescription>
                    Comma-separated. Leave blank to auto-assign. Count must match instant wins.
                  </FieldDescription>
                  {fieldErrors.manualTicketNumbers && (
                    <p className="text-xs text-destructive">{fieldErrors.manualTicketNumbers}</p>
                  )}
                </Field>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="min-w-[7rem]">
              {isPending ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Saving…
                </>
              ) : editingCip ? (
                "Save changes"
              ) : (
                "Add prize"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
