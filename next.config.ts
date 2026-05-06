import type { NextConfig } from "next";

function readAllowedDevOrigins(): string[] | undefined {
  const raw = process.env.ALLOWED_DEV_ORIGINS?.trim()
  if (!raw) return undefined
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

const nextConfig: NextConfig = {
  // Needed when accessing the dev server from other devices on LAN.
  // Example: ALLOWED_DEV_ORIGINS="192.168.1.50,192.168.1.51"
  allowedDevOrigins: readAllowedDevOrigins(),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      // Common channel/avatar hostnames returned by InnerTube.
      { protocol: "https", hostname: "yt3.ggpht.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
