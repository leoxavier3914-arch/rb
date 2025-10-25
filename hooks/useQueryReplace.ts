"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type QueryPartial = Record<string, string | null>;

function sortSearchParams(searchParams: URLSearchParams) {
  const entries = Array.from(searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
  const sorted = new URLSearchParams();
  entries.forEach(([key, value]) => {
    sorted.append(key, value);
  });
  return sorted;
}

export function useQueryReplace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (partial: QueryPartial) => {
      const currentParams = sortSearchParams(new URLSearchParams(searchParams.toString()));
      const currentString = currentParams.toString();

      const nextParams = new URLSearchParams(currentParams.toString());
      Object.entries(partial).forEach(([key, value]) => {
        if (value === null || value === "") {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }
      });

      const sortedNextParams = sortSearchParams(nextParams);
      const nextString = sortedNextParams.toString();

      if (currentString === nextString) {
        return;
      }

      const target = nextString ? `${pathname}?${nextString}` : pathname;
      router.replace(target, { scroll: false });
    },
    [pathname, router, searchParams],
  );
}
