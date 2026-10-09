"use client";

import { useEffect } from "react";
import { captureSentryTestError, isSentryEnabled } from "@/instrument";

export default function SentryDebugPage() {
  useEffect(() => {
    if (!isSentryEnabled()) {
      return;
    }
    captureSentryTestError();
  }, []);

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="mb-3 text-xl font-semibold">GlitchTip test event sent</h1>
      <p className="text-sm text-muted-foreground">
        Check the onlinecompetitions-admin project in GlitchTip for a staging test error.
      </p>
    </main>
  );
}
