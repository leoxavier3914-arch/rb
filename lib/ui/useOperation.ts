'use client';

import { useCallback, useState } from 'react';

interface OperationState<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
}

interface OperationResult<T> extends OperationState<T> {
  readonly run: (executor: () => Promise<T>) => Promise<T>;
  readonly reset: () => void;
}

export function useOperation<T = unknown>(): OperationResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (executor: () => Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await executor();
      setData(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido.';
      setError(message);
      setData(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, error, loading, run, reset };
}
