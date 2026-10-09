import {
  BRAND_LOGO_CLASS,
  BRAND_LOGO_CLASS_SQUARE,
  BRAND_LOGO_PATH,
  BRAND_NAME,
  cn,
} from "@oc/utils";

interface BrandLogoBaseProps {
  className?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
}

export interface BrandLogoProps extends BrandLogoBaseProps {}

export function BrandLogo({
  className,
  "aria-label": ariaLabel = BRAND_NAME,
  "aria-hidden": ariaHidden,
}: BrandLogoProps) {
  return (
    <img
      src={BRAND_LOGO_PATH}
      alt={ariaHidden ? "" : ariaLabel}
      aria-hidden={ariaHidden || undefined}
      className={cn(BRAND_LOGO_CLASS, "max-w-[min(100%,280px)] object-contain object-left", className)}
      decoding="async"
    />
  );
}

export interface BrandLogoSquareProps extends BrandLogoBaseProps {}

export function BrandLogoSquare({
  className,
  "aria-label": ariaLabel = BRAND_NAME,
  "aria-hidden": ariaHidden,
}: BrandLogoSquareProps) {
  return (
    <BrandLogo
      className={cn(BRAND_LOGO_CLASS_SQUARE, "object-contain object-center", className)}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
    />
  );
}

export interface LogoSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const spinnerSizes = {
  sm: "h-9",
  md: "h-12",
  lg: "h-16",
} as const;

export function LogoSpinner({ className, size = "md" }: LogoSpinnerProps) {
  return (
    <BrandLogo
      className={cn(spinnerSizes[size], "animate-pulse", className)}
      aria-hidden
    />
  );
}
