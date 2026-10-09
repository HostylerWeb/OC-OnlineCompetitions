import type {
  CreatePaymentSessionRequest,
  CreatePaymentSessionResponse,
  PaymentSessionStatusResponse,
} from "@oc/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSessionSnapshot } from "../auth/session-snapshot";
import { api, checkoutRequestOptions } from "../client";
import { buildCheckoutIdempotencyKey } from "../lib/checkout-idempotency";
import type { ContextualError } from "../lib/contextual-errors";
import { resolveContextualError } from "../lib/contextual-errors";
import { getPaymentContextualError } from "../lib/payment-errors";

export type CheckoutStatus = "idle" | "creating" | "redirecting" | "polling" | "success" | "error";

export interface CreateSessionParams {
  items: CreatePaymentSessionRequest["items"];
  promoCode?: string;
  subtotal: number;
  discount: number;
  provider?: string;
  cartId?: string;
  expectedCartVersion?: number;
  idempotencyKey?: string;
}

interface CheckoutState {
  status: CheckoutStatus;
  timedOut: boolean;
  provider: string | null;
  sessionId: string | null;
  orderId: string | null;
  error: ContextualError | null;
  redirectUrl: string | null;
  _pollTimer: ReturnType<typeof setTimeout> | null;

  createSession: (params: CreateSessionParams) => Promise<void>;
  seedSuccess: (provider: string, sessionId: string, orderId: string) => void;
  setPolling: (provider: string, sessionId: string) => void;
  pollStatus: () => Promise<(() => void) | undefined>;
  stopPolling: () => void;
  reset: () => void;
  clearPersistedState: () => void;
}

export const useCheckout = create<CheckoutState>()(
  persist(
    (set, get) => ({
      status: "idle",
      timedOut: false,
      provider: null,
      sessionId: null,
      orderId: null,
      error: null,
      redirectUrl: null,
      _pollTimer: null,

      createSession: async (params) => {
        set({ status: "creating", error: null, timedOut: false });

        try {
          const userId = getSessionSnapshot().user?.id;
          const idempotencyKey =
            params.idempotencyKey ??
            (params.cartId && userId
              ? await buildCheckoutIdempotencyKey(params.cartId, userId, params.expectedCartVersion)
              : undefined);

          const res = await api.post<CreatePaymentSessionResponse>(
            "/api/payments/session",
            { ...params, idempotencyKey },
            checkoutRequestOptions
          );

          const { provider, sessionId, redirectUrl } = res.data;
          if (!redirectUrl) {
            throw new Error("Missing redirect URL from payment session");
          }
          set({ provider, sessionId, redirectUrl, status: "redirecting" });
          window.location.href = redirectUrl;
        } catch (err: unknown) {
          set({
            status: "error",
            error: getPaymentContextualError(err, "Payment failed. Please try again."),
            timedOut: false,
          });
        }
      },

      seedSuccess: (provider, sessionId, orderId) => {
        const timer = get()._pollTimer;
        if (timer) clearTimeout(timer);
        set({
          provider,
          sessionId,
          orderId,
          status: "success",
          error: null,
          timedOut: false,
          _pollTimer: null,
        });
      },

      setPolling: (provider, sessionId) => {
        const state = get();
        if (
          state.status === "success" &&
          state.provider === provider &&
          state.sessionId === sessionId
        ) {
          return;
        }
        const timer = state._pollTimer;
        if (timer) clearTimeout(timer);
        const newState = {
          provider,
          sessionId,
          status: "polling" as const,
          orderId: null,
          error: null,
          timedOut: false,
          _pollTimer: null,
        };
        set(newState);
      },

      pollStatus: async () => {
        const { provider, sessionId, status } = get();
        if (!provider || !sessionId) return;
        if (status === "success") return;

        const MAX_ATTEMPTS = 40;

        let attempt = 0;
        let lastError: ContextualError | null = null;

        set({ timedOut: false });

        const stopEarly = () => {
          const timer = get()._pollTimer;
          if (timer) {
            clearTimeout(timer);
            set({ _pollTimer: null });
          }
        };

        const poll = async () => {
          attempt++;

          stopEarly();

          try {
            const res = await api.get<PaymentSessionStatusResponse>(
              `/api/payments/session/${provider}/${sessionId}`
            );

            const { status, orderId, errorCode, errorMessage } = res.data;

            if (status === "completed") {
              set({ status: "success", orderId: orderId ?? null, _pollTimer: null });
              return;
            }

            if (status === "failed") {
              const userError =
                (errorCode ? resolveContextualError(errorCode, errorMessage) : undefined) ??
                (errorMessage ? { message: errorMessage } : undefined) ??
                ({
                  message: "Payment failed. Your card has not been charged. Please try again.",
                } satisfies ContextualError);
              set({
                status: "error",
                error: userError,
                timedOut: false,
                _pollTimer: null,
              });
              return;
            }

            lastError = null;
          } catch (err: unknown) {
            lastError = getPaymentContextualError(err, "Payment failed. Please try again.");
          }

          const delay = Math.min(200 * 2 ** (attempt - 1), 10_000);

          if (attempt >= MAX_ATTEMPTS) {
            if (lastError) {
              set({
                status: "error",
                error: lastError,
                timedOut: false,
                _pollTimer: null,
              });
              return;
            }
            set({
              status: "error",
              error: {
                message:
                  "Your payment is still being processed. This can take up to 2 minutes — check your orders for updates.",
                action: { label: "View orders", href: "/dashboard/orders" },
              },
              timedOut: true,
              _pollTimer: null,
            });
            return;
          }

          const timer = setTimeout(poll, delay);
          set({ _pollTimer: timer });
        };

        poll();

        return stopEarly;
      },

      stopPolling: () => {
        const timer = get()._pollTimer;
        if (timer) {
          clearTimeout(timer);
          set({ _pollTimer: null });
        }
      },

      reset: () => {
        const timer = get()._pollTimer;
        if (timer) clearTimeout(timer);
        set({
          status: "idle",
          timedOut: false,
          provider: null,
          sessionId: null,
          orderId: null,
          error: null,
          redirectUrl: null,
          _pollTimer: null,
        });
      },

      clearPersistedState: () => {
        try {
          localStorage.removeItem("onlinecompetitions-checkout");
        } catch {}
      },
    }),
    {
      name: "onlinecompetitions-checkout",
      partialize: (state) => ({
        provider: state.provider,
        sessionId: state.sessionId,
      }),
    }
  )
);
