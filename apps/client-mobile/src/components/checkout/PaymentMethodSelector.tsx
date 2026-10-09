"use client";

import type { PaymentProviderId, PaymentProviderInfo } from "@oc/types";
import { cn } from "@oc/utils";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTranslation } from "@/lib/i18n";
import { FreeCheckout } from "./FreeCheckout";
import { CARD_BRAND_COMPONENT, providerDisplay } from "./providers/display";
import { checkoutComponents } from "./providers/registry";

const STORAGE_KEY = "onlinecompetitions:checkout:selected-provider";

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
}

export interface PaymentMethodSelectorProps {
  cart: PaymentMethodSelectorCart;
  isFormValid: boolean;
  onBeforePayment?: () => Promise<void>;
  onPaymentError?: (error: { message: string; code?: string }) => void;
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
  disabled?: boolean;
}

const ProviderRadioOption = memo(function ProviderRadioOption({
  provider,
  isSelected,
  disabled,
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
        "flex items-start gap-3 rounded-xl border p-4 transition-colors",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        isSelected
          ? "border-gold/60 bg-gold/5"
          : "border-gold/15 hover:border-gold/30 hover:bg-card"
      )}
    >
      <RadioGroupItem
        value={provider.id}
        id={`pay-${provider.id}`}
        className="mt-1"
        disabled={disabled}
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
  onProcessingChange?: (processing: boolean) => void;
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

  return (
    <Checkout
      cart={cart}
      isLoading={isLoading}
      isFormValid={isFormValid}
      isActive={isActive}
      onBeforePayment={onBeforePayment}
      onPaymentError={onPaymentError}
      onProcessingChange={onProcessingChange}
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
  providers,
  providersError,
  configResponse,
  providersResponse,
  configError,
  onLocalBypass,
  localBypassPending,
  compliance,
}: PaymentMethodSelectorProps) {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const handleProcessingChange = useCallback((processing: boolean) => {
    setIsProcessing(processing);
  }, []);
  const enabledProviders = useMemo(() => providers.filter((p) => p.enabled), [providers]);

  const defaultProviderId = useMemo(() => {
    const def = enabledProviders.find((p) => p.isDefault);
    if (def) return def.id;
    return enabledProviders[0]?.id ?? null;
  }, [enabledProviders]);

  const [selected, setSelected] = useState<string | null>(null);
  const [mountedProviderIds, setMountedProviderIds] = useState<Set<PaymentProviderId>>(() => {
    const id = defaultProviderId as PaymentProviderId | null;
    return id ? new Set([id]) : new Set();
  });

  useEffect(() => {
    if (!defaultProviderId) {
      setSelected(null);
      clearSelection();
      return;
    }
    setSelected((prev) => {
      const stored = readStoredSelection(enabledProviders.map((p) => p.id));
      if (stored) return stored;
      if (prev && enabledProviders.some((p) => p.id === prev)) return prev;
      return defaultProviderId;
    });
  }, [defaultProviderId, enabledProviders]);

  const activeProviderId = selected ?? defaultProviderId;

  useEffect(() => {
    if (!activeProviderId) return;
    const id = activeProviderId as PaymentProviderId;
    setMountedProviderIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [activeProviderId]);

  const handleSelect = useCallback(
    (next: string) => {
      if (isProcessing) return;
      setSelected(next);
      persistSelection(next);
    },
    [isProcessing]
  );

  const sharedPanelProps = {
    cart,
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

  if (enabledProviders.length === 1) {
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
        value={activeProviderId ?? ""}
        onValueChange={handleSelect}
        className="grid gap-2"
        disabled={isProcessing}
        aria-label={t("checkout.choosePaymentAria")}
      >
        {enabledProviders.map((provider) => (
          <ProviderRadioOption
            key={provider.id}
            provider={provider}
            isSelected={activeProviderId === provider.id}
            disabled={isProcessing}
          />
        ))}
      </RadioGroup>

      <div className="relative mt-2 min-h-[12rem]">
        {Array.from(mountedProviderIds).map((providerId) => {
          const isVisible = activeProviderId === providerId;
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
    </div>
  );
}

export const PaymentMethodSelector = memo(PaymentMethodSelectorInner);
