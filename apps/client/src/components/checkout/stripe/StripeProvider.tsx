"use client";

import { Elements } from "@stripe/react-stripe-js";
import type { ReactNode } from "react";
import { CheckoutPanelFallback } from "@/components/checkout/CheckoutPanelFallback";
import { getStripePromise } from "./scriptOptions";

interface StripeProviderProps {
  clientId: string;
  clientSecret: string;
  children: ReactNode;
}

export function StripeProvider({ clientId, clientSecret, children }: StripeProviderProps) {
  if (!clientId) {
    return <CheckoutPanelFallback />;
  }

  const stripePromise = getStripePromise(clientId);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorText: "#ffffff",
            colorTextSecondary: "#a0a0b0",
            colorTextPlaceholder: "rgba(255, 255, 255, 0.45)",
            colorBackground: "transparent",
            colorPrimary: "#d4af37",
            borderRadius: "8px",
            fontFamily: '"Syne", ui-sans-serif, system-ui, sans-serif',
            fontSizeBase: "14px",
          },
        },
      }}
    >
      {children}
    </Elements>
  );
}
