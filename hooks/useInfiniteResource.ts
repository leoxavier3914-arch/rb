"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

type Fetcher<TData> = (context: { pageParam?: string | null }) => Promise<{
  items: TData[];
  nextCursor: string | null;
}>;

export function useInfiniteResource<TData>(key: readonly unknown[], fetcher: Fetcher<TData>) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: async ({ pageParam }) => fetcher({ pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    refetchOnWindowFocus: false,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return {
    items,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}
