import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    return [{ source: '/_styleguide', destination: '/styleguide' }];
  },
};

export default nextConfig;
