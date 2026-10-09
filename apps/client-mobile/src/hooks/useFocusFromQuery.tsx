"use client";

import {
  CONTEXTUAL_ERROR_DEFINITIONS,
  FRONTEND_CONTEXTUAL_ERRORS,
  resolveContextualError,
  sanitizeReturnTo,
} from "@oc/api-client";
import { type RefObject, useEffect, useState } from "react";
import { useConsumeQueryParams } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";

const REASON_MESSAGES: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(CONTEXTUAL_ERROR_DEFINITIONS).map(([code, def]) => [code, def.message])
  ),
  FRONTEND_SPEND_LIMIT_REQUIRED: FRONTEND_CONTEXTUAL_ERRORS.spendLimitRequired.message,
  AGE_VERIFICATION_REQUIRED: FRONTEND_CONTEXTUAL_ERRORS.ageVerificationRequired.message,
};

export interface FocusSectionConfig {
  key: string;
  ref?: RefObject<HTMLElement | null>;
  autofocusSelector?: string;
  onFocus?: () => void;
}

export interface UseFocusFromQueryOptions {
  sections: FocusSectionConfig[];
  isReady?: boolean;
}

export interface UseFocusFromQueryResult {
  reasonBanner: string | null;
  returnTo: string | null;
  dismissReasonBanner: () => void;
}

export function useFocusFromQuery({
  sections,
  isReady = true,
}: UseFocusFromQueryOptions): UseFocusFromQueryResult {
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const [reasonBanner, setReasonBanner] = useState<string | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useConsumeQueryParams(["focus", "reason", "returnTo"]);

  useEffect(() => {
    if (!isReady) return;

    const focus = searchParams.get("focus");
    const reason = searchParams.get("reason");
    const returnToParam = searchParams.get("returnTo");

    if (!focus && !reason && !returnToParam) return;

    if (reason) {
      const resolved = resolveContextualError(reason);
      setReasonBanner(REASON_MESSAGES[reason] ?? resolved.message);
    }

    const safeReturnTo = sanitizeReturnTo(returnToParam);
    if (safeReturnTo) {
      setReturnTo(safeReturnTo);
    }

    const section = focus ? sections.find((s) => s.key === focus) : undefined;
    if (section) {
      window.requestAnimationFrame(() => {
        const target =
          section.ref?.current ??
          (section.autofocusSelector
            ? document.querySelector<HTMLElement>(section.autofocusSelector)
            : document.querySelector<HTMLElement>(`[data-focus="${section.key}"]`));

        target?.scrollIntoView({ behavior: "smooth", block: "center" });

        if (section.onFocus) {
          section.onFocus();
        } else if (section.autofocusSelector) {
          const input = document.querySelector<HTMLElement>(section.autofocusSelector);
          input?.focus();
        } else {
          const input = target?.querySelector<HTMLElement>("input, button, textarea");
          input?.focus();
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return {
    reasonBanner,
    returnTo,
    dismissReasonBanner: () => setReasonBanner(null),
  };
}

export function FocusReasonBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  if (!message) return null;

  return (
    <Alert className="border-amber-500/30 bg-amber-500/10">
      <AlertDescription className="flex items-start justify-between gap-3 text-sm">
        <span>{message}</span>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function ReturnToCheckoutButton({ returnTo }: { returnTo: string | null }) {
  const safeReturnTo = sanitizeReturnTo(returnTo);
  if (!safeReturnTo) return null;

  return (
    <a
      href={safeReturnTo}
      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full sm:w-auto"
    >
      Return to checkout
    </a>
  );
}
