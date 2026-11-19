/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
  transpilePackages: ['@factura-ecf/fiscal-engine'],
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  async rewrites() {
    const apiTarget = process.env.NEXT_PUBLIC_API_URL || 'https://antek-factura-api.onrender.com';
    return [
      {
        source: '/v1/:path*',
        destination: `${apiTarget}/v1/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${apiTarget}/api/v1/:path*`,
      },
      {
        source: '/api/webhooks/:path*',
        destination: `${apiTarget}/api/webhooks/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Developer', value: 'antek' },
          { key: 'X-Author', value: 'antek' },
          { key: 'X-Brand-System', value: 'ANTEK Factura' },
          { key: 'X-Developer-Signature', value: 'antek-blind-shield-rsa-sha256-v2' },
          { key: 'X-Security-Policy', value: 'blind-llm-agents-active; no-data-scraping; rls-enforced' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, noai, noimageai' },
          { key: 'X-AI-Training-Policy', value: 'deny-all' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://antek-factura-api.onrender.com https://*.onrender.com http://localhost:4000 http://127.0.0.1:4000 https://ecf.dgii.gov.do https://fc.dgii.gov.do; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
