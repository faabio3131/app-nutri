import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'App Nutri IA - Calculadora de Calorias por Foto',
  description: 'Escaneie seu prato e bata suas metas de calorias, proteínas e água.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-cyan-500 selection:text-black">{children}</body>
    </html>
  );
}
