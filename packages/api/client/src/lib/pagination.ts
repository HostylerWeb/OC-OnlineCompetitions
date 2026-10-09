import type { ApiResponse } from "@oc/types";
import {
  type InfiniteData,
  keepPreviousData,
  type UseInfiniteQueryResult,
  type UseQueryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../keys";

export function getOffsetNextPageParam(lastPage: ApiResponse<unknown>) {
  return lastPage.meta?.hasMore ? (lastPage.meta.page ?? 0) + 1 : undefined;
}

export function flattenInfinitePages<T>(pages: ApiResponse<T[]>[] | undefined): T[] {
  return (pages ?? []).flatMap((p) => p.data ?? []);
}

export function useServerPagination(meta?: ApiResponse<unknown>["meta"]) {
  return {
    pageCount: meta?.pages ?? 1,
    total: meta?.total ?? 0,
    hasMore: meta?.hasMore ?? false,
    page: meta?.page ?? 1,
    limit: meta?.limit ?? 20,
  };
}

export function useInfiniteVirtual<T>(query: UseInfiniteQueryResult<ApiResponse<T[]>, Error>) {
  const pages = (query.data as InfiniteData<ApiResponse<T[]>> | undefined)?.pages;
  const items = flattenInfinitePages(pages);
  return {
    items,
    fetchNextPage: query.fetchNextPage,
    hasMore: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function createPaginatedAdminQuery<T>(config: {
  queryKey: (page: number, limit: number, ...args: string[]) => readonly unknown[];
  endpoint: string;
  buildParams?: (page: number, limit: number, ...args: string[]) => Record<string, unknown>;
}) {
  return function usePaginatedAdminQuery(
    options: {
      page?: number;
      limit?: number;
      groupBy?: string;
      sortField?: string;
      sortDir?: string;
      search?: string;
      /** Per-column search as search[field]=value pairs */
      columnSearch?: Record<string, string>;
      args?: string[];
    } = {},
    queryOptions?: Omit<UseQueryOptions<ApiResponse<T[]>>, "queryKey" | "queryFn">
  ) {
    const {
      page = 1,
      limit = 20,
      groupBy,
      sortField,
      sortDir,
      search,
      columnSearch,
      args = [],
    } = options;
    return useQuery<ApiResponse<T[]>>({
      queryKey: [
        ...config.queryKey(page, limit, ...args),
        groupBy ?? "",
        sortField ?? "",
        sortDir ?? "",
        search ?? "",
        JSON.stringify(columnSearch ?? {}),
      ] as readonly unknown[],
      queryFn: () => {
        const searchParams: Record<string, string> = {};
        if (columnSearch) {
          for (const [key, value] of Object.entries(columnSearch)) {
            if (value) searchParams[`search[${key}]`] = value;
          }
        }
        return api.get<T[]>(config.endpoint, {
          params: {
            page,
            limit,
            ...(groupBy ? { groupBy } : {}),
            ...(sortField ? { sortField, sortDir: sortDir ?? "desc" } : {}),
            ...(search ? { search } : {}),
            ...searchParams,
            ...(config.buildParams?.(page, limit, ...args) ?? {}),
          },
        });
      },
      staleTime: 0,
      placeholderData: keepPreviousData,
      ...queryOptions,
    });
  };
}

export function createInfiniteAdminQuery<T>(config: {
  queryKey: (limit: number, ...args: string[]) => readonly unknown[];
  endpoint: string;
  buildParams?: (limit: number, ...args: string[]) => Record<string, unknown>;
}) {
  return function useInfiniteAdminQuery(options: { limit?: number; args?: string[] } = {}) {
    const { limit = 20, args = [] } = options;
    return useInfiniteQuery<ApiResponse<T[]>>({
      queryKey: [...config.queryKey(limit, ...args), "infinite"],
      queryFn: ({ pageParam = 1 }) =>
        api.get<T[]>(config.endpoint, {
          params: {
            page: pageParam as number,
            limit,
            ...(config.buildParams?.(limit, ...args) ?? {}),
          },
        }),
      initialPageParam: 1,
      getNextPageParam: getOffsetNextPageParam,
      staleTime: 0,
      placeholderData: keepPreviousData,
    });
  };
}

export { queryKeys };
