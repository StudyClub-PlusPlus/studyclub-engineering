import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@studyclub/mock", "@studyclub/ui"],
};

export default nextConfig;
