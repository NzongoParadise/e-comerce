import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

if (process.env.VERCEL !== "1") {
	loadEnvConfig(path.resolve(process.cwd(), ".."), process.env.NODE_ENV === "development");
}

const nextConfig: NextConfig = {
};

export default nextConfig;
