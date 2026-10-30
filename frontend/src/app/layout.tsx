import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NutriSnap IA — calorias e macros por foto',
  description: 'Fotografe o prato e veja calorias e macros em segundos. 3 fotos grátis.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-cyan-500 selection:text-black">{children}</body>
    </html>
  );
}
