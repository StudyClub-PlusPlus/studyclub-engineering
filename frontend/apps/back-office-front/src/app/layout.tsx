import type { Metadata } from 'next';

import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: {
    default: 'StudyClub++ Back Office',
    template: '%s · StudyClub++ Back Office',
  },
  description: 'StudyClub++ 운영자 콘솔 — 스터디/행사/스터디원/운영진 관리 (mock 데이터).',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='ko' className='h-full'>
      <head>
        <link
          rel='stylesheet'
          href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/variable/pretendardvariable.min.css'
        />
      </head>
      {/* data-app="console" — console.overrides.css 의 본문 밀도(15px) 스코프 앵커 */}
      <body className='min-h-full' data-app='console'>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
