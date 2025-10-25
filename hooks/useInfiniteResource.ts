"use client";

import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";

type Fetcher<TData> = (context: {
  pageParam?: string | null;
  signal: AbortSignal;
}) => Promise<{
  items: TData[];
  nextCursor: string | null;
}>;

interface UseInfiniteResourceOptions<TData> {
  select?: (data: InfiniteData<{ items: TData[]; nextCursor: string | null }>) => InfiniteData<{
    items: TData[];
    nextCursor: string | null;
  }>;
  staleTime?: number;
}

export function useInfiniteResource<TData>(
  key: readonly unknown[],
  fetcher: Fetcher<TData>,
  options: UseInfiniteResourceOptions<TData> = {},
) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: async ({ pageParam, signal }) => fetcher({ pageParam, signal }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: options.staleTime ?? 60_000,
    select: options.select,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage ?? false,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
