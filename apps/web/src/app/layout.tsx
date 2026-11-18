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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://factura.antek.com.do'),
  title: 'ANTEK Factura | Facturación Electrónica e-CF República Dominicana',
  description:
    'Emite facturas electrónicas e-CF, escanea gastos 606 y genera tus reportes 606/607 en minutos. Para negocios y contadores en República Dominicana.',
  keywords: [
    'facturación electrónica e-CF República Dominicana',
    'DGII Ley 32-23',
    'formato 606 y 607',
    'sistema de facturación RD',
    'ANTEK Factura',
  ],
  authors: [{ name: 'ANTEK Dominicana', url: 'https://antek.com.do' }],
  creator: 'ANTEK Dominicana',
  publisher: 'ANTEK Software',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'es_DO',
    url: '/',
    siteName: 'ANTEK Factura',
    title: 'ANTEK Factura | Facturación Electrónica e-CF en República Dominicana',
    description:
      'Emite facturas electrónicas e-CF, escanea gastos 606 y genera tus reportes 606/607 en minutos. Para negocios y contadores en República Dominicana.',
    images: [
      {
        url: 'https://factura.antek.com.do/og-cover.jpg',
        secureUrl: 'https://factura.antek.com.do/og-cover.jpg',
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: 'ANTEK Factura - Facturación Electrónica e-CF DGII',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ANTEK Factura | Facturación Electrónica e-CF RD',
    description:
      'Emite facturas electrónicas e-CF, escanea gastos 606 y genera tus reportes 606/607 en minutos. Para negocios y contadores en República Dominicana.',
    images: ['https://factura.antek.com.do/og-cover.jpg'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ANTEK Factura',
  },
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/brand/icon-a.png', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/brand/icon-a.png',
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    brand: 'ANTEK Factura',
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
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'ANTEK Factura',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web, Android, iOS',
              description:
                'Plataforma de facturación electrónica e-CF compatible con la DGII Ley 32-23 en República Dominicana.',
              offers: {
                '@type': 'AggregateOffer',
                priceCurrency: 'DOP',
                lowPrice: '990',
                highPrice: '4900',
              },
            }),
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
