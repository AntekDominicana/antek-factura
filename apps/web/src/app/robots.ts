import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://factura.antek.com.do';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register', '/docs', '/legal/'],
        disallow: ['/app/', '/superadmin/', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
