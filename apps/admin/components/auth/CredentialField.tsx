"use client";

import { Check, Copy } from "@oc/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CredentialFieldProps {
  label: string;
  value: string;
  variant?: "default" | "primary";
}

export function CredentialField({ label, value, variant = "default" }: CredentialFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <code
          className={
            variant === "primary"
              ? "flex-1 break-all text-sm text-primary"
              : "flex-1 break-all text-sm text-foreground"
          }
        >
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
