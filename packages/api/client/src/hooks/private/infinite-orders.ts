import type { ApiResponse, MeOrderDto } from "@oc/types";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../client";
import { STALE_TIME_USER } from "../../constants";
import { queryKeys } from "../../keys";
import { getOffsetNextPageParam } from "../../lib/pagination";

export function useInfiniteMyOrders(
  limit = 10,
  options?: { initialData?: InfiniteData<ApiResponse<MeOrderDto[]>> }
) {
  return useInfiniteQuery<ApiResponse<MeOrderDto[]>>({
    queryKey: [...queryKeys.my.orders(), "infinite", limit] as const,
    queryFn: ({ pageParam = 1 }) =>
      api.get<MeOrderDto[]>("/api/me/orders", { params: { page: pageParam as number, limit } }),
    initialPageParam: 1,
    getNextPageParam: getOffsetNextPageParam,
    staleTime: STALE_TIME_USER,
    initialData: options?.initialData,
  });
}
