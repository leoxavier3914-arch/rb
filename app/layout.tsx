import type { Metadata } from "next";
import "./globals.css";

import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";

export const metadata: Metadata = {
  title: "Kiwify Sales Hub",
  description:
    "Painel interno da KiWiFi para acompanhar vendas aprovadas e carrinhos abandonados em tempo real.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-white">
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  );
}
