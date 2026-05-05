import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
