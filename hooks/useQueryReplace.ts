"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef } from "react";

type Primitive = string | number | boolean;
type QueryValue = Primitive | Primitive[] | null | undefined;
type QueryPartial = Record<string, QueryValue>;

interface ReplaceQueryOptions {
  throttleMs?: number;
}

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
  const searchString = useMemo(() => searchParams.toString(), [searchParams]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return useCallback(
    (partial: QueryPartial, options: ReplaceQueryOptions = {}) => {
      const currentParams = sortSearchParams(new URLSearchParams(searchString));
      const currentString = currentParams.toString();

      const nextParams = new URLSearchParams(currentParams.toString());
      Object.entries(partial).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          nextParams.delete(key);
          return;
        }

        const values = Array.isArray(value) ? value : [value];
        const normalized = values
          .map((item) => String(item))
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

        if (normalized.length === 0) {
          nextParams.delete(key);
          return;
        }

        nextParams.set(key, normalized.join(","));
      });

      const sortedNextParams = sortSearchParams(nextParams);
      const nextString = sortedNextParams.toString();

      if (currentString === nextString) {
        return;
      }

      const target = nextString ? `${pathname}?${nextString}` : pathname;
      const executeReplace = () => {
        startTransition(() => {
          router.replace(target, { scroll: false });
        });
      };

      const { throttleMs } = options;
      if (throttleMs && throttleMs > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          executeReplace();
          timeoutRef.current = null;
        }, throttleMs);
        return;
      }

      executeReplace();
    },
    [pathname, router, searchString],
  );
}
