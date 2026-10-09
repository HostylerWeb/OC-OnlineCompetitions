import { cn } from "@oc/utils";
import type { ElementType, ReactNode } from "react";

const containerVariants = {
  wide: "oc-container-wide",
  feature: "oc-container-feature",
  medium: "oc-container-medium",
  content: "oc-container-content",
  narrow: "oc-container-narrow",
  auth: "oc-container-auth",
} as const;

export type PageContainerVariant = keyof typeof containerVariants;

export const pageContainerClass = (variant: PageContainerVariant = "wide") =>
  containerVariants[variant];

interface PageContainerProps {
  variant?: PageContainerVariant;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export function PageContainer({
  variant = "wide",
  as: Tag = "div",
  className,
  children,
}: PageContainerProps) {
  return <Tag className={cn(containerVariants[variant], className)}>{children}</Tag>;
}
