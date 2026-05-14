import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/dashboard/horarios",
        destination: "/dashboard/rutinas",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
