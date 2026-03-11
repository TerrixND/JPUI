import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_PLATFORM_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_PLATFORM_API_KEY ||
      process.env.GOOGLE_MAPS_PLATFORM_API_KEY ||
      process.env.GOOGLE_CLOUD_API_KEY ||
      "",
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "profile.line-scdn.net",
      },
    ],
  },
};

export default nextConfig;
