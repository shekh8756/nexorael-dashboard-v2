import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/ffmpeg-static/ffmpeg",
    ],
  },

  serverExternalPackages: [
    "ffmpeg-static",
  ],
};

export default nextConfig;