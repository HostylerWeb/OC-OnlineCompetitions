"use client";

import { cn } from "@oc/utils";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef } from "react";

interface TurnstileWidgetProps {
  siteKey: string;
  onToken: (token: string | null) => void;
  className?: string;
  onError?: (error: string) => void;
  refreshKey?: number;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  className,
  onError,
  refreshKey,
}: TurnstileWidgetProps) {
  const ref = useRef<TurnstileInstance>(null);

  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      ref.current?.reset();
    }
  }, [refreshKey]);

  return (
    <Turnstile
      ref={ref}
      siteKey={siteKey}
      onSuccess={onToken}
      onExpire={() => onToken(null)}
      onError={(error) => {
        onToken(null);
        onError?.(error);
      }}
      onTimeout={() => onToken(null)}
      className={cn(
        "mx-auto block w-[300px] rounded-xl",
        "[&_#cf-turnstile]:!rounded-xl",
        "[&_#cf-turnstile]:!overflow-hidden",
        "[&_#cf-turnstile]:!border-0",
        "[&_iframe]:!rounded-xl",
        "[&_iframe]:!border-0",
        "[&_iframe]:!outline-none",
        className
      )}
      options={{ theme: "dark", refreshExpired: "auto" }}
    />
  );
}
