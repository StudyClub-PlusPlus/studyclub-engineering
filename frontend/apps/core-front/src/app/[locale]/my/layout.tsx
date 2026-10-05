import type { Metadata } from 'next';

/** 개인 영역 — 색인 대상이 아니다. 페이지 자체가 'use client' 라 metadata 를 못 내보내서 레이아웃이 대신 건다. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
