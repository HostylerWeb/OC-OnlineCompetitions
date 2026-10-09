"use client";

import type { ReactNode } from "react";
import { BrandLogoSquare } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const maxWidthClass = {
  sm: "max-w-sm",
  md: "max-w-md",
} as const;

export interface AdminAuthLayoutProps {
  children: ReactNode;
  maxWidth?: keyof typeof maxWidthClass;
}

export function AdminAuthLayout({ children, maxWidth = "sm" }: AdminAuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-background via-background to-muted/30 px-4 py-12 sm:px-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(212,175,55,0.08),transparent)]" />
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle data-umami-event="nav:theme-toggle" />
      </div>
      <div className={cn("flex w-full flex-col gap-5", maxWidthClass[maxWidth])}>{children}</div>
    </div>
  );
}

export interface AdminAuthBrandProps {
  subtitle?: ReactNode;
}

export function AdminAuthBrand({ subtitle }: AdminAuthBrandProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 shadow-sm">
        <BrandLogoSquare className="size-6 text-primary" aria-hidden />
      </div>
      {subtitle ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

export interface AdminAuthCardProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  headerMedia?: ReactNode;
  showBrand?: boolean;
  brandSubtitle?: ReactNode;
  className?: string;
}

export function AdminAuthCard({
  title,
  description,
  children,
  footer,
  headerMedia,
  showBrand = false,
  brandSubtitle,
  className,
}: AdminAuthCardProps) {
  const media = headerMedia ?? (showBrand ? <AdminAuthBrand subtitle={brandSubtitle} /> : null);

  return (
    <Card className={cn("animate-fade-in-scale shadow-lg", className)}>
      <CardHeader className="items-center gap-4 pb-4 text-center">
        {media}
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-xl font-semibold tracking-tight">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-balance leading-relaxed">
              {description}
            </CardDescription>
          ) : null}
        </div>
      </CardHeader>

      {children ? <CardContent className="pt-0">{children}</CardContent> : null}

      {footer ? (
        <>
          <Separator className="my-0" />
          <CardFooter className="justify-center px-6 pb-5 pt-4">{footer}</CardFooter>
        </>
      ) : null}
    </Card>
  );
}
