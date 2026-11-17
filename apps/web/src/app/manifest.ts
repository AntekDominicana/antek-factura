import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ANTEK Factura - Facturación Electrónica DGII',
    short_name: 'ANTEK Factura',
    description:
      'Sistema SaaS Multi-tenant de Facturación Electrónica (e-CF) de República Dominicana (Ley 32-23)',
    start_url: '/app/dashboard',
    display: 'standalone',
    background_color: '#020617', // slate-950
    theme_color: '#0284c7', // sky-600
    orientation: 'any',
    id: '/app/dashboard',
    scope: '/',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
