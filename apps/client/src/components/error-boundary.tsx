"use client";

import { Loader2Icon } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { hashError, isChunkLoadError, shouldReloadOnError } from "@/lib/version-error-state";

interface Props {
  children: ReactNode;
  buildVersion: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  isUpdating: boolean;
}

function pollAndReload(): void {
  setTimeout(async () => {
    try {
      const res = await fetch("/api/version", { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        window.location.reload();
        return;
      }
    } catch {
      /* retry */
    }
    pollAndReload();
  }, 500);
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isUpdating: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    const buildVersion = this.props.buildVersion;

    if (!buildVersion) {
      // No build version  -  treat as regular error, don't reload
      return;
    }

    const errorHash = hashError(error);

    if (isChunkLoadError(error)) {
      this.setState({ isUpdating: true });
      pollAndReload();
      return;
    }

    if (shouldReloadOnError(errorHash, buildVersion)) {
      this.setState({ isUpdating: true });
      pollAndReload();
    }
  }

  render(): ReactNode {
    if (this.state.isUpdating) {
      return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
          <Loader2Icon className="size-10 animate-spin text-white" />
          <p className="text-lg font-medium text-white">Updating application</p>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <h1 className="text-xl font-semibold">Something went wrong</h1>
              <p className="mt-2 text-muted-foreground">Please refresh the page to try again.</p>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
