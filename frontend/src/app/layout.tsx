import './globals.css';
import type { Metadata, Viewport } from 'next';
import PwaRegister from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'NutriSnap IA — calorias e macros por foto',
  description: 'Fotografe o prato e veja calorias e macros em segundos. 3 fotos grátis.',
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  appleWebApp: { capable: true, title: 'NutriSnap', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = { themeColor: '#070A0F' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased selection:bg-cyan-500 selection:text-black">{children}<PwaRegister /></body>
    </html>
  );
}
