/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1', '0.0.0.0', '::1'],
  output: 'standalone',
  trailingSlash: true,
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://orbit-ledger-f41c2.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
