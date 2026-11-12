import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { LEGENDS, PR_URL, findLegend, type QuestKind } from '@/features/credits/data';

const box = 'border-[3px] border-[#282A43] bg-white';
const BADGE: Record<QuestKind, string> = {
  SPEC: 'bg-[#FFE9E2] text-[#8A3416]',
  UI: 'bg-[#E9ECFF] text-[#2F3C8F]',
  API: 'bg-[#FFF3D1] text-[#6E4E00]',
};

export function generateStaticParams() {
  return LEGENDS.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const c = findLegend((await params).handle);
  return { title: c ? `${c.name}의 퀘스트 로그` : '만든 사람들', robots: { index: false, follow: false } };
}

export default async function ContributorPage({ params }: { params: Promise<{ locale: string; handle: string }> }) {
  const { locale, handle } = await params;
  const c = findLegend(handle);
  if (!c) notFound();

  return (
    <>
      <div className='mx-auto max-w-[1120px] px-6 pt-6'>
        <Link
          href={`/${locale}/++`}
          className='font-pixel inline-flex min-h-11 items-center text-[11px] text-[#282A43]'
        >
          ◀ SELECT
        </Link>
      </div>

      <section className='mx-auto max-w-[1120px] px-6 pt-4 pb-7'>
        <div className={`${box} flex flex-wrap shadow-[8px_8px_0_#282A43]`}>
          <div className='flex flex-[1_1_280px] flex-col items-center gap-3.5 border-[#282A43] bg-[#FFF3D1] p-7 text-center sm:border-r-[3px]'>
            <div className='font-pixel border-[3px] border-[#282A43] bg-[#F4B740] px-2.5 py-1.5 text-[11px]'>
              LEGEND
            </div>
            <div className='font-dot flex size-[140px] items-center justify-center border-[3px] border-[#282A43] bg-[#FFE9E2] text-[72px] shadow-[6px_6px_0_#282A43]'>
              {c.initial}
            </div>
            <div className='font-pixel text-[10px] text-[#6E4E00]'>CLEARED {c.cleared}</div>
          </div>
          <div className='flex min-w-0 flex-[999_1_520px] flex-col gap-[18px] p-7'>
            <div className='flex flex-wrap items-baseline gap-3.5'>
              <h1 className='font-dot m-0 text-[56px] leading-none font-normal'>{c.name}</h1>
              <span className='font-pixel bg-[#3A4BB0] px-2 py-1.5 text-[11px] text-white'>{c.cls}</span>
              <span className='font-pixel text-sm'>LV.{c.stats.prs}</span>
            </div>
            <div className='font-pixel text-[10px] leading-relaxed text-[#5A5C70]'>
              @{c.handle} · {c.role} · {c.period}
            </div>
            <div className='grid grid-cols-3 gap-3'>
              {[
                [c.stats.prs, '머지 PR', '#3A4BB0'],
                [c.stats.specs, '스펙 문서', '#C2410C'],
                [c.stats.commits, '커밋', '#9A6A00'],
              ].map(([v, label, color]) => (
                <div key={label} className='border-[3px] border-[#282A43] p-3'>
                  <div className='font-pixel text-xl' style={{ color: String(color) }}>
                    {v}
                  </div>
                  <div className='mt-1.5 text-xs'>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className='mx-auto max-w-[1120px] px-6 pb-8'>
        <div className='flex flex-col gap-3.5 border-[3px] border-[#282A43] bg-[#5267D8] p-[22px] shadow-[6px_6px_0_#282A43]'>
          <div className='font-pixel text-[11px] text-[#FFE7A0]'>ITEMS IN USE — 지금 사용자가 쓰는 것</div>
          <div className='flex flex-wrap gap-2.5'>
            {c.shipped.map((s) => (
              <div key={s} className={`${box} px-3 py-2 text-sm font-medium`}>
                {s}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className='mx-auto flex max-w-[1120px] flex-col gap-[26px] px-6 pb-20'>
        <div className='flex flex-wrap items-center gap-3.5'>
          <div className='font-pixel bg-[#282A43] px-3.5 py-2.5 text-lg text-white'>QUEST LOG</div>
          <div className='font-dot text-[22px]'>기능 하나 = 퀘스트 하나 · 머지 PR = 달성 목표</div>
        </div>
        {c.quests.map((q, i) => (
          <div key={q.title} className={`${box} shadow-[6px_6px_0_#282A43]`}>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-[#282A43] bg-[#F5F7FF] px-5 py-4'>
              <div className='flex flex-wrap items-center gap-3'>
                <div className='font-pixel text-[10px] text-[#3A4BB0]'>QUEST {String(i + 1).padStart(2, '0')}</div>
                <h2 className='font-dot m-0 text-2xl font-normal'>{q.title}</h2>
              </div>
              <div className='flex items-center gap-2.5'>
                <div className='text-[13px] text-[#4A4C63]'>{q.when}</div>
                <div className='font-pixel border-2 border-[#282A43] bg-[#E6F4EC] px-[7px] py-[5px] text-[9px] text-[#1F5A3A]'>
                  CLEAR {q.items.length}/{q.items.length}
                </div>
              </div>
            </div>
            <p className='m-0 px-5 pt-4 pb-1.5 text-[15px] leading-relaxed text-[#4A4C63]'>{q.why}</p>
            <div className='flex flex-col px-3 pt-1.5 pb-3'>
              {q.items.map((it) => (
                <a
                  key={it.no}
                  href={`${PR_URL}${it.no}`}
                  target='_blank'
                  rel='noreferrer'
                  className='flex min-h-11 items-center gap-3 border-b-2 border-dotted border-[#E2D8C2] px-2 py-2.5 text-[#282A43] hover:text-[#3A4BB0]'
                >
                  <svg
                    width='18'
                    height='18'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='#1F5A3A'
                    strokeWidth='3'
                    aria-hidden='true'
                    className='shrink-0'
                  >
                    <rect x='3' y='3' width='18' height='18' />
                    <path d='M7 12l3 3 7-7' />
                  </svg>
                  <span
                    className={`font-pixel shrink-0 border-2 border-[#282A43] px-1.5 py-1 text-[8px] ${BADGE[it.kind]}`}
                  >
                    {it.kind}
                  </span>
                  <span className='min-w-0 grow text-sm leading-normal'>{it.title}</span>
                  <span className='font-pixel shrink-0 text-[9px] text-[#5A5C70]'>
                    #{it.no} {it.date}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}
        <div className='font-pixel pt-3 text-center text-sm text-[#3A4BB0]'>THANK YOU FOR PLAYING</div>
      </section>
    </>
  );
}
