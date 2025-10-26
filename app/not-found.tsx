export default function NotFound(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center text-slate-700">
      <h1 className="text-3xl font-semibold text-slate-900">Página não encontrada</h1>
      <p className="max-w-md text-sm">
        O recurso que você tentou acessar não existe ou pode ter sido movido. Utilize o menu lateral para encontrar o
        conteúdo desejado.
      </p>
    </div>
  );
}
