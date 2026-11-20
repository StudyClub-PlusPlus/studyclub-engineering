import type { Metadata } from 'next';

/** 테스트 로그인 — 메뉴 · 로그인 화면 어디에도 링크가 없다. 검색에 안 잡히게 (specs/stage-email-login) */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function TestLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
