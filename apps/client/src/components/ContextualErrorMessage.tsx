"use client";
import type { ContextualError } from "@oc/api-client";
import { cn } from "@/lib/utils";

export interface ContextualErrorMessageProps {
  error: ContextualError | string | null | undefined;
  className?: string;
  linkClassName?: string;
}

export function ContextualErrorMessage({
  error,
  className,
  linkClassName,
}: ContextualErrorMessageProps) {
  if (!error) return null;

  const resolved: ContextualError = typeof error === "string" ? { message: error } : error;

  return (
    <span className={cn("inline", className)}>
      <span>{resolved.message}</span>
      {resolved.action ? (
        <>
          {" "}
          <a
            href={resolved.action.href}
            className={cn(
              "font-medium text-gold underline-offset-2 hover:underline focus-visible:underline",
              linkClassName
            )}
          >
            {resolved.action.label}
          </a>
        </>
      ) : null}
    </span>
  );
}
