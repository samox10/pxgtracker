import type { Metadata } from "next";
import "./globals.css";

// Nós importamos o Header que acabamos de criar
import Header from "../components/Header";

// Aqui você pode mudar o título que aparece na aba do navegador
export const metadata: Metadata = {
  title: "PXG Tracker | Gerencie suas Hunts",
  description: "Dashboard manual para gerenciar hunts, loot e suplementos do PokeXGames.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        {/* O Header fica aqui em cima, fixo para todo o site */}
        <Header />
        
        {/* O {children} é onde o Next.js injeta o Dashboard, ou o Inventário, etc. */}
        {children}
      </body>
    </html>
  );
}