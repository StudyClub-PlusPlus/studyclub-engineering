import Link from 'next/link';
import { notFound } from 'next/navigation';


import { getNotices, type Locale } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { DETAIL_ASIDE, DETAIL_GRID, PAGE, READ } from '@core/lib/layout';
import { NOTICES, getNotice, type Notice } from '@core/lib/notices';
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';

/**
 * 프로토의 공지 목록은 mock(@studyclub/mock announcements)을 쓴다. 상세는 lib/notices 의 실제 공지를 먼저 찾고,
 * 없으면 mock 공지를 본문 한 단락짜리 공지로 보여 준다.
 */
async function findNotice(id: string): Promise<Notice | undefined> {
  const real = getNotice(id);
  if (real) return real;
  const mock = (await getNotices()).find((a) => a.id === id);
  return mock && { ...mock, summary: mock.body, blocks: [] };
}

export async function generateStaticParams() {
  const ids = new Set([...NOTICES.map((n) => n.id), ...(await getNotices()).map((a) => a.id)]);
  return [...ids].map((id) => ({ id }));
}

/** 공지 상세 — 브이크래프트 소식 상세처럼 배너 없는 제목형 머리 + 소제목 위계가 분명한 본문 */
export default async function NoticeDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const n = await findNotice(id);
  if (!n) notFound();

  return (
    <div className={`${PAGE} py-12`}>
      <Link
        href={`/proto/core/${locale}/notices`}
        className='inline-flex items-center gap-1.5 text-sm font-medium text-(--color-fg-muted) hover:text-(--color-fg)'
      >
        <ArrowLeft size={15} /> {m('notices.title', locale)}
      </Link>

      <div className={`mt-4 ${DETAIL_GRID}`}>
        {/* 본문 — 스터디·행사 상세와 같은 머리 카드. 글줄은 READ 폭 */}
        <article className='card overflow-hidden p-0'>
          <header
            className='flex flex-col gap-3 px-6 pb-7 pt-6 sm:px-10'
            style={{ background: 'linear-gradient(135deg, var(--color-brand-subtle), color-mix(in oklab, var(--color-brand) 12%, white))' }}
          >
            <h1 className={`${READ} text-[26px] font-bold leading-[1.3] tracking-tight sm:text-[30px]`}>{t(n.title, locale)}</h1>
            <p className={`${READ} text-[16px] leading-relaxed text-(--color-fg-muted)`}>{t(n.summary, locale)}</p>
          </header>

          <div className={`${READ} flex flex-col gap-4 px-6 py-8 text-[16px] leading-[1.85] text-(--color-fg) sm:px-10`}>
            {n.blocks.map((b, i) => {
              if ('h' in b)
                return (
                  <h2 key={i} className='mt-6 border-l-[3px] pl-3 text-lg font-bold tracking-tight' style={{ borderColor: 'var(--color-brand)' }}>
                    {t(b.h, locale)}
                  </h2>
                );
              if ('p' in b) return <p key={i}>{t(b.p, locale)}</p>;
              if ('ul' in b)
                return (
                  <ul key={i} className='flex flex-col gap-1.5 rounded-xl bg-(--color-surface-subtle) px-5 py-4'>
                    {b.ul.map((li, j) => (
                      <li key={j} className='flex items-start gap-2'>
                        <span className='mt-3 h-1.5 w-1.5 shrink-0 rounded-full' style={{ background: 'var(--color-brand)' }} />
                        {t(li, locale)}
                      </li>
                    ))}
                  </ul>
                );
              return (
                <Link
                  key={i}
                  href={`/proto/core/${locale}${b.link.href}`}
                  className='inline-flex w-fit items-center gap-1 text-[15px] font-semibold text-(--color-brand) hover:underline'
                >
                  {t(b.link.label, locale)} <ArrowRight size={15} />
                </Link>
              );
            })}
          </div>
        </article>

        {/* 오른쪽 — 게시 정보와 다음 행동 */}
        <aside className={`card overflow-hidden p-0 ${DETAIL_ASIDE}`}>
          <dl className='flex flex-col divide-y divide-(--color-border)'>
            <div className='flex items-center gap-3 px-6 py-4'>
              <CalendarDays size={18} className='shrink-0' style={{ color: 'var(--color-brand)' }} />
              <div>
                <dt className='text-xs text-(--color-fg-muted)'>{t({ ko: '게시일', en: 'Posted' }, locale)}</dt>
                <dd className='font-semibold tabular-nums'>{n.date}</dd>
              </div>
            </div>
          </dl>
          <div className='flex flex-col gap-2 border-t border-(--color-border) bg-(--color-surface-subtle) p-5'>
            <Link
              href={`/proto/core/${locale}/studies`}
              className='inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-white'
              style={{ background: 'var(--color-brand)' }}
            >
              {t({ ko: '모집 중인 스터디 보기', en: 'See open studies' }, locale)} <ArrowRight size={15} />
            </Link>
            <Link
              href={`/proto/core/${locale}/notices`}
              className='inline-flex items-center justify-center rounded-full border border-(--color-border) bg-(--color-bg) px-5 py-2.5 text-sm font-semibold'
            >
              {t({ ko: '다른 공지 보기', en: 'All notices' }, locale)}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
