import type { Metadata } from 'next';
import { DotGothic16, Press_Start_2P } from 'next/font/google';

import { Bgm } from '@/features/credits/Bgm';

import './credits.css';

// 숨은 페이지 — 메뉴·사이트맵에 없고 색인도 막는다. 들어오는 길은 /++ 주소와 + 5번 연타뿐
const pixel = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-pixel' });
const dot = DotGothic16({ weight: '400', subsets: ['latin'], variable: '--font-dot', preload: false });

export const metadata: Metadata = { title: '만든 사람들', robots: { index: false, follow: false } };

export default function CreditsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`credits-root ${pixel.variable} ${dot.variable} min-h-screen`}>
      <div className='border-b-[3px] border-[#282A43] bg-white'>
        <div className='mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-3.5'>
          <span className='font-pixel text-sm'>
            STUDYCLUB<span className='text-[#3A4BB0]'>++</span>
          </span>
          <Bgm />
        </div>
      </div>
      {children}
    </div>
  );
}
