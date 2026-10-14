import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 도커 이미지 다이어트 — 실제 import 되는 의존성만 .next/standalone 에 번들한다.
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@studyclub/mock", "@studyclub/ui"],
};

export default nextConfig;
