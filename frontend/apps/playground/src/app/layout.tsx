import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Playground · StudyClub++", template: "%s · Playground" },
  description: "StudyClub++ 디자인 playground — 실제 컴포넌트로 화면을 조립하는 샌드박스.",
  robots: { index: false, follow: false },
};

/**
 * 루트는 문서 껍데기만 담당한다.
 *
 * 헤더·본문 폭은 라우트 그룹이 각자 정한다 — `(site)` 는 max-w-6xl 문서형 크롬,
 * `(proto)` 는 실제 서비스 화면을 그대로 재현해야 해서 full-bleed 다.
 * 폭 제한을 루트에 두면 프로토 화면이 6xl 안에 갇혀 시안 확인이 안 된다.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
