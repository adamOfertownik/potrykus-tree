import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep family JSON readable/writable from server routes
  serverExternalPackages: ["bcryptjs"],
};

export default nextConfig;
