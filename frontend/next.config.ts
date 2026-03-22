import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/:path*",
        destination: "http://backend:2007/:path*",
      },
    ];
  },
};

export default nextConfig;
