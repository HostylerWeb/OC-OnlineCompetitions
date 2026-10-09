"use client";
import * as Sentry from "@sentry/react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { GoldButton, GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { BrandLogo } from "./BrandLogo";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: string;
  errorId?: string;
}

function generateErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}`;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    Sentry.captureException(error, { tags: { domain: "web.errorBoundary" } });
    return {
      hasError: true,
      error: error.message || "An unexpected error occurred.",
      errorId: generateErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ErrorPage error={this.state.error} errorId={this.state.errorId} />;
    }

    return this.props.children;
  }
}

interface ErrorPageProps {
  error?: string;
  errorId?: string;
  title?: string;
  message?: string;
  showHomeButton?: boolean;
  onRetry?: () => void;
  retryIcon?: LucideIcon;
}

export function ErrorPage({
  error,
  errorId,
  title,
  message,
  showHomeButton = true,
  onRetry,
  retryIcon: RetryIcon,
}: ErrorPageProps) {
  const isError = Boolean(error);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-gold/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <BrandLogo className="h-6 w-auto text-gold" />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto py-16">
          <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            {title ?? (isError ? "Something went wrong" : "Page not found")}
          </h1>

          <p className="text-muted-foreground text-base mb-6">
            {message ??
              (isError
                ? "An unexpected error occurred. Please try again later."
                : "The page you're looking for doesn't exist or has been moved.")}
          </p>

          {isError && errorId && (
            <p className="text-xs text-muted-foreground/60 font-mono mb-8">Error ID: {errorId}</p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {onRetry && (
              <GoldOutlineButton type="button" onClick={onRetry}>
                {RetryIcon && <RetryIcon className="w-4 h-4" />}
                Try again
              </GoldOutlineButton>
            )}
            <GoldOutlineButton type="button" onClick={() => window.history.back()}>
              Go back
            </GoldOutlineButton>
            {showHomeButton && (
              <GoldButton asChild>
                <Link href="/">Back to home</Link>
              </GoldButton>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
