"use client";
import React from "react";
import { useKinoStore } from "./store";

interface ParallaxProps {
  speed?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * `<Parallax>`  -  translates children vertically based on scroll speed.
 * Speed < 1 means slower than scroll (background effect).
 * Speed > 1 means faster than scroll (foreground effect).
 */
export function Parallax({ speed = 0.5, children, className, style }: ParallaxProps) {
  // We use the global store's scrollY to compute parallax offset.
  // The offset is applied via CSS transform, which is GPU-accelerated.
  const scrollY = useKinoStore((s) => s.scrollY);
  const translateY = scrollY * speed;

  return (
    <div
      className={className}
      style={{
        ...style,
        transform: `translateY(${translateY}px)`,
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
