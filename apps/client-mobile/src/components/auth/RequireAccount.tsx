"use client";

import { useAuth } from "@oc/api-client";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";

type RequireAccountProps = {
  children: ReactNode;
  requireVerified?: boolean;
};

export function RequireAccount({ children, requireVerified = false }: RequireAccountProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user || user.isAnonymous) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?returnTo=${returnTo}`} replace />;
  }

  if (requireVerified && user.email && user.emailVerified !== true) {
    const returnTo = encodeURIComponent(location.pathname);
    return (
      <Navigate
        to={`/auth/verify?email=${encodeURIComponent(user.email)}&returnTo=${returnTo}`}
        replace
      />
    );
  }

  return children;
}
