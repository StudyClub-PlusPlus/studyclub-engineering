import type { Metadata } from 'next';

/** 로그인 — 색인 가치 0. 검색 결과에 로그인 화면이 뜨면 유입이 거기서 끊긴다. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
