"use client";

import { ApiResponseError, api } from "@oc/api-admin";
import { Loader2, Trophy } from "@oc/icons";
import { getDisplayName } from "@oc/utils";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface WinnerEntryPreview {
  entry: { _id: string; entryNumber: number; userId: string };
  profile: { email: string | null; firstName: string | null; lastName: string | null };
  competition: { title: string; prizeValue: number } | null;
}

interface SelectWinnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  competitionTitle: string;
  prizeValue: number;
  ticketsSold?: number;
  maxTickets?: number;
  status?: string;
  onSuccess?: () => void;
  dataUmamiEvent?: string;
}

type Step = "input" | "preview";

function SelectWinnerDialog({
  open,
  onOpenChange,
  competitionId,
  competitionTitle,
  prizeValue,
  ticketsSold,
  maxTickets,
  status,
  onSuccess,
  dataUmamiEvent,
}: SelectWinnerDialogProps) {
  const [ticketNumber, setTicketNumber] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [preview, setPreview] = useState<WinnerEntryPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function reset() {
    setTicketNumber("");
    setStep("input");
    setPreview(null);
    setPreviewError(null);
    setIsLoading(false);
    setIsSubmitting(false);
    setIsSuccess(false);
    setSubmitError(null);
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  async function handlePreview() {
    if (!ticketNumber.trim()) return;
    setIsLoading(true);
    setPreviewError(null);
    try {
      const res = await api.get<WinnerEntryPreview>("/api/admin/winners/entries/search", {
        params: { competitionId, ticketNumber: ticketNumber.trim() },
      });
      setPreview(res.data ?? null);
      setStep("preview");
    } catch (err) {
      setPreviewError(
        err instanceof ApiResponseError ? err.message : "Entry not found. Check the ticket number."
      );
      setPreview(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.post("/api/admin/winners", {
        competitionId,
        ticketNumber: preview.entry.entryNumber,
      });
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 2000);
    } catch (err) {
      setSubmitError(
        err instanceof ApiResponseError ? err.message : "Failed to create winner. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayName = preview
    ? getDisplayName(
        {
          firstName: preview.profile.firstName ?? undefined,
          lastName: preview.profile.lastName ?? undefined,
        },
        preview.profile.email ?? ""
      )
    : null;

  const previewPrizeValue = preview?.competition?.prizeValue ?? prizeValue;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Select Winner</DialogTitle>
          <DialogDescription>
            {competitionTitle} — Prize value: £{prizeValue.toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <FieldGroup>
            <FieldDescription>
              Enter the winning ticket number. The entry will be looked up and you can review the
              winner before confirming.
            </FieldDescription>
            <Field>
              <FieldLabel htmlFor="ticket-number">Ticket Number</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="ticket-number"
                  type="number"
                  placeholder="Ticket number"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handlePreview()}
                />
                <Button
                  type="button"
                  onClick={handlePreview}
                  disabled={!ticketNumber.trim() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Preview"
                  )}
                </Button>
              </div>
            </Field>

            {previewError && (
              <Alert variant="destructive">
                <AlertDescription>{previewError}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        )}

        {step === "preview" && preview && (
          <div className="flex flex-col gap-4">
            {isSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Trophy className="size-12 text-primary" />
                <p className="text-lg font-semibold">Winner Drawn!</p>
                <p className="text-sm text-muted-foreground">Closing dialog...</p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tickets Sold</span>
                    <span className="font-medium">
                      {ticketsSold ?? "—"} / {maxTickets ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium capitalize">{status ?? "—"}</span>
                  </div>
                </div>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Trophy aria-hidden="true" />
                      Winner Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-muted-foreground">Ticket #</dt>
                      <dd className="font-mono font-semibold">
                        {String(preview.entry.entryNumber).padStart(6, "0")}
                      </dd>
                      <dt className="text-muted-foreground">Name</dt>
                      <dd>{displayName}</dd>
                      <dt className="text-muted-foreground">Email</dt>
                      <dd>{preview.profile.email ?? "—"}</dd>
                      <dt className="text-muted-foreground">Prize</dt>
                      <dd className="font-semibold">£{previewPrizeValue.toLocaleString()}</dd>
                    </dl>
                  </CardContent>
                </Card>
                {submitError && (
                  <Alert variant="destructive">
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
        )}

        {!isSuccess && (
          <DialogFooter>
            {step === "preview" ? (
              <>
                <Button type="button" variant="outline" onClick={() => setStep("input")}>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  {...(dataUmamiEvent ? { "data-umami-event": dataUmamiEvent } : {})}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    "Confirm Winner"
                  )}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { SelectWinnerDialog };
