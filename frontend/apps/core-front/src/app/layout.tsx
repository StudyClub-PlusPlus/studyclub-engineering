import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StudyClub++",
    template: "%s · StudyClub++",
  },
  description:
    "StudyClub++ — 개발자 700+명의 커리어 성장 커뮤니티. 이력서, 인터뷰, 시스템 디자인을 함께 준비합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
