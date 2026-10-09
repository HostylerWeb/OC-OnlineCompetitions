"use client";

import { Trophy } from "@oc/icons";
import type { AdminCompetition } from "@oc/types";
import { useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import type { FormEventHandler, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

interface CompetitionFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  isPending?: boolean;
  isFetching?: boolean;
  error?: string | null;
  formId?: string;
  onClose?: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onPointerDownOutside?: (event: { preventDefault: () => void }) => void;
  children: ReactNode;
  isUploading?: boolean;
  editingCompetition?: AdminCompetition | null;
}

function CompetitionFormSheet({
  open,
  onOpenChange,
  editingId,
  isPending,
  isFetching,
  error,
  formId,
  onClose,
  onSubmit,
  onPointerDownOutside,
  children,
  isUploading,
  editingCompetition,
}: CompetitionFormSheetProps) {
  const isEdit = !!editingId;
  const isDrawn = editingCompetition?.status === "drawn";
  const generatedFormId = useId();
  const resolvedFormId = formId ?? `competition-form-${generatedFormId}`;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const prevOpenRef = useRef(open);
  const queryClient = useQueryClient();

  const [undrawDialogOpen, setUndrawDialogOpen] = useState(false);
  const [undrawStep, setUndrawStep] = useState<"reason" | "confirm">("reason");
  const [undrawReason, setUndrawReason] = useState("");
  const [undrawNote, setUndrawNote] = useState("");
  const [undrawConfirmText, setUndrawConfirmText] = useState("");
  const [isUndrawing, setIsUndrawing] = useState(false);

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      onCloseRef.current?.();
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!undrawDialogOpen) {
      setUndrawStep("reason");
      setUndrawReason("");
      setUndrawNote("");
      setUndrawConfirmText("");
      setIsUndrawing(false);
    }
  }, [undrawDialogOpen]);

  const comp = editingCompetition;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        onPointerDownOutside={onPointerDownOutside}
        className="h-screen w-full max-w-[95vw] gap-0 overflow-hidden bg-card p-0 sm:max-w-3xl"
      >
        <SheetHeader className="relative shrink-0 border-b px-6 py-5">
          <SheetTitle>{isEdit ? "Edit Competition" : "New Competition"}</SheetTitle>
          <SheetDescription>
            {isDrawn
              ? "This competition has been drawn. View the winner details below."
              : isEdit
                ? "Update competition details, pricing, and media."
                : "Create a new prize competition with tickets, images, and optional instant prizes."}
          </SheetDescription>
          {isDrawn && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="ring-offset-background focus:ring-ring absolute top-5 right-6 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </SheetHeader>

        {isDrawn ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                <div className="rounded-lg border border-gold/30 bg-gold/5 p-4">
                  <div className="flex items-start gap-3">
                    <Trophy className="size-5 text-gold shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gold">Competition has been drawn</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        This competition has a winner selected and cannot be edited. Below is a
                        read-only summary.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Title</p>
                    <p className="font-medium">{comp?.title}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Slug</p>
                    <p className="font-medium">{comp?.slug}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium text-green-500">Drawn</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Winner Ticket</p>
                    <p className="font-medium">
                      {comp?.winnerTicketNumber != null
                        ? `#${String(comp.winnerTicketNumber).padStart(5, "0")}`
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Prize Value</p>
                    <p className="font-medium">
                      {comp?.prizeValue != null
                        ? `${comp.currency === "EUR" ? "\u20AC" : "\u00A3"}${comp.prizeValue.toLocaleString()}`
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ticket Price</p>
                    <p className="font-medium">
                      {comp?.ticketPrice != null
                        ? `${comp.currency === "EUR" ? "\u20AC" : "\u00A3"}${comp.ticketPrice.toFixed(2)}`
                        : "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tickets Sold</p>
                    <p className="font-medium">
                      {comp?.ticketsSold ?? 0} / {comp?.maxTickets ?? "\u2014"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Draw Date</p>
                    <p className="font-medium">
                      {comp?.drawDate ? new Date(comp.drawDate).toLocaleDateString() : "\u2014"}
                    </p>
                  </div>
                </div>

                <hr className="border-border" />

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
                  <p className="text-xs text-muted-foreground">
                    Use this only for technical errors. This will reverse the winner selection and
                    return the competition to pending draw status.
                  </p>
                  <Button variant="destructive" size="sm" onClick={() => setUndrawDialogOpen(true)}>
                    Undraw Competition
                  </Button>
                </div>
              </div>
            </div>

            <SheetFooter className="shrink-0 border-t bg-muted/20 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </SheetFooter>
          </div>
        ) : (
          <form
            id={resolvedFormId}
            onSubmit={onSubmit}
            autoComplete="off"
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {error ? (
              <div className="shrink-0 px-6 pt-4">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>

            <SheetFooter className="shrink-0 flex-row border-t bg-muted/20 px-6 py-4">
              <Button type="submit" disabled={isPending || isFetching || isUploading}>
                {isPending ? "Saving..." : isEdit ? "Update Competition" : "Create Competition"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>

      <Dialog open={undrawDialogOpen} onOpenChange={setUndrawDialogOpen}>
        <DialogContent size="sm">
          <DialogTitle>
            {undrawStep === "reason" ? "Undraw Competition" : "Are You Absolutely Sure?"}
          </DialogTitle>

          {undrawStep === "reason" ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                This will reverse the winner selection for <strong>{comp?.title}</strong>. The
                winner&apos;s prize will be revoked and the competition will return to &quot;Pending
                Draw&quot; status.
              </p>

              <div className="space-y-2">
                <label htmlFor="undraw-reason" className="text-sm font-medium">
                  Reason for undraw
                </label>
                <Select value={undrawReason} onValueChange={setUndrawReason}>
                  <SelectTrigger id="undraw-reason">
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical_error">Technical Error</SelectItem>
                    <SelectItem value="wrong_winner">Wrong Winner Selected</SelectItem>
                    <SelectItem value="system_bug">System Bug</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label htmlFor="undraw-note" className="text-sm font-medium">
                  Admin note
                </label>
                <Textarea
                  id="undraw-note"
                  className="min-h-[80px]"
                  placeholder="Describe what went wrong... (minimum 10 characters)"
                  value={undrawNote}
                  onChange={(e) => setUndrawNote(e.target.value)}
                />
                {undrawNote.length > 0 && undrawNote.length < 10 && (
                  <p className="text-xs text-destructive">
                    {10 - undrawNote.length} more characters needed
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setUndrawDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setUndrawStep("confirm")}
                  disabled={!undrawReason || undrawNote.trim().length < 10}
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  This action cannot be easily reversed.
                </p>
                <ul className="mt-2 text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>The current winner will lose their claim to the prize</li>
                  <li>No notification will be sent about the undraw</li>
                  <li>The competition will need to be re-drawn</li>
                </ul>
                <p className="mt-2 text-sm font-medium text-destructive">
                  This should only be used for genuine technical errors.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="undraw-confirm" className="text-sm font-medium">
                  Type &quot;UNDRAW&quot; to confirm
                </label>
                <Input
                  id="undraw-confirm"
                  value={undrawConfirmText}
                  onChange={(e) => setUndrawConfirmText(e.target.value)}
                  placeholder='Type "UNDRAW" here'
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setUndrawStep("reason")}
                  disabled={isUndrawing}
                >
                  Go Back
                </Button>
                <Button
                  variant="destructive"
                  disabled={undrawConfirmText !== "UNDRAW" || isUndrawing}
                  onClick={async () => {
                    if (undrawConfirmText !== "UNDRAW") return;
                    setIsUndrawing(true);
                    try {
                      const res = await fetch(`/api/admin/competitions/${comp?._id}/undraw`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          reason: undrawReason,
                          note: undrawNote.trim(),
                        }),
                      });
                      if (!res.ok) {
                        const text = await res.text();
                        throw new Error(text);
                      }
                      toast.success("Competition undrawn successfully");
                      queryClient.invalidateQueries({ queryKey: ["admin", "competitions"] });
                      setUndrawDialogOpen(false);
                      onOpenChange(false);
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Failed to undraw competition"
                      );
                    } finally {
                      setIsUndrawing(false);
                    }
                  }}
                >
                  {isUndrawing ? "Undrawing..." : "Yes, Undraw"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

export type { CompetitionFormSheetProps };
export { CompetitionFormSheet };
