import { action } from '@storybook/addon-actions';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

interface MockRouterProviderProps {
  readonly children: ReactNode;
  readonly pathname?: string;
}

export function MockRouterProvider({ children, pathname = '/dashboard' }: MockRouterProviderProps): JSX.Element {
  const router = useMemo(
    () => ({
      push: action('push'),
      replace: action('replace'),
      refresh: action('refresh'),
      back: action('back'),
      forward: action('forward'),
      prefetch: async () => {},
      pathname
    }),
    [pathname]
  );

  return <AppRouterContext.Provider value={router as any}>{children}</AppRouterContext.Provider>;
}
