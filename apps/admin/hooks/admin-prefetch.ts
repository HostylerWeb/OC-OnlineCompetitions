import { api, queryKeys, STALE_TIME_ADMIN } from "@oc/api-admin";
import type { QueryClient } from "@tanstack/react-query";

export function prefetchAdminRoute(href: string, queryClient: QueryClient): void {
  switch (href) {
    case "/":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.dashboard(),
        queryFn: () => api.get("/api/admin/dashboard/stats"),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/competitions":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.competitions("", "", 1, 20),
        queryFn: () => api.get("/api/admin/competitions", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/orders":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.orders(1, "", "", 20),
        queryFn: () => api.get("/api/admin/orders", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/users":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.users("", "", 1, 20),
        queryFn: () => api.get("/api/admin/users", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/winners":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.winners("", "", "", 1, 20),
        queryFn: () => api.get("/api/admin/winners", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/categories":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.categories(1, 20, ""),
        queryFn: () => api.get("/api/admin/categories", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/instant-prizes":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.instantPrizeTemplates(1, 20, "", ""),
        queryFn: () =>
          api.get("/api/admin/instant-prizes/templates", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/instant-prize-wins":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.instantPrizeWins("", "", "", 1, 20),
        queryFn: () => api.get("/api/admin/instant-prize-wins", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/referrals":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.referrals("", 1, 20),
        queryFn: () => api.get("/api/admin/referral-purchases", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/promo-codes":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.promoCodes(1, 20),
        queryFn: () => api.get("/api/admin/promo-codes", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/payment-methods":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.paymentMethods(),
        queryFn: () => api.get("/api/admin/payment-methods"),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/homepage-layout":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.homepageLayoutSettings(),
        queryFn: () => api.get("/api/admin/homepage-layout-settings"),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/compliance-settings":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.complianceSettings(),
        queryFn: () => api.get("/api/admin/compliance-settings"),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/email-settings":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.emailSettings(),
        queryFn: () => api.get("/api/admin/email-settings"),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/shop/products":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.shopProducts(1, 20, ""),
        queryFn: () => api.get("/api/admin/shop/products", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/shop/categories":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.shopCategories(1, 20, ""),
        queryFn: () => api.get("/api/admin/shop/categories", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/shop/orders":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.shopOrders(1, 20, "", ""),
        queryFn: () => api.get("/api/admin/shop/orders", { params: { page: 1, limit: 20 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
    case "/livestream/draws":
      void queryClient.prefetchQuery({
        queryKey: queryKeys.admin.competitions("", "", 1, 100),
        queryFn: () => api.get("/api/admin/competitions", { params: { page: 1, limit: 100 } }),
        staleTime: STALE_TIME_ADMIN,
      });
      break;
  }
}
