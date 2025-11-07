import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
    ],
  },
  async rewrites() {
    const origin = process.env.BACKEND_ORIGIN || "https://api.pokemon.cuatro.dev";
    return [{
      source: "/api/:path*",
      destination: `${origin}/api/:path*`
    }];
  },
};

export default nextConfig;
