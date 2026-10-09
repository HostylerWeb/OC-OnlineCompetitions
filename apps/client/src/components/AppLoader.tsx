import { cn } from "@/lib/utils";
import { BrandLogo } from "./BrandLogo";
import { Spinner, spinnerSizes } from "./ui/spinner";

interface AppLoaderProps {
  label?: string;
  className?: string;
  /** Full viewport (routes, auth). Compact for nested panels. */
  variant?: "fullscreen" | "compact";
  /** When false, skip enter animations (for seamless bootstrap handoff). */
  animate?: boolean;
}

interface InlineLoaderProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const inlineSpinnerSize = {
  sm: spinnerSizes.sm,
  md: spinnerSizes.md,
  lg: spinnerSizes.lg,
} as const;

function AppLoader({ label = "Loading", className, variant = "fullscreen" }: AppLoaderProps) {
  const isFullscreen = variant === "fullscreen";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-5 bg-background",
        isFullscreen ? "min-h-[100dvh] w-full" : "min-h-[12rem] w-full py-12",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className={cn(
          "relative flex items-center justify-center",
          isFullscreen ? "size-[4.5rem]" : "size-14"
        )}
      >
        <span
          className="absolute inset-0 rounded-full border-2 border-gold/12 border-t-gold/75 animate-ring-spin"
          aria-hidden="true"
        />
        <BrandLogo
          className={cn("block shrink-0 text-gold", isFullscreen ? "h-12" : "h-10")}
          aria-hidden
        />
      </div>
      {label ? (
        <p className="text-center text-[0.6875rem] font-medium uppercase tracking-[0.26em] pl-[0.26em] text-muted-foreground/90">
          {label}
        </p>
      ) : null}
    </div>
  );
}

const RouteFallback = AppLoader;

function InlineLoader({ label, className, size = "md" }: InlineLoaderProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-8", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? "Loading"}
    >
      <Spinner className={inlineSpinnerSize[size]} />
      {label ? <p className="text-sm text-muted-foreground/90">{label}</p> : null}
    </div>
  );
}

/** Centered loader for auth/session gates (matches route fallback branding). */
function AuthLoader({ className }: { className?: string }) {
  return <AppLoader variant="fullscreen" className={className} />;
}

export type { AppLoaderProps, InlineLoaderProps };
export { AppLoader, AuthLoader, InlineLoader, RouteFallback };
