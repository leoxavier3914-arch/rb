'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ProductOption {
  readonly id: string;
  readonly name: string;
}

interface ProductsState {
  readonly status: 'idle' | 'loading' | 'success' | 'error';
  readonly products: readonly ProductOption[];
  readonly error: string | null;
}

export function useProductsOptions() {
  const [state, setState] = useState<ProductsState>({
    status: 'idle',
    products: [],
    error: null
  });

  const load = useCallback(async () => {
    setState(previous => ({ ...previous, status: 'loading', error: null }));

    try {
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error(`Falha ao carregar produtos (${response.status}).`);
      }

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; products?: unknown }
        | null;

      if (!payload || payload.ok !== true || !Array.isArray(payload.products)) {
        const message = payload?.error ?? 'Resposta inválida ao listar produtos.';
        throw new Error(message);
      }

      const products = payload.products
        .map(normalizeProduct)
        .filter((product): product is ProductOption => product !== null);

      setState({ status: 'success', products, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar os produtos agora.';
      setState(previous => ({ ...previous, status: 'error', error: message }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    products: state.products,
    isLoading: state.status === 'loading' && state.products.length === 0,
    isFetching: state.status === 'loading',
    error: state.error,
    reload: load
  };
}

function normalizeProduct(value: unknown): ProductOption | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const raw = value as { id?: unknown; name?: unknown };
  const id = typeof raw.id === 'string' ? raw.id : typeof raw.id === 'number' ? String(raw.id) : null;
  const name = typeof raw.name === 'string' ? raw.name : null;

  if (!id || !name) {
    return null;
  }

  return { id, name };
}
