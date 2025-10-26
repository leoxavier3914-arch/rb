'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Loader2, Search, ShoppingBag, ShoppingCart, User } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/ui/classnames';

type SearchResultType = 'sale' | 'customer' | 'product';

interface SearchResult {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly type: SearchResultType;
}

interface CommandMenuProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const hasResults = results.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    const controller = new AbortController();

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      return () => controller.abort();
    }

    setLoading(true);
    setError(null);

    fetch(`/api/hub/search?q=${encodeURIComponent(query)}&limit=10`, {
      signal: controller.signal,
      headers: {
        'x-admin-role': 'true'
      }
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error('Não foi possível buscar resultados agora.');
        }
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
      })
      .catch(error => {
        if (error.name === 'AbortError') {
          return;
        }
        setError(error instanceof Error ? error.message : 'Erro ao buscar resultados.');
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [open, query]);

  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
    }
  }, [open, results.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenChange]);

  const handleNavigation = useCallback((result: SearchResult): void => {
    if (result.type === 'sale') {
      router.push(`/sales?id=${encodeURIComponent(result.id)}`);
    } else if (result.type === 'customer') {
      router.push(`/customers?query=${encodeURIComponent(result.id)}`);
    } else {
      router.push(`/products?query=${encodeURIComponent(result.id)}`);
    }
    onOpenChange(false);
  }, [onOpenChange, router]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(current => (results.length === 0 ? current : (current + 1) % results.length));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(current => (results.length === 0 ? current : (current - 1 + results.length) % results.length));
      } else if (event.key === 'Enter') {
        if (results[selectedIndex]) {
          event.preventDefault();
          handleNavigation(results[selectedIndex]);
        }
      } else if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNavigation, onOpenChange, open, results, selectedIndex]);

  const icons = useMemo(() => ({
    sale: ShoppingCart,
    customer: User,
    product: ShoppingBag
  }), []);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4">
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar por venda, cliente ou produto"
              className="h-12 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">Esc</kbd>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-2 py-3">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Buscando...
              </div>
            )}
            {error && !loading && (
              <div className="px-3 py-2 text-sm text-red-600">{error}</div>
            )}
            {!loading && !error && !hasResults && query && (
              <div className="px-3 py-2 text-sm text-slate-500">Nenhum resultado encontrado.</div>
            )}
            <ul className="flex flex-col">
              {results.map((result, index) => {
                const Icon = icons[result.type];
                const isSelected = index === selectedIndex;
                return (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      type="button"
                      onClick={() => handleNavigation(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition',
                        isSelected ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden />
                      <div className="flex flex-col">
                        <span className="font-medium">{result.title}</span>
                        {result.subtitle && <span className="text-xs text-slate-400">{result.subtitle}</span>}
                      </div>
                      <span className="ml-auto text-xs uppercase text-slate-400">{result.type}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
