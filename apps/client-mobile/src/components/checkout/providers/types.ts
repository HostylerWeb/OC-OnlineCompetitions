/** Shared props passed to every provider checkout panel from PaymentMethodSelector. */
export interface CheckoutProviderPanelProps {
  /** When false, heavy providers skip SDK/session bootstrap while kept mounted. */
  isActive?: boolean;
  /** When true, providers data is still loading  -  render the panel with a disabled button. */
  isLoading?: boolean;
  /** Reported by providers while a payment is being finalized so the selector can lock switching. */
  onProcessingChange?: (processing: boolean) => void;
}
