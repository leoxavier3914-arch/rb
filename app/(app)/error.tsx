'use client';

interface ErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function AppError({ error, reset }: ErrorProps): JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Algo não saiu como esperado.</h1>
      <p className="max-w-md text-sm text-slate-600">
        {error.message || 'Ocorreu um erro inesperado ao carregar esta página.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow transition hover:bg-slate-700"
      >
        Tentar novamente
      </button>
    </div>
  );
}
