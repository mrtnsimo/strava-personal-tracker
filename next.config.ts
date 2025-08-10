import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Avoid dev-time lint errors from breaking production Docker builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
