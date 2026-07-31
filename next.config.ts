import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep family JSON readable/writable from server routes
  serverExternalPackages: ["bcryptjs"],
  async redirects() {
    return [
      // Common typo / truncated share: /drzew → /drzewo
      { source: "/drzew", destination: "/drzewo", permanent: false },
      { source: "/drzew/:path*", destination: "/drzewo", permanent: false },
      { source: "/tree", destination: "/drzewo", permanent: false },
      { source: "/home", destination: "/drzewo", permanent: false },
    ];
  },
};

export default nextConfig;
