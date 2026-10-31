import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 별도 포트의 E2E 서버가 로컬 개발 서버의 빌드 파일·잠금을 공유하지 않도록 한다.
  ...(process.env.APP_DIST_DIR ? { distDir: process.env.APP_DIST_DIR } : {}),
  // 워크스페이스 패키지는 TS 소스라 Next 가 트랜스파일해야 함
  transpilePackages: ['@studyclub/mock', '@studyclub/ui', '@studyclub/types', '@studyclub/utils'],
};

export default nextConfig;
