import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/ytgify',
  assetPrefix: '/ytgify',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
