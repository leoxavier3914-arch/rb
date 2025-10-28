import clsx from "clsx";

export function Table({ children }: { readonly children: React.ReactNode }) {
  return <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">{children}</table>;
}

export function THead({ children }: { readonly children: React.ReactNode }) {
  return <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">{children}</thead>;
}

export function TBody({ children }: { readonly children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>;
}

export function TR({ children }: { readonly children: React.ReactNode }) {
  return <tr className="hover:bg-slate-50 transition">{children}</tr>;
}

export function TH({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return <th className={clsx("px-4 py-3 text-left font-semibold", className)}>{children}</th>;
}

export function TD({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return <td className={clsx("px-4 py-3", className)}>{children}</td>;
}
