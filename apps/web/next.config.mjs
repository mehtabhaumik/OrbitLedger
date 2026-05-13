/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1', '0.0.0.0', '::1'],
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
