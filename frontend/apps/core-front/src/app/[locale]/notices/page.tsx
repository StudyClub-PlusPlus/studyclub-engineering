import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { Locale } from '@studyclub/types';
import type { Metadata } from 'next';

import { NOTICE_PAGE_SIZE } from '@/features/site-notices/model';
import { NoticeDate } from '@/features/site-notices/NoticeDate';
import { NoticesLoadError } from '@/features/site-notices/NoticesLoadError';
import { getNotices } from '@/features/site-notices/server';
import { m, t } from '@/lib/i18n';
import { PAGE } from '@/lib/layout';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/notices',
    title: m('notices.title', locale),
    description: m('seo.notices_description', locale),
  });
}

/**
 * 공지 목록 — 제목 · 게시일. 게시일 내림차순 고정, 10건씩. 정렬·검색·페이지 자르기는 서버가 한다.
 * 작성자·분류·고정 표시는 없다. 줄을 누르면 상세로 간다. 로그인 없이 볼 수 있다.
 */
export default async function NoticesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: raw } = await searchParams;
  // `?page=N` → 1 이상의 정수. 숫자가 아니거나 1 미만이면 1쪽
  let page = Math.floor(Number(raw));
  if (!Number.isFinite(page) || page < 1) page = 1;
  const result = await getNotices((page - 1) * NOTICE_PAGE_SIZE, NOTICE_PAGE_SIZE);
  // 조회 실패는 쪽 수를 모른다 — 없는 쪽 404 를 내지 않고 쪽 번호도 그리지 않는다
  let pageCount = 1;
  if (result !== null) pageCount = Math.max(1, Math.ceil(result.total / NOTICE_PAGE_SIZE));
  // 마지막 쪽을 넘긴 주소는 없는 쪽이다 — 「공지가 없다」 로 보이면 안 된다
  if (page > pageCount && result !== null) notFound();
  const base = `/${locale}/notices`;

  let rows: React.ReactNode;
  if (result === null) {
    rows = (
      <div className='border-b border-(--color-border) py-20 text-center'>
        <NoticesLoadError message={m('notices.error', locale)} retry={m('notices.retry', locale)} />
      </div>
    );
  } else if (result.items.length === 0) {
    rows = (
      <p className='border-b border-(--color-border) py-20 text-center text-sm text-(--color-fg-muted)'>
        {m('notices.empty', locale)}
      </p>
    );
  } else {
    rows = (
      <ul>
        {result.items.map((n) => (
          <li key={n.noticeId} className='border-b border-(--color-border)'>
            <Link
              href={`${base}/${n.noticeId}`}
              className='flex flex-col gap-1 px-2 py-5 transition-colors hover:bg-(--color-surface-subtle) sm:flex-row sm:items-center sm:gap-6'
            >
              {/* 제목은 남는 폭을 다 쓰고 한 줄로 자른다. 게시일은 고정폭·줄바꿈 없음 */}
              <span className='min-w-0 flex-1 truncate text-base font-semibold'>{n.title}</span>
              <NoticeDate
                iso={n.publishedAt}
                className='shrink-0 whitespace-nowrap text-sm tabular-nums text-(--color-fg-muted) sm:w-28 sm:text-right'
              />
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={`${PAGE} py-14`}>
      <h1 className='text-3xl font-extrabold tracking-tight sm:text-4xl'>{m('notices.title', locale)}</h1>

      {/* 게시판 모양 — 페이지 폭을 다 쓰고 카드로 감싸지 않는다. 가운데 한 덩어리로 두면 앱 화면처럼 보인다 */}
      <div className='mt-10 border-t-2 border-(--color-fg)'>
        <div className='hidden items-center gap-6 border-b border-(--color-border) px-2 py-3 text-xs font-semibold text-(--color-fg-muted) sm:flex'>
          <span className='flex-1'>{t({ ko: '제목', en: 'Title' }, locale)}</span>
          <span className='w-28 text-right'>{t({ ko: '게시일', en: 'Posted' }, locale)}</span>
        </div>
        {rows}
      </div>

      {pageCount > 1 && (
        <nav aria-label={t({ ko: '페이지', en: 'Pages' }, locale)} className='mt-8 flex justify-center gap-1'>
          {pageNumbers(page, pageCount).map((p, i) => {
            if (p === null) {
              return (
                <span key={`gap-${i}`} className='grid h-9 w-9 place-items-center text-sm text-(--color-fg-muted)'>
                  …
                </span>
              );
            }
            let current: 'page' | undefined;
            let tone = 'hover:bg-(--color-surface-subtle)';
            if (p === page) {
              current = 'page';
              tone = 'bg-(--color-brand) font-semibold text-white';
            }
            return (
              <Link
                key={p}
                href={pageHref(base, p)}
                aria-current={current}
                className={`grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums ${tone}`}
              >
                {p}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/** 1 · 마지막 · 현재 앞뒤 2쪽만 보인다. 사이가 비면 `null` 이 줄임표 자리다 — 공지가 쌓여도 쪽 번호가 끝없이 늘지 않는다. */
function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let p = 1; p <= pageCount; p += 1) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 2) {
      out.push(p);
    } else if (out[out.length - 1] !== null) {
      out.push(null);
    }
  }
  return out;
}

/** 1쪽은 `?page=` 없이 — 첫 화면 주소가 깨끗하고, 같은 쪽이 주소 둘로 갈리지 않는다. */
function pageHref(base: string, p: number): string {
  if (p === 1) return base;
  return `${base}?page=${p}`;
}
