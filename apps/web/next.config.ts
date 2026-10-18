import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@voice/shared'],
  reactStrictMode: true,
};

export default nextConfig;
