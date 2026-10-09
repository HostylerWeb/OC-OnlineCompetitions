import { authClient } from "@oc/auth-client";
import { useCartUiStore } from "./cart-ui";
import { useCheckout } from "./checkout";
import { useInstantPrizeDrawerStore } from "./instant-prize-drawer";

export function clearAllStores() {
  useCheckout.getState().stopPolling();
  useCheckout.getState().reset();
  useCheckout.getState().clearPersistedState();
  useCartUiStore.getState().clearDismissed();
  useInstantPrizeDrawerStore.getState().close();
}

export async function logoutAll(): Promise<void> {
  clearAllStores();
  await authClient.signOut();
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}
