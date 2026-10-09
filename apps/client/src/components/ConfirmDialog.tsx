"use client";
import { AlertTriangle, CircleCheck, Loader2 } from "@oc/icons";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  isDestructive?: boolean;
  isLoading?: boolean;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  isDestructive = false,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-gold/20"
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            {isDestructive && (
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          {description ? (
            <DialogDescription className="pt-1">{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="border-gold/20"
          >
            {cancelLabel}
          </Button>
          {onConfirm && (
            <Button
              type="button"
              variant={isDestructive ? "destructive" : "default"}
              onClick={onConfirm}
              disabled={isLoading}
              className={
                isDestructive
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-gold hover:bg-gold-dark"
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  {isDestructive && <AlertTriangle className="w-4 h-4 mr-2" />}
                  {!isDestructive && <CircleCheck className="w-4 h-4 mr-2" />}
                  {confirmLabel}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { ConfirmDialogProps };
export { ConfirmDialog };
