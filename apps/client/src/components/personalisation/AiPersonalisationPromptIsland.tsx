import {
  usePersonalisationAck,
  usePersonalisationAction,
} from "@oc/api-client";
import { useAuth } from "@oc/api-client";
import { X } from "@oc/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { localeHref, useLogicalPathname } from "@/lib/i18n";

function resolveSurface(pathname: string): "home" | "checkout" | "competition" {
  if (pathname.startsWith("/checkout")) return "checkout";
  if (pathname.startsWith("/competitions/")) return "competition";
  return "home";
}

export function AiPersonalisationPromptIsland() {
  const { user, isAnonymous } = useAuth();
  const pageContext = usePageContext();
  const locale = pageContext.locale ?? "en";
  const pathname = useLogicalPathname();
  const surface = resolveSurface(pathname);
  const { data } = usePersonalisationAction(surface, {
    enabled: Boolean(user && !isAnonymous),
  });
  const ackMutation = usePersonalisationAck();
  const [open, setOpen] = useState(false);
  const promptHandledRef = useRef(false);

  const action = data?.data?.action;
  const payload = data?.data?.payload;
  const competitionId = payload?.competitionId;

  const onTargetCompetition =
    Boolean(competitionId) && pathname.startsWith(`/competitions/${competitionId}`);

  const closePrompt = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    closePrompt();
  }, [pathname, closePrompt]);

  useEffect(() => {
    if (promptHandledRef.current) return;
    if (onTargetCompetition) return;
    if (!action || action === "none" || !payload?.headline) return;
    setOpen(true);
    promptHandledRef.current = true;
    void ackMutation.mutateAsync({ surface, event: "shown", action });
  }, [action, payload?.headline, surface, ackMutation, onTargetCompetition]);

  const handleDismiss = () => {
    if (!action || action === "none") return;
    promptHandledRef.current = true;
    void ackMutation.mutate({ surface, event: "dismissed", action });
    closePrompt();
  };

  const handlePlayNow = () => {
    if (!competitionId || !action || action === "none") return;
    promptHandledRef.current = true;
    void ackMutation.mutate({ surface, event: "clicked", action });
    closePrompt();
    void navigate(localeHref(`/competitions/${competitionId}`, locale));
  };

  if (!action || action === "none" || !payload?.headline || onTargetCompetition) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleDismiss();
        else setOpen(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{payload.headline}</DialogTitle>
          {payload.body ? <DialogDescription>{payload.body}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleDismiss}>
            <X className="size-4" aria-hidden />
            Not now
          </Button>
          {competitionId ? (
            <Button type="button" size="sm" onClick={handlePlayNow}>
              {payload.ctaLabel ?? "View competition"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
