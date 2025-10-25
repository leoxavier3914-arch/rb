"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";

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
  const [, startTransition] = useTransition();
  const applyingRef = useRef(false);

  return useCallback(
    (partial: QueryPartial) => {
      if (applyingRef.current) {
        return;
      }

      const currentParams = sortSearchParams(new URLSearchParams(searchParams.toString()));
      const currentString = currentParams.toString();

      const nextParams = new URLSearchParams(searchParams.toString());
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

      applyingRef.current = true;
      queueMicrotask(() => {
        applyingRef.current = false;
      });

      startTransition(() => {
        const target = nextString ? `${pathname}?${nextString}` : pathname;
        router.replace(target, { scroll: false });
      });
    },
    [pathname, router, searchParams, startTransition],
  );
}
