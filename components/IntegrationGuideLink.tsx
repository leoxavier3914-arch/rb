import Link from 'next/link';

type IntegrationGuideLinkProps = {
  guidePath: string;
  label?: string;
};

export default function IntegrationGuideLink({ guidePath, label = 'Baixar guia completo' }: IntegrationGuideLinkProps) {
  return (
    <Link
      href={guidePath}
      download
      prefetch={false}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm font-medium text-white transition hover:border-brand hover:bg-brand/20 hover:text-brand"
    >
      <span aria-hidden>⬇️</span>
      {label}
    </Link>
  );
}
