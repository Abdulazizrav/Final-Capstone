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
    // Use INTERNAL_API_URL (server-side Docker hostname) for Next.js rewrites.
    // NEXT_PUBLIC_* vars are exposed to the browser — wrong for server-side proxying.
    // Socket.io /socket.io/* is NOT proxied here: Next.js rewrites don't support
    // WebSocket upgrades. nginx handles /socket.io/ directly.
    const backendUrl = process.env.INTERNAL_API_URL || 'http://server-1:5001';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
