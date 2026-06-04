/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    // INTERNAL_* URLs use Docker service names — resolved server-side by Next.js.
    // This means GraphQL and REST work correctly whether the browser hits
    // nginx (port 80) or the Next.js dev server directly (port 3000).
    const backendUrl = process.env.INTERNAL_API_URL || 'http://server-1:5001';
    const analyticsUrl = process.env.INTERNAL_ANALYTICS_URL || 'http://server-2:8000';
    return [
      // REST API -> server-1
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      // GraphQL analytics -> server-2
      // Two rules cover both /graphql and /graphql/ (Strawberry trailing-slash redirect)
      {
        source: '/graphql',
        destination: `${analyticsUrl}/graphql`,
      },
      {
        source: '/graphql/:path*',
        destination: `${analyticsUrl}/graphql/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
