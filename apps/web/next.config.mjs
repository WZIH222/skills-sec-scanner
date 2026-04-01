import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@skills-sec/scanner', '@skills-sec/database'],
  // Skip type/eslint checks in CI/Docker builds (checked locally before push)
  typescript: { ignoreBuildErrors: process.env.SKIP_TYPES === '1' },
  eslint: { ignoreDuringBuilds: process.env.SKIP_TYPES === '1' },
  outputFileTracingRoot: process.cwd().replace(/\/apps\/web$/, ''),

  // CORS configuration for API routes
  async headers() {
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'http://localhost:3001',
      // Add production URLs when deployed
    ].filter(Boolean)

    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: allowedOrigins.join(', '),
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400', // 24 hours
          },
        ],
      },
    ]
  },
};

export default withNextIntl(nextConfig);
