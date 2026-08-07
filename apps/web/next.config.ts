import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @clinic/shared ships as TypeScript source (no build step); Next must transpile it.
  transpilePackages: ['@clinic/shared'],
};

export default nextConfig;
