"use client";

import { AlertTriangle, Home, RefreshCw } from "@oc/icons";
import { GoldButton, GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { useTranslation } from "@/lib/i18n";

interface ServerErrorViewProps {
  message?: string;
}

export function ServerErrorView({ message }: ServerErrorViewProps) {
  const { t } = useTranslation();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-16 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-destructive/[0.04] via-transparent to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-xl text-center">
        <div className="mb-6 inline-flex size-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
        </div>

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          {t("pageError.heading")}
        </h1>
        <p className="mb-8 text-base text-muted-foreground text-pretty sm:text-lg">
          {message?.trim() || t("pageError.description")}
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <GoldOutlineButton
            type="button"
            size="lg"
            onClick={() => window.location.reload()}
            data-umami-event="error:reload"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("pageError.tryAgain")}
          </GoldOutlineButton>
          <GoldButton asChild size="lg">
            <Link href="/" data-umami-event="error:go-home">
              <Home className="size-4" aria-hidden="true" />
              {t("errorBoundary.backToHome")}
            </Link>
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
