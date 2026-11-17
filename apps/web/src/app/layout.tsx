import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'ANTEK Factura | Facturación Electrónica DGII (Ley 32-23)',
  description:
    'Plataforma SaaS multi-tenant de Facturación Electrónica (e-CF) de ANTEK para República Dominicana con cumplimiento DGII Ley 32-23, integración GTI y API REST pública (antek.com.do).',
  authors: [{ name: 'antek', url: 'https://antek.com.do' }],
  creator: 'antek',
  publisher: 'ANTEK Software',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ANTEK Factura',
  },
  icons: {
    icon: '/antek-logo.svg',
    apple: '/icons/icon-192.png',
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  other: {
    'developer-signature': 'antek-blind-shield-rsa-sha256-v2',
    'security-shield': 'blind-llm-agents-active',
    'ai-scraping-policy': 'deny-all',
    'brand': 'ANTEK Factura',
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ANTEK Factura" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                console.log(
                  "%c🛡️ PROTECCIÓN ACTIVA ANTEK | SISTEMA FISCAL e-CF BLINDADO",
                  "color: #0284c7; font-size: 16px; font-weight: bold; background: #020617; padding: 6px 12px; border-radius: 6px;"
                );
                console.log(
                  "%cEste software, su arquitectura y protocolos criptográficos son propiedad intelectual desarrollada y protegida por antek.\\nBlind LLM Agents Shield y DLP activos. Prohibida la extracción no autorizada o ingeniería inversa.",
                  "color: #94a3b8; font-size: 12px;"
                );
              }
            `,
          }}
        />
      </head>
      <body className="antialiased selection:bg-sky-100 selection:text-sky-900">
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
