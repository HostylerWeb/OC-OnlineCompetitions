"use client";

import { cn } from "@oc/utils";
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { mobileNavSheetPanelClass } from "./mobile-nav-styles";
import { SheetNavProvider, useSheetNav } from "./sheet-nav-context";

type MobileNavSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  side: "left" | "right";
  title: string;
  className?: string;
  children: ReactNode;
};

function MobileNavSheetPanel({ children }: { children: ReactNode }) {
  const { isExiting } = useSheetNav();

  return <div className={mobileNavSheetPanelClass(isExiting)}>{children}</div>;
}

export function MobileNavSheet({
  open,
  onOpenChange,
  onClose,
  side,
  title,
  className,
  children,
}: MobileNavSheetProps) {
  return (
    <SheetNavProvider open={open} onClose={onClose}>
      <MobileNavSheetInner
        open={open}
        onOpenChange={onOpenChange}
        side={side}
        title={title}
        className={className}
      >
        {children}
      </MobileNavSheetInner>
    </SheetNavProvider>
  );
}

function MobileNavSheetInner({
  open,
  onOpenChange,
  side,
  title,
  className,
  children,
}: Omit<MobileNavSheetProps, "onClose">) {
  const { isExiting } = useSheetNav();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        instantDismiss={isExiting}
        className={cn(
          "w-full max-w-sm gap-0 p-0 bg-card shadow-2xl shadow-black/40",
          side === "right" ? "border-l border-gold/10" : "border-r border-gold/10",
          className
        )}
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <MobileNavSheetPanel>{children}</MobileNavSheetPanel>
      </SheetContent>
    </Sheet>
  );
}
