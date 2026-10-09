import type { ContextualError } from "@oc/api-client";
import { AlertTriangle, RefreshCw } from "@oc/icons";
import { ContextualErrorMessage } from "@/components/ContextualErrorMessage";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslation } from "@/lib/i18n";

export interface CheckoutErrorBannerProps {
  error: ContextualError;
  onRetry?: () => void;
}

export function CheckoutErrorBanner({ error, onRetry }: CheckoutErrorBannerProps) {
  const { t } = useTranslation();
  return (
    <Alert variant="destructive" className="animate-fade-in">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <AlertDescription className="flex flex-col gap-2">
        <ContextualErrorMessage error={error} className="text-sm" />
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-2 text-sm text-gold hover:text-gold-light transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            {t("common.tryAgain")}
          </button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
