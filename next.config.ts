import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["jsdom", "pg", "@prisma/adapter-pg", "ioredis", "bullmq"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
