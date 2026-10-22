import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async rewrites() {
    return [{ source: '/_styleguide', destination: '/styleguide' }];
  },
};

export default nextConfig;
