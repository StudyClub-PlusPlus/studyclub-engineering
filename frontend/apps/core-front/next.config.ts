import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 워크스페이스 패키지는 TS 소스라 Next 가 트랜스파일해야 함
  transpilePackages: ['@studyclub/mock', '@studyclub/ui', '@studyclub/types', '@studyclub/utils'],
};

export default nextConfig;
