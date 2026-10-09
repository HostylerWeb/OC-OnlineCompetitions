"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Confetti from "react-confetti";
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

function ConfettiWrapper() {
  const [width, setWidth] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function handleResize() {
      setWidth(window.innerWidth);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!mounted || width < 1024) return null;

  return (
    <div
      className="absolute top-0 right-0 pointer-events-none"
      style={{ width: "60%", height: "100%", opacity: 0.35 }}
    >
      <Confetti
        width={width * 0.3}
        height={1080}
        numberOfPieces={80}
        recycle={true}
        colors={["#D4AF37", "#C5A028", "#E8C84A", "#F5D76E"]}
        style={{ position: "absolute", top: 0, right: 0 }}
      />
    </div>
  );
}

const maxWidthClass = {
  sm: "max-w-sm",
  md: "max-w-md",
} as const;

export interface AuthShellProps {
  children: ReactNode;
  maxWidth?: keyof typeof maxWidthClass;
}

export function AuthShell({ children, maxWidth = "sm" }: AuthShellProps) {
  return (
    <div className="relative flex min-h-dvh">
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between relative overflow-hidden
                   bg-[radial-gradient(ellipse_80%_60%_at_40%_40%,rgba(212,175,55,0.12),transparent_70%)],
                   bg-[radial-gradient(ellipse_60%_80%_at_70%_70%,rgba(212,175,55,0.06),transparent_60%)],
                   bg-[linear-gradient(135deg,var(--color-primary)\/5_0%,transparent_50%,var(--color-background)_100%)]"
        aria-hidden
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(circle,var(--color-border)_1px,transparent_1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-primary/10 blur-3xl" />

        <ConfettiWrapper />

        <div className="relative z-10 flex justify-end p-6">
          <ThemeToggle data-umami-event="nav:theme-toggle" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 px-12 pb-20 text-center">
          <div className="flex size-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-xl">
            <BrandLogoSquare className="size-12 text-primary" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Welcome to Online Competitions Admin
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-xs">
              Secure dashboard for managing competitions, users, and payouts.
            </p>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex lg:hidden items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-primary/5 via-background to-background">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <BrandLogoSquare className="size-5 text-primary" />
            </div>
            <span className="font-semibold text-foreground">Online Competitions Admin</span>
          </div>
          <ThemeToggle data-umami-event="nav:theme-toggle" />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
          <div
            className={cn(
              "flex w-full flex-col animate-in fade-in slide-in-from-bottom-2 duration-500",
              maxWidthClass[maxWidth]
            )}
          >
            <div className="hidden lg:flex flex-col items-center gap-1.5 mb-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <BrandLogoSquare className="size-7 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Online Competitions Admin
              </h1>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface AuthBrandProps {
  subtitle?: ReactNode;
}

export function AuthBrand({ subtitle }: AuthBrandProps) {
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

export interface AuthCardProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  headerMedia?: ReactNode;
  showBrand?: boolean;
  brandSubtitle?: ReactNode;
  className?: string;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
  headerMedia,
  showBrand = false,
  brandSubtitle,
  className,
}: AuthCardProps) {
  const media = headerMedia ?? (showBrand ? <AuthBrand subtitle={brandSubtitle} /> : null);

  return (
    <Card className={cn("shadow-lg", className)}>
      <CardHeader className="items-center gap-6 pb-6 pt-8 text-center">
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
          <CardFooter className="justify-center px-6 pb-7 pt-5">{footer}</CardFooter>
        </>
      ) : null}
    </Card>
  );
}
