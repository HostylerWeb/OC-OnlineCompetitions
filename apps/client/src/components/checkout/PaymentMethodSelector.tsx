"use client";

import type { PaymentProviderId, PaymentProviderInfo } from "@oc/types";
import { cn } from "@oc/utils";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { roundCurrency } from "@oc/utils";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { FreeCheckout } from "./free/FreeCheckout";
import { SiteCreditFullCheckout } from "./site-credit/SiteCreditFullCheckout";
import { Wallet } from "@oc/icons";
import { Spinner } from "@/components/ui/spinner";
import { CARD_BRAND_COMPONENT, providerDisplay } from "./providers/display";
import { checkoutComponents } from "./providers/registry";

const STORAGE_KEY = "onlinecompetitions:checkout:selected-provider";
export const SITE_CREDIT_WALLET_CHECKOUT_ID = "site_credit_wallet";

export interface PaymentMethodSelectorCart {
  items: Array<{ competitionId: string; quantity: number; answerIndex: number }>;
  subtotal: number;
  total: number;
  discount: number;
  promoCode?: string | null;
  referralCode?: string | null;
  cartId?: string | null;
  contact: { firstName: string; lastName: string; email: string; phone?: string };
  shipping: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postcode: string;
    country?: string;
  };
  accountId: string;
  firstName?: string;
  lastName?: string;
  applySiteCredit?: boolean;
}

export interface PaymentMethodSelectorProps {
  cart: PaymentMethodSelectorCart;
  isFormValid: boolean;
  onBeforePayment?: () => Promise<void>;
  onPaymentError?: (error: { message: string; code?: string }) => void;
  onProcessingChange?: (providerId: string, processing: boolean) => void;
  providers: PaymentProviderInfo[];
  providersError: Error | null;
  configResponse?: import("@oc/types").ApiResponse<
    import("@oc/types").PaymentConfigResponse
  >;
  providersResponse?: import("@oc/types").ApiResponse<PaymentProviderInfo[]>;
  configError: Error | null;
  onLocalBypass?: () => void;
  localBypassPending?: boolean;
  compliance?: { dob?: string };
  siteCreditWalletEnabled?: boolean;
  siteCreditAvailable?: number;
  siteCreditBalanceLoading?: boolean;
  siteCreditCurrency?: string;
  applySiteCredit?: boolean;
  onApplySiteCreditChange?: (apply: boolean) => void;
  onSiteCreditFullPay?: () => void;
  siteCreditFullPayPending?: boolean;
}

function readStoredSelection(enabledIds: string[]): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored && enabledIds.includes(stored)) return stored;
  } catch {}
  return null;
}

function persistSelection(providerId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, providerId);
  } catch {}
}

function clearSelection(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

function isGatewayProviderId(id: string): id is PaymentProviderId {
  return id in checkoutComponents;
}

interface ProviderHeaderProps {
  provider: PaymentProviderInfo;
}

const ProviderHeader = memo(function ProviderHeader({ provider }: ProviderHeaderProps) {
  const { t } = useTranslation();
  const {
    title,
    description,
    badge,
    icon: Icon,
    cardBrands,
  } = providerDisplay[provider.id as PaymentProviderId];

  return (
    <div className="flex items-start gap-3 rounded-xl border border-gold/15 bg-card p-4">
      <div className="rounded-full bg-gold/10 p-2 text-gold shrink-0">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm text-foreground">{title}</span>
          {badge ? (
            <Badge
              variant="outline"
              className="rounded-full border-transparent bg-gold/15 text-[10px] font-semibold uppercase tracking-wide text-gold"
            >
              {badge}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {cardBrands && cardBrands.length > 0 ? (
          <div
            className="mt-1 flex flex-wrap items-center gap-1.5"
            role="list"
            aria-label={t("checkout.acceptedCardBrands")}
          >
            {cardBrands.map((brand) => {
              const BrandIcon = CARD_BRAND_COMPONENT[brand];
              const isTall = brand === "google-pay" || brand === "apple-pay";
              return (
                <BrandIcon
                  key={brand}
                  role="listitem"
                  className={cn(isTall ? "h-7" : "h-4", "opacity-80 grayscale-0")}
                />
              );
            })}
          </div>
        ) : null}
        {provider.environment ? (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {t("checkout.environment", { env: provider.environment })}
          </p>
        ) : null}
      </div>
    </div>
  );
});

interface ProviderRadioOptionProps {
  provider: PaymentProviderInfo;
  isSelected: boolean;
}

const ProviderRadioOption = memo(function ProviderRadioOption({
  provider,
  isSelected,
}: ProviderRadioOptionProps) {
  const { t } = useTranslation();
  const {
    title,
    description,
    badge,
    icon: Icon,
    cardBrands,
  } = providerDisplay[provider.id as PaymentProviderId];

  return (
    <Label
      htmlFor={`pay-${provider.id}`}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors",
        isSelected
          ? "border-gold/60 bg-gold/5"
          : "border-gold/15 hover:border-gold/30 hover:bg-card"
      )}
    >
      <RadioGroupItem
        value={provider.id}
        id={`pay-${provider.id}`}
        className="mt-1"
        data-testid={`pay-provider-${provider.id}`}
        data-umami-event="checkout:payment-method-select"
        data-umami-event-provider={provider.id}
      />
      <div className="flex flex-1 items-start gap-3">
        <div className="rounded-full bg-gold/10 p-2 text-gold shrink-0">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{title}</span>
            {badge ? (
              <Badge
                variant="outline"
                className="rounded-full border-transparent bg-gold/15 text-[10px] font-semibold uppercase tracking-wide text-gold"
              >
                {badge}
              </Badge>
            ) : null}
            {provider.isDefault ? (
              <Badge
                variant="secondary"
                className="rounded-full text-[10px] font-medium uppercase tracking-wide"
              >
                {t("checkout.defaultBadge")}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          {cardBrands && cardBrands.length > 0 ? (
            <div
              className="mt-1 flex flex-wrap items-center gap-1.5"
              role="list"
              aria-label={t("checkout.acceptedCardBrands")}
            >
              {cardBrands.map((brand) => {
                const BrandIcon = CARD_BRAND_COMPONENT[brand];
                const isTall = brand === "google-pay" || brand === "apple-pay";
                return (
                  <BrandIcon
                    key={brand}
                    role="listitem"
                    className={cn(isTall ? "h-7" : "h-4", "opacity-80 grayscale-0")}
                  />
                );
              })}
            </div>
          ) : null}
          {provider.environment ? (
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {t("checkout.environment", { env: provider.environment })}
            </p>
          ) : null}
        </div>
      </div>
    </Label>
  );
});

interface ProviderCheckoutPanelProps {
  providerId: PaymentProviderId;
  isLoading?: boolean;
  isActive?: boolean;
  cart: PaymentMethodSelectorCart;
  isFormValid: boolean;
  onBeforePayment?: () => Promise<void>;
  onPaymentError?: (error: { message: string; code?: string }) => void;
  onProcessingChange?: (providerId: string, processing: boolean) => void;
  configResponse?: import("@oc/types").ApiResponse<
    import("@oc/types").PaymentConfigResponse
  >;
  providersResponse?: import("@oc/types").ApiResponse<PaymentProviderInfo[]>;
  configError: Error | null;
  onLocalBypass?: () => void;
  localBypassPending?: boolean;
  compliance?: { dob?: string };
}

const ProviderCheckoutPanel = memo(function ProviderCheckoutPanel({
  providerId,
  isLoading,
  isActive,
  cart,
  isFormValid,
  onBeforePayment,
  onPaymentError,
  onProcessingChange,
  configResponse,
  providersResponse,
  configError,
  onLocalBypass,
  localBypassPending,
  compliance,
}: ProviderCheckoutPanelProps) {
  const Checkout = checkoutComponents[providerId];

  const handleProcessingChange = useCallback(
    (processing: boolean) => onProcessingChange?.(providerId, processing),
    [onProcessingChange, providerId]
  );

  if (!Checkout) {
    return null;
  }

  return (
    <Checkout
      cart={cart}
      isLoading={isLoading}
      isFormValid={isFormValid}
      isActive={isActive}
      onBeforePayment={onBeforePayment}
      onPaymentError={onPaymentError}
      onProcessingChange={handleProcessingChange}
      configResponse={configResponse}
      providersResponse={providersResponse}
      configError={configError}
      onLocalBypass={onLocalBypass}
      localBypassPending={localBypassPending}
      compliance={compliance}
    />
  );
});

function PaymentMethodSelectorInner({
  cart,
  isFormValid,
  onBeforePayment,
  onPaymentError,
  onProcessingChange,
  providers,
  providersError,
  configResponse,
  providersResponse,
  configError,
  onLocalBypass,
  localBypassPending,
  compliance,
  siteCreditWalletEnabled = false,
  siteCreditAvailable = 0,
  siteCreditBalanceLoading = false,
  siteCreditCurrency = "GBP",
  applySiteCredit = false,
  onApplySiteCreditChange,
  onSiteCreditFullPay,
  siteCreditFullPayPending,
}: PaymentMethodSelectorProps) {
  const { t, locale } = useTranslation();
  const enabledProviders = useMemo(
    () => providers.filter((p) => p.enabled && isGatewayProviderId(p.id)),
    [providers]
  );
  const showSiteCreditOption =
    siteCreditWalletEnabled &&
    cart.total > 0 &&
    (siteCreditBalanceLoading || siteCreditAvailable > 0);
  const cartTotal = roundCurrency(cart.total);
  const siteCreditApplied = applySiteCredit
    ? roundCurrency(Math.min(siteCreditAvailable, cartTotal))
    : 0;
  const gatewayDue = roundCurrency(Math.max(0, cartTotal - siteCreditApplied));
  const cartWithSiteCredit = useMemo(
    () => ({ ...cart, applySiteCredit: applySiteCredit && siteCreditApplied > 0 }),
    [cart, applySiteCredit, siteCreditApplied]
  );

  const defaultProviderId = useMemo(() => {
    const def = enabledProviders.find((p) => p.isDefault);
    if (def) return def.id;
    return enabledProviders[0]?.id ?? null;
  }, [enabledProviders]);

  const [selected, setSelected] = useState<string | null>(null);
  const [lastGatewayProviderId, setLastGatewayProviderId] = useState<PaymentProviderId | null>(
    () => (defaultProviderId && isGatewayProviderId(defaultProviderId) ? defaultProviderId : null)
  );
  const [processingProviderId, setProcessingProviderId] = useState<string | null>(null);
  const [mountedProviderIds, setMountedProviderIds] = useState<Set<PaymentProviderId>>(
    () => new Set()
  );

  useEffect(() => {
    if (!defaultProviderId) {
      setSelected(null);
      clearSelection();
      return;
    }
    setSelected((prev) => {
      const stored = readStoredSelection(enabledProviders.map((p) => p.id));
      if (stored) return stored;
      if (prev === SITE_CREDIT_WALLET_CHECKOUT_ID) return prev;
      if (prev && enabledProviders.some((p) => p.id === prev)) return prev;
      if (showSiteCreditOption) return null;
      return defaultProviderId;
    });
  }, [defaultProviderId, enabledProviders, showSiteCreditOption]);

  const activeProviderId =
    selected ?? (showSiteCreditOption ? null : defaultProviderId);

  const gatewayProviderId = useMemo((): PaymentProviderId | null => {
    if (activeProviderId && isGatewayProviderId(activeProviderId)) {
      return activeProviderId;
    }
    if (applySiteCredit && showSiteCreditOption && gatewayDue > 0) {
      const pick =
        lastGatewayProviderId && isGatewayProviderId(lastGatewayProviderId)
          ? lastGatewayProviderId
          : enabledProviders[0]?.id;
      return pick && isGatewayProviderId(pick) ? pick : null;
    }
    if (showSiteCreditOption && !applySiteCredit) {
      return null;
    }
    const fallback = defaultProviderId ?? enabledProviders[0]?.id;
    return fallback && isGatewayProviderId(fallback) ? fallback : null;
  }, [
    activeProviderId,
    applySiteCredit,
    showSiteCreditOption,
    gatewayDue,
    lastGatewayProviderId,
    enabledProviders,
    defaultProviderId,
  ]);

  useEffect(() => {
    if (!gatewayProviderId) return;
    setMountedProviderIds((prev) => {
      if (prev.has(gatewayProviderId)) return prev;
      const next = new Set(prev);
      next.add(gatewayProviderId);
      return next;
    });
  }, [gatewayProviderId]);

  const handleSelect = useCallback(
    (next: string) => {
      if (processingProviderId) return;
      setSelected(next);
      if (next === SITE_CREDIT_WALLET_CHECKOUT_ID) {
        onApplySiteCreditChange?.(true);
      } else {
        onApplySiteCreditChange?.(false);
        persistSelection(next);
        if (isGatewayProviderId(next)) {
          setLastGatewayProviderId(next);
        }
      }
    },
    [processingProviderId, onApplySiteCreditChange]
  );

  const handleProcessingChange = useCallback(
    (providerId: string, processing: boolean) => {
      setProcessingProviderId(processing ? providerId : null);
      onProcessingChange?.(providerId, processing);
    },
    [onProcessingChange]
  );

  const sharedPanelProps = {
    cart: cartWithSiteCredit,
    isFormValid,
    onBeforePayment,
    onPaymentError,
    onProcessingChange: handleProcessingChange,
    configResponse,
    providersResponse,
    configError,
    onLocalBypass,
    localBypassPending,
    compliance,
  };

  if (cart.total <= 0) {
    if (!isFormValid) return null;
    return (
      <FreeCheckout
        isFormValid={isFormValid}
        onLocalBypass={onLocalBypass}
        localBypassPending={localBypassPending}
      />
    );
  }

  if (providersError) {
    return null;
  }

  if (enabledProviders.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <ProviderCheckoutPanel providerId="paytriot" isLoading {...sharedPanelProps} />
      </div>
    );
  }

  const paymentMode =
    applySiteCredit && showSiteCreditOption
      ? SITE_CREDIT_WALLET_CHECKOUT_ID
      : (activeProviderId ?? "");

  const cardOnlyMode = !showSiteCreditOption;

  if (cardOnlyMode && enabledProviders.length === 1) {
    const provider = enabledProviders[0]!;
    const providerId = provider.id as PaymentProviderId;

    return (
      <div className="flex flex-col gap-4">
        <ProviderHeader provider={provider} />
        <ProviderCheckoutPanel providerId={providerId} isActive {...sharedPanelProps} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-sm text-foreground">{t("checkout.choosePayment")}</h3>
        <p className="text-xs text-muted-foreground">{t("checkout.choosePaymentDesc")}</p>
      </div>

      <RadioGroup
        value={paymentMode}
        onValueChange={handleSelect}
        disabled={processingProviderId !== null}
        className="relative z-20 grid gap-2"
        aria-label={t("checkout.choosePaymentAria")}
      >
        {showSiteCreditOption ? (
          <Label
            htmlFor="pay-site-credit-wallet"
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors",
              paymentMode === SITE_CREDIT_WALLET_CHECKOUT_ID
                ? "border-gold/60 bg-gold/5"
                : "border-gold/15 hover:border-gold/30 hover:bg-card"
            )}
          >
            <RadioGroupItem
              value={SITE_CREDIT_WALLET_CHECKOUT_ID}
              id="pay-site-credit-wallet"
              className="mt-1"
              data-umami-event="checkout:payment-method-select"
              data-umami-event-provider="site_credit_wallet"
            />
            <div className="flex flex-1 flex-col gap-1">
              <span className="font-medium text-sm">{t("checkout.siteCredit.walletTitle")}</span>
              <p className="text-xs text-muted-foreground">
                {t("checkout.siteCredit.walletDescription")}
              </p>
              <p className="text-xs font-medium text-primary tabular-nums flex items-center gap-2">
                {siteCreditBalanceLoading ? (
                  <>
                    <Spinner size="sm" aria-hidden />
                    {t("header.userMenu.siteCreditLoading")}
                  </>
                ) : (
                  t("checkout.siteCredit.available", {
                    amount: formatCurrency(siteCreditAvailable, locale, siteCreditCurrency),
                  })
                )}
              </p>
            </div>
          </Label>
        ) : null}
        {enabledProviders.map((provider) => (
          <ProviderRadioOption
            key={provider.id}
            provider={provider}
            isSelected={
              !applySiteCredit && gatewayProviderId === provider.id && isGatewayProviderId(provider.id)
            }
          />
        ))}
      </RadioGroup>

      {applySiteCredit && gatewayDue > 0 ? (
        <Alert className="border-gold/25 bg-gold/5">
          <AlertDescription className="text-sm">
            {t("checkout.siteCredit.partialPay", {
              credit: formatCurrency(siteCreditApplied, locale, siteCreditCurrency),
              cash: formatCurrency(gatewayDue, locale, siteCreditCurrency),
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      {applySiteCredit && showSiteCreditOption && gatewayDue <= 0 ? (
        <SiteCreditFullCheckout
          isFormValid={isFormValid}
          pending={siteCreditFullPayPending}
          siteCreditApplied={siteCreditApplied}
          currency={siteCreditCurrency}
          onPay={() => onSiteCreditFullPay?.()}
        />
      ) : null}

      {gatewayProviderId && (!applySiteCredit || gatewayDue > 0) ? (
        <div className="relative isolate mt-2 min-h-[12rem]">
          {Array.from(mountedProviderIds).map((providerId) => {
            const isVisible = gatewayProviderId === providerId;
            return (
              <div key={providerId} className={cn(!isVisible && "hidden")} aria-hidden={!isVisible}>
                <ProviderCheckoutPanel
                  providerId={providerId}
                  isActive={isVisible}
                  {...sharedPanelProps}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export const PaymentMethodSelector = memo(PaymentMethodSelectorInner);
