"use client";

import type { ContextualError } from "@oc/api-client";
import {
  ApiResponseError,
  api,
  applyComplianceFeaturesToContextualError,
  FRONTEND_CONTEXTUAL_ERRORS,
  getPaymentContextualError,
  goToCheckoutSuccess,
  resolveContextualErrorWithCompliance,
  useAuth,
  useCart,
  useCartDiscount,
  useCartItems,
  useCartTotals,
  useCheckout,
  useCheckoutEligibility,
  useCompetitionsBuyingPower,
  useComplianceFeatures,
  useCreateCheckoutSession,
  useMyProfile,
  usePaymentConfig,
  usePaymentProviders,
  useSyncProfileAddressIfChanged,
} from "@oc/api-client";
import { Lock } from "@oc/icons";
import type { ProfileAddress } from "@oc/types";
import { DEFAULT_PROFILE_ADDRESS } from "@oc/types";
import { cn } from "@oc/utils";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckoutErrorBanner } from "@/components/checkout/CheckoutErrorBanner";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { PaymentMethodSelector } from "@/components/checkout/PaymentMethodSelector";
import { DatePicker } from "@/components/DatePicker";
import { Link } from "@/components/Link";
import { AddressFormFields } from "@/components/shared/AddressFormFields";
import { useConsumeQueryParams } from "@/components/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UNITED_KINGDOM_ONLY } from "@/components/ui/countries";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, localeHref, useTranslation } from "@/lib/i18n";
import { isProfileAddressValid, profileAddressFromProfile } from "@/lib/profile-address";

function isCheckoutPhoneValid(phone: string): boolean {
  const trimmed = phone.trim();
  return trimmed.length >= 5 && trimmed.length <= 30;
}

interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface ContactFieldsProps {
  contact: ContactInfo;
  onContactChange: (field: keyof ContactInfo, value: string) => void;
  showEmailError: boolean;
  showPhoneError: boolean;
  profileFillActive: boolean;
  onBlur: (field: string) => void;
}

const ContactFields = memo(function ContactFields({
  contact,
  onContactChange,
  showEmailError,
  showPhoneError,
  profileFillActive,
  onBlur,
}: ContactFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-2 border-b border-gold/10">
        <h3 className="font-semibold text-sm text-foreground">
          {t("checkout.contactInformation")}
        </h3>
        {profileFillActive && (
          <span className="ml-auto text-xs text-muted-foreground italic">
            {t("checkout.fillingFromProfile")}
          </span>
        )}
      </div>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="review-firstName">
              {t("checkout.firstName")} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="review-firstName"
              placeholder={t("checkout.firstNamePlaceholder")}
              value={contact.firstName}
              onChange={(e) => onContactChange("firstName", e.target.value)}
              onBlur={() => onBlur("firstName")}
              className="h-9"
              autoComplete="given-name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-lastName">
              {t("checkout.lastName")} <span className="text-red-400">*</span>
            </Label>
            <Input
              id="review-lastName"
              placeholder={t("checkout.lastNamePlaceholder")}
              value={contact.lastName}
              onChange={(e) => onContactChange("lastName", e.target.value)}
              onBlur={() => onBlur("lastName")}
              className="h-9"
              autoComplete="family-name"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="review-email">
            {t("checkout.emailAddress")} <span className="text-red-400">*</span>
          </Label>
          <Input
            id="review-email"
            type="email"
            placeholder={t("checkout.emailPlaceholder")}
            value={contact.email}
            onChange={(e) => onContactChange("email", e.target.value)}
            onBlur={() => onBlur("email")}
            className={cn("h-9", showEmailError && "border-red-400 focus-visible:ring-red-400/50")}
            autoComplete="email"
            required
          />
          {showEmailError && (
            <p className="text-xs text-red-400 mt-1">{t("checkout.emailValidation")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="review-phone">
            {t("checkout.phoneNumber")} <span className="text-red-400">*</span>
          </Label>
          <Input
            id="review-phone"
            type="tel"
            placeholder={t("checkout.phonePlaceholder")}
            value={contact.phone}
            onChange={(e) => onContactChange("phone", e.target.value)}
            onBlur={() => onBlur("phone")}
            className={cn("h-9", showPhoneError && "border-red-400 focus-visible:ring-red-400/50")}
            autoComplete="tel"
            required
          />
          {showPhoneError && (
            <p className="text-xs text-red-400 mt-1">{t("checkout.phoneValidation")}</p>
          )}
        </div>
      </div>
    </div>
  );
});

function getProfileSyncError(
  err: unknown,
  features: ReturnType<typeof useComplianceFeatures>,
  t: (key: string, params?: Record<string, string | number>) => string
): ContextualError {
  if (err instanceof Error && err.name === ApiResponseError.name) {
    return getPaymentContextualError(
      err as ApiResponseError,
      t("checkout.addressSaveError"),
      features
    );
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: t("checkout.addressSaveError") };
}

function CheckoutPageContent() {
  const { t: _t, locale } = useTranslation();
  const t = _t as (key: string, params?: Record<string, string | number>) => string;
  const navigate = useNavigate();
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const { user: authUser, isLoading: authLoading } = useAuth();
  const user = authUser;
  const isGuest = user?.isAnonymous === true;
  const cartOpts = { enabled: !!user };
  const itemsQuery = useCartItems(cartOpts);
  const { data: items = [], isLoading: cartLoading, isSuccess: cartLoaded } = itemsQuery;
  const { data: totals = { subtotal: 0, monetarySubtotal: 0, total: 0, walletTicketsTotal: 0 } } =
    useCartTotals(cartOpts);
  const {
    data: discount = {
      promoCode: null,
      pendingReferralCode: null,
      referralDiscountAmount: null,
      referralDiscountPercent: null,
      referralLocked: false,
      discountType: null,
      discountAmount: 0,
      discountRequiresAuth: false,
    },
  } = useCartDiscount(cartOpts);
  const { data: cart = null } = useCart(cartOpts);
  const cartId = cart?.data?.id ?? null;
  const { promoCode, discountAmount: promoDiscountAmount, pendingReferralCode } = discount;
  const discountRequiresAuth = discount.discountRequiresAuth ?? false;
  const { subtotal, total } = totals;

  const uniqueIds = [...new Set(items.map((i) => i.competitionId))];
  const { data: buyingPower } = useCompetitionsBuyingPower(uniqueIds);

  const { data: profileResponse, isLoading: profileLoading } = useMyProfile();
  const profile = profileResponse?.data;
  const features = useComplianceFeatures();
  const {
    isLoading: eligibilityLoading,
    ageVerificationRequired,
    selfExcluded,
  } = useCheckoutEligibility();

  const { data: providersResponse, error: providersError } = usePaymentProviders();
  const { data: configResponse, error: configError } = usePaymentConfig();

  const createCheckoutSession = useCreateCheckoutSession();
  const syncProfileAddressIfChanged = useSyncProfileAddressIfChanged();

  const [paymentError, setPaymentError] = useState<ContextualError | null>(null);
  const [addressEdited, setAddressEdited] = useState(false);
  const isSubmittingRef = useRef<boolean>(false);

  useConsumeQueryParams(["payment"]);

  useEffect(() => {
    if (searchParams.has("payment")) {
      setPaymentError({
        code: "PAYMENT_FAILED",
        message: t("checkout.paymentError"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [contact, setContact] = useState<ContactInfo>({
    firstName: isGuest ? "" : (user?.firstName ?? ""),
    lastName: isGuest ? "" : (user?.lastName ?? ""),
    email: isGuest ? "" : (user?.email ?? ""),
    phone: "",
  });

  const [address, setAddress] = useState<ProfileAddress>(DEFAULT_PROFILE_ADDRESS);

  const [dob, setDob] = useState("");
  const [emailRegistered, setEmailRegistered] = useState(false);

  // ── Autofill: look up profile fields when email changes ──────────────
  // Uses a 500ms debounce. Only fills fields that haven't been manually
  // edited (tracked via the touched* flags).
  const [profileFillActive, setProfileFillActive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailAutoFilled = useRef(false);
  const phoneAutoFilled = useRef(false);
  const firstNameAutoFilled = useRef(false);
  const lastNameAutoFilled = useRef(false);
  const dobAutoFilled = useRef(false);
  const addressAutoFilled = useRef(false);
  const prevEmailRef = useRef(contact.email);

  useEffect(() => {
    const email = contact.email.trim();
    if (!email.includes("@")) return;
    if (email === prevEmailRef.current) return;
    prevEmailRef.current = email;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setProfileFillActive(true);
      try {
        const res = await api.get<{
          firstName: string;
          lastName: string;
          phone: string;
          dateOfBirth: string;
          addressLine1: string;
          addressLine2: string;
          city: string;
          postcode: string;
          country: string;
          isVerified: boolean;
        }>("/api/payments/profile-fill", { params: { email } });
        const data = res as unknown as {
          firstName: string;
          lastName: string;
          phone: string;
          dateOfBirth: string;
          addressLine1: string;
          addressLine2: string;
          city: string;
          postcode: string;
          country: string;
          isVerified: boolean;
        };
        setEmailRegistered(data.isVerified);
        if (data.firstName && !firstNameAutoFilled.current) {
          setContact((prev) => ({ ...prev, firstName: data.firstName }));
          firstNameAutoFilled.current = true;
        }
        if (data.lastName && !lastNameAutoFilled.current) {
          setContact((prev) => ({ ...prev, lastName: data.lastName }));
          lastNameAutoFilled.current = true;
        }
        if (data.phone && !phoneAutoFilled.current) {
          setContact((prev) => ({ ...prev, phone: data.phone }));
          phoneAutoFilled.current = true;
        }
        if (data.dateOfBirth && !dobAutoFilled.current) {
          setDob(data.dateOfBirth.split("T")[0] ?? "");
          dobAutoFilled.current = true;
        }
        if (!addressAutoFilled.current) {
          const hasAddress =
            data.addressLine1 || data.city || data.postcode || data.country !== "GB";
          if (hasAddress) {
            setAddress((prev) => ({
              ...prev,
              addressLine1: data.addressLine1 || prev.addressLine1,
              addressLine2: data.addressLine2 ?? prev.addressLine2 ?? "",
              city: data.city || prev.city,
              postcode: data.postcode || prev.postcode,
              country: data.country || prev.country,
            }));
            addressAutoFilled.current = true;
          }
        }
        emailAutoFilled.current = true;
      } catch {
        // non-fatal — form stays as-is
      } finally {
        setProfileFillActive(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [contact.email]);

  // ── Validation with touched tracking ────────────────────────────────
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const isContactValid = contact.email.trim().length > 0 && contact.email.includes("@");
  const isPhoneValid = isCheckoutPhoneValid(contact.phone);
  const isAddressValid = isProfileAddressValid(address);
  const isDobValid = isGuest ? dob.trim().length > 0 : true;
  const isFormValid = isContactValid && isPhoneValid && isAddressValid && isDobValid;
  const showEmailError = Boolean(touched.email && !isContactValid);
  const showPhoneError = Boolean(touched.phone && !isPhoneValid);
  const showDobError = Boolean(touched.dob && isGuest && !isDobValid);
  const showAddressError = Boolean(
    touched.address &&
      !isAddressValid &&
      (!address.addressLine1.trim() || !address.city.trim() || !address.postcode.trim())
  );

  const cartItems = useMemo(
    () =>
      items.map((item) => ({
        competitionId: item.competitionId,
        quantity: item.quantity,
        answerIndex: item.answerIndex,
      })),
    [items]
  );

  const paymentCart = useMemo(
    () => ({
      items: cartItems,
      subtotal: subtotal,
      total,
      discount: isGuest && discountRequiresAuth ? 0 : (promoDiscountAmount ?? 0),
      promoCode: isGuest && discountRequiresAuth ? null : promoCode,
      referralCode: isGuest && discountRequiresAuth ? null : pendingReferralCode,
      cartId: cartId ?? undefined,
      contact,
      shipping: address,
      accountId: user?.id ?? "",
      firstName: profile?.firstName ?? user?.firstName ?? undefined,
      lastName: profile?.lastName ?? user?.lastName ?? undefined,
      ...(isGuest ? { compliance: { dob } } : {}),
    }),
    [
      cartItems,
      subtotal,
      total,
      promoDiscountAmount,
      promoCode,
      pendingReferralCode,
      cartId,
      contact,
      address,
      user?.id,
      user?.firstName,
      user?.lastName,
      profile?.firstName,
      profile?.lastName,
      isGuest,
      dob,
      discountRequiresAuth,
    ]
  );

  const isSubmitting = createCheckoutSession.isPending;
  const guestCheckoutBlocked = isGuest && !features.guestCheckoutEnabled;
  const complianceBlocked = ageVerificationRequired || selfExcluded;
  const orderValueBlocked =
    (total === 0 && !features.allowZeroSubtotalOrders) ||
    (features.minimumOrderValue > 0 && total < features.minimumOrderValue);
  const orderValueError: ContextualError | null = orderValueBlocked
    ? total === 0
      ? {
          message: t("checkout.zeroTotalError"),
          code: "ZERO_SUBTOTAL_DISABLED",
        }
      : {
          message: t("checkout.minimumOrderError", {
            min: formatCurrency(features.minimumOrderValue, locale),
          }),
          code: "MINIMUM_ORDER_NOT_MET",
        }
    : null;
  const isFormReadyForPayment = isFormValid && !complianceBlocked && !orderValueBlocked;

  useEffect(() => {
    if (cartLoaded && items.length === 0) navigate(localeHref("/cart", locale));
  }, [cartLoaded, items.length]);

  useEffect(() => {
    if (!profile || isGuest) return;
    setContact({
      firstName: profile.firstName ?? user?.firstName ?? "",
      lastName: profile.lastName ?? user?.lastName ?? "",
      email: profile.email ?? user?.email ?? "",
      phone: profile.phone ?? "",
    });
    if (!addressEdited) {
      setAddress({ ...profileAddressFromProfile(profile), country: "GB" });
    }
  }, [profile, user, addressEdited, isGuest]);

  useEffect(() => {
    if (isSubmitting) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSubmitting]);

  useEffect(() => {
    return () => {
      useCheckout.getState().stopPolling();
    };
  }, []);

  const handleContactChange = useCallback((field: keyof ContactInfo, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAddressChange = useCallback((field: keyof ProfileAddress, value: string) => {
    setAddressEdited(true);
    setAddress((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleRetry = useCallback(() => {
    isSubmittingRef.current = false;
    setPaymentError(null);
  }, []);

  const syncProfileBeforePayment = useCallback(async () => {
    if (isGuest) return;
    try {
      await syncProfileAddressIfChanged(address, contact.phone);
    } catch (err: unknown) {
      const message = getProfileSyncError(err, features, t);
      setPaymentError(message);
      isSubmittingRef.current = false;
      throw err;
    }
  }, [address, contact.phone, features, syncProfileAddressIfChanged, isGuest]);

  const validateCartBeforePayment = useCallback(async () => {
    await itemsQuery.refetch();
    const currentItems = itemsQuery.data ?? [];
    if (currentItems.length === 0) {
      setPaymentError({
        message: t("checkout.cartEmptyError"),
      });
      isSubmittingRef.current = false;
      navigate(localeHref("/cart", locale));
      throw new Error("Cart empty after refetch");
    }
    for (const item of currentItems) {
      const bp = buyingPower?.[item.competitionId];
      if (bp && bp.available === 0) {
        setPaymentError({
          message: t("checkout.soldOutError", { title: item.competitionTitle }),
        });
        isSubmittingRef.current = false;
        throw new Error(`Sold out: ${item.competitionTitle}`);
      }
    }
    await syncProfileBeforePayment();
  }, [buyingPower, itemsQuery, syncProfileBeforePayment]);

  const handleLocalBypass = useCallback(async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setPaymentError(null);

    try {
      await syncProfileBeforePayment();
    } catch {
      return;
    }

    try {
      const res = await createCheckoutSession.mutateAsync({
        provider: "local",
        contact,
        shipping: address,
        cartId: cartId ?? undefined,
        ...(isGuest ? { compliance: { dob } } : {}),
      });
      if (!res.data?.sessionId) throw new Error("Failed to create checkout session");
      goToCheckoutSuccess({
        provider: "local",
        sessionId: res.data.sessionId,
        orderId: res.data.orderId,
        navigate: (url: string) => navigate(url),
      });
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      setPaymentError(
        err instanceof Error && err.name === ApiResponseError.name
          ? getPaymentContextualError(err as ApiResponseError, t("checkout.orderFailed"), features)
          : err instanceof Error
            ? { message: err.message }
            : { message: t("checkout.orderFailed") }
      );
    }
  }, [
    address,
    cartId,
    contact,
    createCheckoutSession,
    features,
    syncProfileBeforePayment,
    isGuest,
    user?.id,
    user?.isAnonymous,
    isFormValid,
    dob,
  ]);

  const effectiveAuthLoading = authLoading && !user;
  const isCheckoutLoading =
    effectiveAuthLoading || profileLoading || cartLoading || eligibilityLoading;
  const checkoutLoadingLabel = t("common.loading");

  return (
    <main className="flex-1 oc-container-wide py-4 lg:py-8">
      <div className="mb-5 lg:mb-6 text-center">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mb-1.5 lg:mb-2">
          {t("checkout.heading")}
        </h1>
        <p className="text-sm lg:text-base text-muted-foreground">{t("checkout.subtitle")}</p>
      </div>

      {guestCheckoutBlocked ? (
        <Card className="border-gold/20">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <h2 className="text-lg font-semibold">{t("checkout.guestDisabled")}</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {t("checkout.guestDisabledDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-gold/20 relative min-h-[18rem]">
              {isCheckoutLoading ? (
                <div
                  className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-background/85 backdrop-blur-[2px]"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  aria-label={t("checkout.preparingCheckout")}
                >
                  <div className="flex flex-col items-center gap-3">
                    <Spinner size="lg" />
                    <p className="text-sm text-muted-foreground/90">{checkoutLoadingLabel}</p>
                  </div>
                </div>
              ) : null}
              <CardHeader>
                <CardTitle className="text-balance">{t("checkout.reviewOrder")}</CardTitle>
                <CardDescription>{t("checkout.reviewOrderDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-6">
                  <ContactFields
                    contact={contact}
                    onContactChange={handleContactChange}
                    showEmailError={showEmailError}
                    showPhoneError={showPhoneError}
                    profileFillActive={profileFillActive}
                    onBlur={markTouched}
                  />

                  {isGuest && emailRegistered ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                      {t("checkout.emailAlreadyRegistered")}{" "}
                      <Link
                        href="/auth/login?returnTo=/checkout"
                        className="font-medium underline underline-offset-2 hover:text-amber-600"
                        data-umami-event="checkout:sign-in-link"
                      >
                        {t("checkout.signIn")}
                      </Link>{" "}
                      {t("checkout.toAccessAccount")}
                    </div>
                  ) : null}

                  {isGuest ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-gold/10">
                        <h3 className="font-semibold text-sm text-foreground">
                          {t("checkout.dateOfBirth")}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("checkout.dobDescription")}
                      </p>
                      <DatePicker
                        id="checkout-dob"
                        value={dob}
                        onChange={(v) => {
                          setDob(v);
                          markTouched("dob");
                        }}
                        minAge={18}
                        defaultToMinAge
                        placeholder={t("checkout.dobPlaceholder")}
                        className={cn("h-10", showDobError && "border-red-400")}
                      />
                      {showDobError && (
                        <p className="text-xs text-red-400">{t("checkout.dobRequired")}</p>
                      )}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-gold/10">
                      <h3 className="font-semibold text-sm text-foreground">
                        {t("checkout.shippingAddress.heading")}
                      </h3>
                    </div>
                    <AddressFormFields
                      value={address}
                      onChange={(field, value) => {
                        handleAddressChange(field, value);
                        markTouched("address");
                      }}
                      idPrefix="review"
                      required
                      countryOptions={UNITED_KINGDOM_ONLY}
                    />
                    {showAddressError && (
                      <p className="text-xs text-red-400 -mt-2">
                        {t("checkout.addressValidation")}
                      </p>
                    )}
                  </div>

                  {ageVerificationRequired ? (
                    <CheckoutErrorBanner
                      error={applyComplianceFeaturesToContextualError(
                        FRONTEND_CONTEXTUAL_ERRORS.ageVerificationRequired,
                        features
                      )}
                    />
                  ) : null}

                  {selfExcluded ? (
                    <CheckoutErrorBanner
                      error={resolveContextualErrorWithCompliance(
                        "ACCOUNT_SELF_EXCLUDED",
                        features
                      )}
                    />
                  ) : null}

                  {orderValueError ? <CheckoutErrorBanner error={orderValueError} /> : null}

                  {paymentError?.message ? (
                    <CheckoutErrorBanner error={paymentError} onRetry={handleRetry} />
                  ) : null}

                  {isSubmitting ? (
                    <div
                      className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-background/85 backdrop-blur-[2px]"
                      role="status"
                      aria-live="polite"
                      aria-busy="true"
                      aria-label={t("checkout.processingPayment")}
                    >
                      <Spinner size="lg" />
                    </div>
                  ) : null}

                  <div className="flex min-h-[14rem] flex-col gap-6 border-t border-gold/10 pt-6">
                    {providersError ? (
                      <CheckoutErrorBanner error={FRONTEND_CONTEXTUAL_ERRORS.providerUnavailable} />
                    ) : (
                      <PaymentMethodSelector
                        cart={paymentCart}
                        isFormValid={isFormReadyForPayment}
                        onBeforePayment={validateCartBeforePayment}
                        onPaymentError={setPaymentError}
                        providers={providersResponse?.data ?? []}
                        providersError={providersError}
                        configResponse={configResponse}
                        providersResponse={providersResponse}
                        configError={configError}
                        onLocalBypass={handleLocalBypass}
                        localBypassPending={isSubmitting}
                        compliance={{ dob }}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Lock className="size-4" />
              <span>{t("checkout.sslCheckout")}</span>
            </div>
          </div>

          <div className="lg:col-span-1">
            <OrderSummary />
          </div>
        </div>
      )}
    </main>
  );
}

export default CheckoutPageContent;
