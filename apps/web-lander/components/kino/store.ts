"use client";
import { create } from "zustand";

// ---------------------------------------------------------------------------
// Global scroll store  -  single source of truth for all scroll state
// ---------------------------------------------------------------------------

interface KinoStore {
  scrollY: number;
  viewportHeight: number;
  scrollHeight: number;
  progress: number;
  setScroll: (data: {
    scrollY: number;
    viewportHeight: number;
    scrollHeight: number;
    progress: number;
  }) => void;
}

export const useKinoStore = create<KinoStore>((set) => ({
  scrollY: 0,
  viewportHeight: 0,
  scrollHeight: 0,
  progress: 0,
  setScroll: ({ scrollY, viewportHeight, scrollHeight, progress }) =>
    set({ scrollY, viewportHeight, scrollHeight, progress }),
}));

// ---------------------------------------------------------------------------
// ScrollTracker  -  RAF-batched scroll listener, writes directly to the store
// ---------------------------------------------------------------------------

class ScrollTracker {
  private rafId: number | null = null;
  private lastScrollY: number = -1;
  private isRunning: boolean = false;
  private subscribers: Set<() => void> = new Set();

  private readonly onScroll = () => {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.tick());
    }
  };

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    window.addEventListener("scroll", this.onScroll, { passive: true });
    this.emit();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    window.removeEventListener("scroll", this.onScroll);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private tick(): void {
    this.rafId = null;
    const scrollY = window.scrollY;
    if (scrollY !== this.lastScrollY) {
      this.lastScrollY = scrollY;
      this.emit();
    }
  }

  private emit(): void {
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;
    const scrollHeight = document.documentElement.scrollHeight;
    const maxScroll = scrollHeight - viewportHeight;
    const progress = maxScroll > 0 ? clamp(scrollY / maxScroll, 0, 1) : 0;
    useKinoStore.getState().setScroll({ scrollY, viewportHeight, scrollHeight, progress });
    this.subscribers.forEach((fn) => {
      fn();
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton tracker  -  no context needed, import directly
// ---------------------------------------------------------------------------

export const scrollTracker = new ScrollTracker();

// ---------------------------------------------------------------------------
// Scene progress registry  -  keyed by unique scene ID
// ---------------------------------------------------------------------------

const sceneProgress = new Map<string, number>();

export function registerScene(id: string): () => void {
  sceneProgress.set(id, 0);
  return () => sceneProgress.delete(id);
}

export function updateSceneProgress(id: string, progress: number): void {
  sceneProgress.set(id, progress);
}

export function getSceneProgress(id: string): number {
  return sceneProgress.get(id) ?? 0;
}

// ---------------------------------------------------------------------------
// Core utilities  -  inlined, zero external deps
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function calcSceneProgress(scrollY: number, offsetTop: number, duration: number): number {
  if (duration <= 0) return 0;
  return clamp((scrollY - offsetTop) / duration, 0, 1);
}

export function parseDuration(duration: string, viewportHeight: number): number {
  const trimmed = duration.trim();
  if (trimmed.endsWith("px")) return parseFloat(trimmed);
  if (trimmed.endsWith("vh")) return (parseFloat(trimmed) / 100) * viewportHeight;
  const num = parseFloat(trimmed);
  if (!Number.isNaN(num)) return (num / 100) * viewportHeight;
  return 0;
}

export function easeOut(t: number): number {
  return t * (2 - t);
}
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
export function easeIn(t: number): number {
  return t * t;
}

export const EASINGS: Record<string, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": easeIn,
  "ease-out": easeOut,
  "ease-in-out": easeInOut,
  "ease-out-cubic": (t) => {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  },
  "ease-in-out-cubic": (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};
