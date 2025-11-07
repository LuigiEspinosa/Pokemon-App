import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'img.pokemondb.net' }
    ]
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://api.pokemon.cuatro.dev/api/:path*", // proxy to backend
      },
    ];
  },
};

export default nextConfig;
