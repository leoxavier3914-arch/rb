import clsx from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type TableChildrenProps = Readonly<{ children: ReactNode }>;

export function Table({ children }: TableChildrenProps) {
  return <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">{children}</table>;
}

export function THead({ children }: TableChildrenProps) {
  return <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{children}</thead>;
}

export function TBody({ children }: TableChildrenProps) {
  return <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>;
}

export function TR({ children }: TableChildrenProps) {
  return <tr className="hover:bg-slate-50 transition">{children}</tr>;
}

export function TH({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return <th {...props} className={clsx("px-4 py-3 text-left font-semibold", className)} />;
}

export function TD({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return <td {...props} className={clsx("px-4 py-3", className)} />;
}
