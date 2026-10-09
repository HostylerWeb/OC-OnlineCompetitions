// useConsumeQueryParams  -  removes specified query params from the URL.
// Compatible with Vike (client-side only, uses History API).
"use client";

import { useEffect, useMemo } from "react";

export function useConsumeQueryParams(params: string[]) {
  const paramsKey = useMemo(() => params.join(","), params);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    let changed = false;
    for (const p of params) {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState(null, "", url.toString());
    }
  }, [paramsKey]);
}
