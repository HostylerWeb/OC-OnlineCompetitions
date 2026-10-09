export { playSiteSound } from "./lib/site-sounds";
export { authClient } from "@oc/auth-client";
export * from "./auth/actions";
export {
  decideEnsureFreshVerificationOtp,
  ensureFreshVerificationOtp,
  ensureFreshVerificationOtpAfterFailure,
  getVerifyOtpEnsuredStorageKey,
  hasVerifyOtpEnsuredFlag,
  setVerifyOtpEnsuredFlag,
} from "./auth/ensureFreshVerificationOtp";
export {
  ChangePasswordForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  SignInForm,
  SignUpForm,
  VerifyEmailForm,
} from "./auth/forms/index";
export { normalizeAuthEmail } from "./auth/normalize-email";
export {
  type AuthRedirectErrorContent,
  type AuthRedirectErrorKind,
  isAuthRedirectErrorKind,
  isExistingAccountRedirectError,
  isGoogleEmailMismatchError,
  resolveAuthRedirectError,
} from "./auth/redirect-error";
export { refreshAuthSession } from "./auth/refresh-session";
export { isAdminUser, mapSessionUser } from "./auth/session";
export {
  fetchSessionSnapshot,
  getSessionSnapshot,
  seedSessionFromServer,
  updateSessionSnapshot,
} from "./auth/session-snapshot";
export { useAuth } from "./auth/use-auth";
export {
  type AuthState,
  type AuthStatus,
  setSessionAnonymous,
  setSessionAuthenticated,
  setSessionUnauthenticated,
  useSessionStore,
} from "./auth/user-store";
export {
  API_ADMIN_INSTANT_PRIZE_ASSIGN_TIMEOUT_MS,
  API_CHECKOUT_TIMEOUT_MS,
  API_DEFAULT_TIMEOUT_MS,
  ApiResponseError,
  adminInstantPrizeAssignMutationOptions,
  adminInstantPrizeAssignPostOptions,
  api,
  checkoutRequestOptions,
  idempotencyKeyFromCartId,
  setApiBaseUrl,
} from "./client";
export { AuthProvider } from "./components/AuthProvider";
export { ReferralRefGate } from "./components/ReferralRefGate";
export * from "./constants";

export * from "./hooks";
// Explicit notification hook exports (Docker Turbopack workaround)
export {
  useAdminNotification,
  useAdminNotificationMutations,
  useAdminNotificationStats,
  useAdminNotifications,
} from "./hooks/admin/notifications";
export { queryKeys } from "./keys";
export {
  applyCartOptimistic,
  type CartOptimisticContext,
  type CartPatcher,
  type CartSnapshot,
  cartIdsKeyFromItems,
  type InvalidateAfterCartMutationOptions,
  invalidateAfterCartMutation,
  readCurrentCart,
  rollbackCartOptimistic,
} from "./lib/cart-mutations";
export { buildCheckoutIdempotencyKey } from "./lib/checkout-idempotency";
export {
  contextualErrorAction,
  isSafeReturnToPath,
  withCheckoutReturnTo,
} from "./lib/contextual-action-href";
export {
  applyComplianceFeaturesToContextualError,
  resolveContextualErrorWithCompliance,
} from "./lib/contextual-error-compliance";
export type { ContextualError, ContextualErrorAction } from "./lib/contextual-errors";
export {
  buildContextualActionHref,
  CONTEXTUAL_ERROR_DEFINITIONS,
  CONTEXTUAL_ERROR_ROUTES,
  FRONTEND_CONTEXTUAL_ERRORS,
  parsePrefixedErrorMessage,
  resolveContextualError,
  resolveContextualErrorFromUnknown,
} from "./lib/contextual-errors";
export {
  buildCheckoutSuccessUrl,
  type CheckoutSuccessParams,
  type GoToCheckoutSuccessParams,
  goToCheckoutSuccess,
  invalidateCheckoutSuccessQueries,
  prepareCheckoutSuccess,
} from "./lib/go-to-checkout-success";
export {
  createInfiniteAdminQuery,
  createPaginatedAdminQuery,
  flattenInfinitePages,
  getOffsetNextPageParam,
  useInfiniteVirtual,
  useServerPagination,
} from "./lib/pagination";
export {
  getPaymentContextualError,
  getPaymentErrorMessage,
  PAYMENT_ERROR_MESSAGES,
} from "./lib/payment-errors";
export {
  NOTIFICATION_TYPE_DESCRIPTIONS,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  type NotificationType,
  type UsePushPreferencesResult,
  usePushPreferences,
} from "./notifications/use-push-preferences";
export {
  type PushSubscriptionState,
  type UsePushSubscriptionOptions,
  type UsePushSubscriptionResult,
  usePushSubscription,
} from "./notifications/use-push-subscription";
export {
  createQueryClient,
  getGlobalQueryClient,
  setGlobalQueryClient,
} from "./query-client";
export { QueryProvider } from "./query-provider";
export {
  clearPendingReferralRef,
  consumePendingReferralRef,
  getPendingReferralRef,
  getReferralCookieFromHeader,
  isValidReferralCodeFormat,
  normalizeReferralCode,
  resolveRefFromUrl,
  setPendingReferralRef,
} from "./referral/pending-ref";
export type { AuthenticatedDestination } from "./referral/redirect";
export {
  applyAuthenticatedDestination,
  buildAuthCallbackUrl,
  buildLoginUrl,
  buildSignUpUrl,
  buildVerifyRequiredPath,
  getAuthRedirectPath,
  getPostVerificationPath,
  getReferralRefGateRedirect,
  isAuthFunnelPath,
  parseRefFromSearch,
  pathnameFromReturnTo,
  resolveAuthenticatedDestination,
  sanitizeReturnTo,
  shouldCaptureReferral,
} from "./referral/redirect";
export { type CartUiStore, useCartUiStore } from "./stores/cart-ui";
export { type CheckoutStatus, type CreateSessionParams, useCheckout } from "./stores/checkout";
export {
  type CompetitionsFilterStore,
  useCompetitionsFilterStore,
} from "./stores/competitions-filter";
export { useInstantPrizeDrawerStore } from "./stores/instant-prize-drawer";
export * from "./types";
export { buildSearchParams } from "./utils";
