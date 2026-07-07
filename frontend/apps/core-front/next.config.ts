import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 워크스페이스 mock 패키지는 TS 소스라 Next 가 트랜스파일해야 함
  transpilePackages: ["@studyclub/mock"],
};

export default nextConfig;
