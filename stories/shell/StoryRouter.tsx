import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

interface MockRouterProviderProps {
  readonly children: ReactNode;
  readonly pathname?: string;
}

export function MockRouterProvider({ children, pathname = '/dashboard' }: MockRouterProviderProps) {
  const createLogger = (event: string) => (...args: unknown[]) => {
    console.info(`[router:${event}]`, ...args);
  };

  const router = useMemo(
    () => ({
      push: createLogger('push'),
      replace: createLogger('replace'),
      refresh: createLogger('refresh'),
      back: createLogger('back'),
      forward: createLogger('forward'),
      prefetch: async () => {},
      pathname
    }),
    [pathname]
  );

  return <AppRouterContext.Provider value={router as any}>{children}</AppRouterContext.Provider>;
}
