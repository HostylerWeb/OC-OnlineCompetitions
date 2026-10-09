"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scrollTracker } from "./store";

export interface FrameScrollProps {
  framePrefix: string;
  totalFrames: number;
  fps?: number;
  poster?: string;
}

function padFrame(n: number, digits = 4): string {
  return String(n).padStart(digits, "0");
}

interface LoadedFrames {
  [index: number]: HTMLImageElement;
}

/* ── Gold grain SVG data URI ─────────────────────────────── */
const GOLD_GRAIN_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E";

/** Maximum frames to retain in the LRU cache. */
const MAX_CACHE_SIZE = 400;

export function FrameScroll({ framePrefix, totalFrames, fps: _fps, poster }: FrameScrollProps) {
  const [isClient, setIsClient] = useState(false);
  const [phase1Done, setPhase1Done] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [framesHealthy, setFramesHealthy] = useState<boolean | null>(null);

  const imgARef = useRef<HTMLImageElement>(null);
  const imgBRef = useRef<HTMLImageElement>(null);
  const lastFrameIndexRef = useRef<number>(-1);

  // Frame cache with LRU access tracking
  const frameCacheRef = useRef<LoadedFrames>({});
  const cacheOrderRef = useRef<number[]>([]);
  const loadingRef = useRef<Set<number>>(new Set());
  const cacheSizeRef = useRef<number>(0);

  // Scroll shimmer
  const shimmerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressRef = useRef<number>(0);

  // Connection-aware config
  const connectionRef = useRef<{ saveData: boolean; effectiveType: string }>({
    saveData: false,
    effectiveType: "4g",
  });
  const configRef = useRef<{
    initialPreload: number;
    preloadConcurrency: number;
    idleBatchSize: number;
  }>({
    initialPreload: 120,
    preloadConcurrency: 25,
    idleBatchSize: 20,
  });

  // Luminance detection
  const [bgColor, setBgColor] = useState("oklch(0.1 0 0)");
  const detectedBgRef = useRef(false);

  function detectLuminance(img: HTMLImageElement) {
    if (detectedBgRef.current) return;
    try {
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 32;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
      const avg = sum / (d.length / 4);
      setBgColor(avg > 180 ? "oklch(0.96 0 0)" : "oklch(0.1 0 0)");
      detectedBgRef.current = true;
    } catch {
      /* canvas tainted → stay default */
    }
  }

  // Throttle loadedCount updates via rAF
  const loadedCountBatchRef = useRef<number>(0);
  const loadedCountRafRef = useRef<number | null>(null);

  // Build frame URLs  -  every frame, no stride
  const frameUrls = useRef<string[]>([]);
  const totalFramesRef = useRef<number>(0);

  useEffect(() => {
    const urls: string[] = [];
    for (let i = 0; i < totalFrames; i++) {
      urls.push(`${framePrefix}${padFrame(i + 1)}.jpg`);
    }
    frameUrls.current = urls;
    totalFramesRef.current = urls.length;

    // Detect connection quality
    const cn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    if (cn) {
      connectionRef.current = {
        saveData: cn.saveData ?? false,
        effectiveType: cn.effectiveType ?? "4g",
      };
    }

    // Adjust for save-data / slow connections
    if (connectionRef.current.saveData || connectionRef.current.effectiveType === "2g") {
      configRef.current = {
        initialPreload: 30,
        preloadConcurrency: 10,
        idleBatchSize: 10,
      };
    } else if (connectionRef.current.effectiveType === "3g") {
      configRef.current = {
        initialPreload: 50,
        preloadConcurrency: 15,
        idleBatchSize: 15,
      };
    }

    // Health check: try loading frame 0
    if (urls.length > 0) {
      const probe = new Image();
      probe.onload = () => setFramesHealthy(true);
      probe.onerror = () => setFramesHealthy(false);
      probe.src = urls[0];
    } else {
      setFramesHealthy(false);
    }
  }, [framePrefix, totalFrames]);

  const flushLoadedCount = useCallback(() => {
    loadedCountRafRef.current = null;
    if (loadedCountBatchRef.current > 0) {
      setLoadedCount((c) => c + loadedCountBatchRef.current);
      loadedCountBatchRef.current = 0;
    }
  }, []);

  const incLoadedCount = useCallback(() => {
    loadedCountBatchRef.current++;
    if (loadedCountRafRef.current === null) {
      loadedCountRafRef.current = requestAnimationFrame(flushLoadedCount);
    }
  }, [flushLoadedCount]);

  // LRU eviction  -  O(1) FIFO with protected ±10 window
  const evictCache = useCallback((currentFrame: number) => {
    const cache = frameCacheRef.current;
    const order = cacheOrderRef.current;
    while (cacheSizeRef.current >= MAX_CACHE_SIZE) {
      let worstIdx = -1;
      let worstDist = -1;
      for (let i = order.length - 1; i >= 0; i--) {
        const frameIdx = order[i];
        if (Math.abs(frameIdx - currentFrame) <= 10) continue;
        const dist = Math.abs(frameIdx - currentFrame);
        if (dist > worstDist) {
          worstDist = dist;
          worstIdx = i;
        }
      }
      if (worstIdx === -1) break;
      const evictFrame = order.splice(worstIdx, 1)[0];
      delete cache[evictFrame];
      cacheSizeRef.current--;
    }
  }, []);

  // Load a single frame
  const preloadFrame = useCallback(
    (index: number): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const cache = frameCacheRef.current;
        if (cache[index]) {
          const order = cacheOrderRef.current;
          const pos = order.indexOf(index);
          if (pos !== -1) order.splice(pos, 1);
          order.push(index);
          resolve(cache[index]);
          return;
        }
        if (loadingRef.current.has(index)) {
          resolve(cache[index]);
          return;
        }

        const img = new Image();
        img.src = frameUrls.current[index];
        loadingRef.current.add(index);

        img.onload = () => {
          if (cacheSizeRef.current >= MAX_CACHE_SIZE) {
            evictCache(lastFrameIndexRef.current);
          }
          cache[index] = img;
          cacheOrderRef.current.push(index);
          cacheSizeRef.current++;
          loadingRef.current.delete(index);
          incLoadedCount();
          resolve(img);
        };

        img.onerror = () => {
          loadingRef.current.delete(index);
          resolve(img);
        };
      });
    },
    [evictCache, incLoadedCount]
  );

  // Load frames in priority order
  const loadFrames = useCallback(
    async (indices: number[], priority: "high" | "low" = "low") => {
      const concurrencyLimit = priority === "high" ? 999 : configRef.current.preloadConcurrency;
      for (let i = 0; i < indices.length; i += concurrencyLimit) {
        const chunk = indices.slice(i, i + concurrencyLimit);
        await Promise.all(chunk.map(preloadFrame));
      }
    },
    [preloadFrame]
  );

  // Session tracking for StrictMode safety
  const sessionRef = useRef<number>(0);
  const abortedRef = useRef<boolean>(false);
  const idleCallbackRef = useRef<number | null>(null);

  // Dual-phase loader
  const loadAllFrames = useCallback(async () => {
    if (frameUrls.current.length === 0) return;

    const currentSession = ++sessionRef.current;
    abortedRef.current = false;

    const { initialPreload, idleBatchSize } = configRef.current;
    const effectiveCount = totalFramesRef.current;

    // ── Phase 1: Immediate high-priority load ──
    const phase1: number[] = [];
    for (let i = 0; i < Math.min(initialPreload, effectiveCount); i++) {
      phase1.push(i);
    }
    await loadFrames(phase1, "high");
    if (abortedRef.current || sessionRef.current !== currentSession) return;

    // Phase 1 done  -  switch from poster to live frames
    setPhase1Done(true);

    // Phase 1B: next batch
    const phase1B: number[] = [];
    for (let i = initialPreload; i < Math.min(initialPreload * 2, effectiveCount); i++) {
      phase1B.push(i);
    }
    await loadFrames(phase1B, "high");
    flushLoadedCount();
    setLoadedCount(Math.min(initialPreload * 2, effectiveCount));
    if (abortedRef.current || sessionRef.current !== currentSession) return;

    // ── Phase 2: Background idle loading ──
    const remaining: number[] = [];
    for (let i = initialPreload * 2; i < effectiveCount; i++) {
      remaining.push(i);
    }

    if (remaining.length === 0) {
      if (!abortedRef.current && sessionRef.current === currentSession) setAllLoaded(true);
      return;
    }

    const idleLoad = (deadline?: IdleDeadline) => {
      if (abortedRef.current || sessionRef.current !== currentSession) return;

      while (remaining.length > 0) {
        if (deadline && deadline.timeRemaining() <= 0) {
          idleCallbackRef.current = requestIdleCallback(idleLoad, { timeout: 3000 });
          return;
        }
        const batch = remaining.splice(0, idleBatchSize);
        loadFrames(batch, "low").then(() => {
          flushLoadedCount();
          if (
            remaining.length === 0 &&
            !abortedRef.current &&
            sessionRef.current === currentSession
          ) {
            // Pre-warm ±5 frames from center after all loaded
            const center = Math.floor(effectiveCount / 2);
            const warmUp: number[] = [];
            for (let d = -5; d <= 5; d++) {
              const idx = center + d;
              if (idx >= 0 && idx < totalFramesRef.current) warmUp.push(idx);
            }
            loadFrames(
              warmUp.filter((i) => !frameCacheRef.current[i]),
              "low"
            );
            setAllLoaded(true);
          }
        });
      }
    };

    requestIdleCallback(idleLoad, { timeout: 3000 });
  }, [loadFrames, flushLoadedCount]);

  useEffect(() => {
    setIsClient(true);
    loadAllFrames();
    return () => {
      abortedRef.current = true;
      if (idleCallbackRef.current !== null) {
        cancelIdleCallback(idleCallbackRef.current);
        idleCallbackRef.current = null;
      }
      if (loadedCountRafRef.current !== null) {
        cancelAnimationFrame(loadedCountRafRef.current);
        loadedCountRafRef.current = null;
      }
    };
  }, [loadAllFrames]);

  // ── Direct frame update (1:1 scroll-to-frame, no smoothing) ──

  const updateFrame = useCallback(
    (progress: number) => {
      const effectiveCount = totalFramesRef.current;
      if (effectiveCount === 0) return;

      const rawFrameIndex = progress * effectiveCount;
      const frameIndex = Math.min(Math.floor(rawFrameIndex), effectiveCount - 1);
      const nextFrameIndex = Math.min(frameIndex + 1, effectiveCount - 1);
      const frameFraction = rawFrameIndex - frameIndex;

      const urlIdx = frameIndex;
      const nextUrlIdx = Math.min(nextFrameIndex, effectiveCount - 1);

      // Swap image srcs when crossing a frame boundary
      if (frameIndex !== lastFrameIndexRef.current && imgARef.current && imgBRef.current) {
        lastFrameIndexRef.current = frameIndex;

        imgARef.current.src = frameUrls.current[urlIdx];
        imgBRef.current.src = frameUrls.current[nextUrlIdx];

        // ── Speculative preload ──
        const direction = frameIndex >= (lastFrameIndexForSpeculativeRef.current ?? 0) ? 1 : -1;
        lastFrameIndexForSpeculativeRef.current = frameIndex;

        const critical: number[] = [];
        for (let d = -2; d <= 2; d++) {
          const idx = frameIndex + d;
          if (idx >= 0 && idx < effectiveCount) critical.push(idx);
        }

        const forwardZone: number[] = [];
        const forwardStart = frameIndex + (direction === 1 ? 3 : -8);
        const forwardEnd = frameIndex + (direction === 1 ? 12 : -3);
        for (let i = forwardStart; i < forwardEnd; i++) {
          if (i >= 0 && i < effectiveCount) forwardZone.push(i);
        }

        loadFrames(
          critical.filter((i) => !frameCacheRef.current[i] && !loadingRef.current.has(i)),
          "high"
        );
        loadFrames(
          forwardZone.filter((i) => !frameCacheRef.current[i] && !loadingRef.current.has(i)),
          "low"
        );
      }

      // Ping-pong crossfade
      const isEven = frameIndex % 2 === 0;
      const fadeProgress = isEven ? frameFraction : 1 - frameFraction;

      if (imgARef.current && imgBRef.current) {
        imgARef.current.style.opacity = String(isEven ? 1 - fadeProgress : fadeProgress);
        imgBRef.current.style.opacity = String(isEven ? fadeProgress : 1 - fadeProgress);
      }
    },
    [loadFrames]
  );

  // Track speculative preload reference separately
  const lastFrameIndexForSpeculativeRef = useRef<number>(0);

  // Snap to current scroll position when phase 1 completes
  const didInitialSnapRef = useRef(false);
  useEffect(() => {
    if (phase1Done && isClient && !didInitialSnapRef.current) {
      didInitialSnapRef.current = true;
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const scrollHeight = document.documentElement.scrollHeight;
      const maxScroll = scrollHeight - viewportHeight;
      const progress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;
      updateFrame(progress);
    }
  }, [phase1Done, isClient, updateFrame]);

  // Scroll shimmer trigger
  const triggerShimmer = useCallback((currentProgress: number) => {
    const delta = Math.abs(currentProgress - lastProgressRef.current);
    lastProgressRef.current = currentProgress;

    const shimmerEl = document.getElementById("frame-shimmer");
    if (!shimmerEl) return;

    if (delta > 0.006) {
      shimmerEl.style.opacity = "1";
      if (shimmerTimeoutRef.current) clearTimeout(shimmerTimeoutRef.current);
      shimmerTimeoutRef.current = setTimeout(() => {
        shimmerEl.style.opacity = "0";
      }, 600);
    }
  }, []);

  // Scroll handler  -  direct 1:1 frame update, no rAF loop
  useEffect(() => {
    if (!isClient) return;

    const onScroll = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const scrollHeight = document.documentElement.scrollHeight;
      const maxScroll = scrollHeight - viewportHeight;
      const progress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;

      updateFrame(progress);
      triggerShimmer(progress);
    };

    const unsub = scrollTracker.subscribe(onScroll);
    onScroll();
    return () => {
      unsub();
      if (shimmerTimeoutRef.current) clearTimeout(shimmerTimeoutRef.current);
    };
  }, [isClient, updateFrame, triggerShimmer]);

  if (!isClient) return null;
  if (framesHealthy === false) return null;

  const showPoster = (!phase1Done || framesHealthy === null) && poster;
  const posterUrl = poster && frameUrls.current.length > 0 ? poster : undefined;
  const effectiveCount = totalFramesRef.current || totalFrames;

  return (
    <div
      className="fixed inset-0 -z-10 will-change-[contents]"
      style={{ background: bgColor, transition: "background 0.8s ease" }}
    >
      {/* Loading progress bar */}
      {!allLoaded && (
        <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-gold)] to-amber-400 transition-all duration-300"
            style={{
              width: `${(loadedCount / effectiveCount) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Poster shown until Phase 1 completes */}
      {showPoster && posterUrl && (
        <img
          src={posterUrl}
          alt=""
          className="absolute inset-0 z-[1] h-full w-full object-cover blur-sm"
          aria-hidden="true"
          fetchPriority="high"
        />
      )}

      {/* Frame A */}
      <img
        ref={imgARef}
        src={frameUrls.current[0] ?? ""}
        onLoad={(e) => detectLuminance(e.currentTarget)}
        alt=""
        className="absolute inset-0 z-[2] h-full w-full object-cover"
        style={{ opacity: 1, willChange: "opacity" }}
        aria-hidden="true"
        loading="eager"
        fetchPriority="high"
      />

      {/* Frame B */}
      <img
        ref={imgBRef}
        src={frameUrls.current[1] ?? ""}
        alt=""
        className="absolute inset-0 z-[3] h-full w-full object-cover"
        style={{ opacity: 0, willChange: "opacity" }}
        aria-hidden="true"
        loading="eager"
        fetchPriority="high"
      />

      {/* ── Layered cinematic overlays ── */}

      {/* Layer 1: Stable dark base  -  masks frame flicker behind content */}
      <div
        className="pointer-events-none absolute inset-0 z-[4]"
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 45%, oklch(0.1 0 0 / 0.88) 0%, oklch(0.1 0 0 / 0.5) 50%, transparent 100%)",
        }}
      />

      {/* Layer 2: Top vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background: "linear-gradient(to bottom, oklch(0.1 0 0 / 0.85) 0%, transparent 40%)",
        }}
      />

      {/* Layer 3: Bottom fade */}
      <div
        className="pointer-events-none absolute inset-0 z-[6]"
        style={{
          background: "linear-gradient(to top, oklch(0.1 0 0 / 0.90) 0%, transparent 50%)",
        }}
      />

      {/* Layer 4: Left vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[7]"
        style={{
          background: "linear-gradient(to right, oklch(0.1 0 0 / 0.30) 0%, transparent 25%)",
        }}
      />

      {/* Layer 5: Right vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[8]"
        style={{
          background: "linear-gradient(to left, oklch(0.1 0 0 / 0.30) 0%, transparent 25%)",
        }}
      />

      {/* Layer 6: Gold grain texture at 3% opacity */}
      <div
        className="pointer-events-none absolute inset-0 z-[9] opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage: `url("${GOLD_GRAIN_DATA_URI}")`,
          backgroundSize: "300px 300px",
        }}
      />

      {/* Layer 7: Scroll-triggered gold shimmer sweep */}
      <div
        id="frame-shimmer"
        className="pointer-events-none absolute inset-0 z-[10] opacity-0"
        style={{
          background:
            "linear-gradient(105deg, transparent 30%, oklch(0.82 0.14 85 / 0.08) 50%, transparent 70%)",
          transition: "opacity 0.4s ease",
        }}
      />
    </div>
  );
}
