"use client";

import { api, queryKeys, STALE_TIME_ADMIN } from "@oc/api-admin";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function PrefetchBurst({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  useEffect(() => {
    void qc.prefetchQuery({
      queryKey: queryKeys.admin.competitions("", "", 1, 20),
      queryFn: () => api.get("/api/admin/competitions", { params: { page: 1, limit: 20 } }),
      staleTime: STALE_TIME_ADMIN,
    });
    void qc.prefetchQuery({
      queryKey: queryKeys.admin.orders(1, "", "", 20),
      queryFn: () => api.get("/api/admin/orders", { params: { page: 1, limit: 20 } }),
      staleTime: STALE_TIME_ADMIN,
    });
    void qc.prefetchQuery({
      queryKey: queryKeys.admin.users("", "", 1, 20),
      queryFn: () => api.get("/api/admin/users", { params: { page: 1, limit: 20 } }),
      staleTime: STALE_TIME_ADMIN,
    });
    void qc.prefetchQuery({
      queryKey: queryKeys.admin.winners("", "", "", 1, 20),
      queryFn: () => api.get("/api/admin/winners", { params: { page: 1, limit: 20 } }),
      staleTime: STALE_TIME_ADMIN,
    });
  }, [qc]);

  return <>{children}</>;
}
