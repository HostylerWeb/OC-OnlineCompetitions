import { QueryProvider } from "@oc/api-client";
import { Loader2Icon } from "lucide-react";
import { useEffect } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { useBuildVersion } from "@/hooks/useBuildVersion";
import { captureAffiliateParams } from "@/lib/affiliate-tracker";

const BUILD_VERSION = import.meta.env.VITE_APP_VERSION || "";

export function Wrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    captureAffiliateParams();
  }, []);

  return (
    <QueryProvider>
      <ErrorBoundary buildVersion={BUILD_VERSION}>
        <BuildVersionWatcher />
        {children}
      </ErrorBoundary>
    </QueryProvider>
  );
}

function BuildVersionWatcher() {
  const { isUpdating } = useBuildVersion();
  if (!isUpdating) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
      <Loader2Icon className="size-10 animate-spin text-white" />
      <p className="text-lg font-medium text-white">Updating application</p>
    </div>
  );
}
