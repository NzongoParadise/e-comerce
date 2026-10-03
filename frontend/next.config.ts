import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

if (process.env.VERCEL !== "1") {
  loadEnvConfig(path.resolve(process.cwd(), ".."), process.env.NODE_ENV === "development");
}

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
      ],
    }];
  },
};

export default nextConfig;
