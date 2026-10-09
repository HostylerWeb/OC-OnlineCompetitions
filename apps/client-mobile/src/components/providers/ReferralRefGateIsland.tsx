// ReferralRefGateIsland.tsx — captures `?ref=<code>` and stores it for later
// claim after the user signs in.

import { resolveRefFromUrl, setPendingReferralRef } from "@oc/api-client";
import { useEffect } from "react";

export function ReferralRefGateIsland() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search;
    const fromUrl = resolveRefFromUrl(search);
    if (fromUrl) {
      setPendingReferralRef(fromUrl);
      return;
    }
    // No URL ref — AuthProvider handles claim from cookie/sessionStorage.
  }, []);

  return null;
}
