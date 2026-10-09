import { cn } from "@oc/utils";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef } from "react";
import { useTurnstileStore } from "./turnstile-store";

interface TurnstileWidgetProps {
  siteKey?: string;
  className?: string;
}

export function TurnstileWidget({ siteKey, className }: TurnstileWidgetProps) {
  const ref = useRef<TurnstileInstance>(null);
  const setSuccess = useTurnstileStore((s) => s.setSuccess);
  const setError = useTurnstileStore((s) => s.setError);
  const setFail = useTurnstileStore((s) => s.setFail);
  const reset = useTurnstileStore((s) => s.reset);

  useEffect(() => {
    reset();
  }, []);

  const status = useTurnstileStore((s) => s.status);
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "success" && status === "idle") {
      ref.current?.reset();
    }
    prevStatus.current = status;
  }, [status]);

  if (!siteKey) {
    return <div className="min-h-[65px]" />;
  }

  return (
    <Turnstile
      ref={ref}
      siteKey={siteKey}
      onSuccess={setSuccess}
      onExpire={() => reset()}
      onError={() => setError()}
      onTimeout={() => setFail()}
      className={cn(
        "isolate overflow-hidden",
        "[&_#cf-turnstile]:isolate",
        "[&_#cf-turnstile]:overflow-hidden",
        "[&_#cf-turnstile_iframe]:overflow-hidden",
        "min-h-[65px]",
        className
      )}
      options={{ theme: "dark", refreshExpired: "auto" }}
    />
  );
}
