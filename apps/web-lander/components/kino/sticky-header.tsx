"use client";
import React, { useEffect, useState } from "react";
import { useKinoStore } from "./store";

interface StickyHeaderProps {
  threshold?: number;
  background?: string;
  blur?: boolean;
  showAt?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * `<StickyHeader>`  -  fixed header that transitions from transparent to solid
 * based on scroll position. Also supports `showAt` (0→1 progress threshold)
 * for more fine-grained control over visibility.
 */
export function StickyHeader({
  threshold = 80,
  background = "rgba(0,0,0,0.8)",
  blur = true,
  showAt,
  children,
  className,
  style,
}: StickyHeaderProps) {
  const scrollY = useKinoStore((s) => s.scrollY);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // If showAt is provided, use page-level progress for visibility
  const isVisibleByProgress = showAt !== undefined && scrollY > 0;
  const isVisibleByThreshold = scrollY > threshold;

  const isVisible = showAt !== undefined ? isVisibleByProgress : isVisibleByThreshold;

  const transition = reducedMotion
    ? "none"
    : "background 0.3s ease, backdrop-filter 0.3s ease, border-color 0.3s ease";

  const headerStyle: React.CSSProperties = {
    ...style,
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    background: isVisible ? background : "transparent",
    backdropFilter: isVisible && blur ? "blur(12px)" : "none",
    WebkitBackdropFilter: isVisible && blur ? "blur(12px)" : "none",
    borderBottom: isVisible ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
    transition,
  };

  return (
    <header className={className} style={headerStyle}>
      {children}
    </header>
  );
}
