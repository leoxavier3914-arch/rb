import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';
import './tests/utils/navigationMock';

vi.mock('next/link', () => ({
  __esModule: true,
  default: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function NextLink(
    { children, ...props },
    ref
  ) {
    return (
      <a ref={ref} {...props}>
        {children}
      </a>
    );
  })
}));
