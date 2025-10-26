import { vi } from 'vitest';

type MockRouter = {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
  prefetch: ReturnType<typeof vi.fn>;
};

const router: MockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn()
};

let pathname = '/';

export function setMockPathname(value: string): void {
  pathname = value;
}

export function getMockRouter(): MockRouter {
  return router;
}

export function resetRouterMocks(): void {
  Object.values(router).forEach(fn => fn.mockReset());
  pathname = '/';
}

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: (url: string) => {
    throw new Error(`Redirected to ${url}`);
  }
}));
