import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "export",
    basePath: "/github-actions-creator",
  /* config options here */
    eslint:{
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
