'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export default function Modal({ open, onClose, title, children, className }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="fixed inset-0 h-full w-full bg-slate-950/70"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={clsx(
          'relative max-h-full w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/95 p-6 shadow-2xl backdrop-blur',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          {title ? (
            <h2 id={titleId} className="text-lg font-semibold text-white">
              {title}
            </h2>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900/70 text-slate-300 transition hover:bg-slate-800"
            aria-label="Fechar detalhes"
          >
            ×
          </button>
        </div>

        <div className="mt-4 text-slate-200">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
