import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DrawerProps {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly footer?: React.ReactNode;
}

export function Drawer({ title, description, children, open, onOpenChange, footer }: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl',
            'focus:outline-none'
          )}
        >
          <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold text-slate-900">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-sm text-slate-500">{description}</DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" aria-hidden />
              <span className="sr-only">Fechar</span>
            </DialogPrimitive.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-slate-700">{children}</div>
          {footer ? <footer className="border-t border-slate-100 px-6 py-4">{footer}</footer> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
