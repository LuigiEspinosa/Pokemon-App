import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    unoptimized: true,   // TEMP fix: bypass optimizer entirely
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
