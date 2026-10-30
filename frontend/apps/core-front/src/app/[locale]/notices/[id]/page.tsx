import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Metadata } from 'next';

import { NoticeDate } from '@/components/NoticeDate';
import { NoticesLoadError } from '@/components/NoticesLoadError';
import type { ApiSiteNoticeSummary } from '@/lib/api';
import { autolink } from '@/lib/autolink';
import { getNotice, type Locale } from '@/lib/content';
import { m, t } from '@/lib/i18n';
import { PAGE, READ } from '@/lib/layout';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const n = await getNotice(id);
  // 조회 실패면 목록과 같은 제목 — 오류 안내 화면이 공지 제목 없이 뜬다
  if (n === 'failed') return { title: m('notices.title', locale) };
  if (!n) return {};
  return pageMetadata({
    locale,
    path: `/notices/${id}`,
    title: n.title,
    description: n.body.replace(/\s+/g, ' ').trim().slice(0, 155),
  });
}

/** 공지 상세 — 제목 · 게시일 · 본문, 아래에 이전·다음 공지와 목록으로. 본문은 평문이고 주소만 링크로 바꾼다. */
export default async function NoticeDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const n = await getNotice(id);
  const base = `/${locale}/notices`;
  if (n === 'failed') {
    return (
      <div className={`${PAGE} py-12`}>
        <Link href={base} className='text-sm font-semibold text-(--color-fg-muted) hover:text-(--color-fg)'>
          {m('notices.title', locale)}
        </Link>
        {/* 목록의 오류 안내와 같은 모양 — 게시판 윗줄 아래에 안내 한 칸 */}
        <div className='mt-3 border-t-2 border-(--color-fg)'>
          <div className='border-b border-(--color-border) py-20 text-center'>
            <NoticesLoadError message={m('notices.error', locale)} retry={m('notices.retry', locale)} />
          </div>
        </div>
      </div>
    );
  }
  if (!n) notFound();

  return (
    <div className={`${PAGE} py-12`}>
      <Link href={base} className='text-sm font-semibold text-(--color-fg-muted) hover:text-(--color-fg)'>
        {m('notices.title', locale)}
      </Link>

      <article className='mt-3 border-t-2 border-(--color-fg)'>
        <header className='border-b border-(--color-border) px-2 py-6'>
          <h1 className='break-words text-xl font-bold leading-[1.4] tracking-tight'>{n.title}</h1>
          <NoticeDate iso={n.publishedAt} className='mt-2 block text-sm tabular-nums text-(--color-fg-muted)' />
        </header>
        {/* 긴 공백·긴 주소가 들어와도 넘치지 않게 — pre-wrap + 단어 중간 줄바꿈 허용 */}
        <div
          className={`${READ} min-h-40 whitespace-pre-wrap break-words px-2 py-10 text-base leading-[1.85] text-(--color-fg) [overflow-wrap:anywhere]`}
        >
          {autolink(n.body)}
        </div>
      </article>

      <nav
        aria-label={t({ ko: '다른 공지', en: 'Other notices' }, locale)}
        className='border-y border-(--color-border)'
      >
        <NeighborRow
          label={t({ ko: '다음 공지', en: 'Next' }, locale)}
          empty={t({ ko: '다음 공지가 없습니다', en: 'No next notice' }, locale)}
          neighbor={n.newer}
          base={base}
          icon={<ChevronUp size={15} />}
        />
        <NeighborRow
          label={t({ ko: '이전 공지', en: 'Previous' }, locale)}
          empty={t({ ko: '이전 공지가 없습니다', en: 'No previous notice' }, locale)}
          neighbor={n.older}
          base={base}
          icon={<ChevronDown size={15} />}
        />
      </nav>

      <div className='mt-8 flex justify-end'>
        <Link
          href={base}
          className='inline-flex items-center rounded-full border border-(--color-border) bg-(--color-bg) px-6 py-2.5 text-sm font-semibold hover:bg-(--color-surface-subtle)'
        >
          {t({ ko: '목록으로', en: 'Back to list' }, locale)}
        </Link>
      </div>
    </div>
  );
}

/** 이전·다음 한 줄 — 이동할 공지의 제목과 게시일. 없으면 흐린 안내만 */
function NeighborRow({
  label,
  empty,
  neighbor,
  base,
  icon,
}: {
  label: string;
  empty: string;
  /** 이동할 공지. 목록의 끝이면 null */
  neighbor: ApiSiteNoticeSummary | null;
  base: string;
  icon: React.ReactNode;
}) {
  const head = (
    <span className='inline-flex w-24 shrink-0 items-center gap-1 text-sm font-semibold text-(--color-fg-muted)'>
      {icon}
      {label}
    </span>
  );
  if (!neighbor) {
    return (
      <div
        aria-disabled='true'
        className='flex items-center gap-4 px-2 py-4 opacity-50 [&+*]:border-t [&+*]:border-(--color-border)'
      >
        {head}
        <span className='text-sm text-(--color-fg-muted)'>{empty}</span>
      </div>
    );
  }
  return (
    <Link
      href={`${base}/${neighbor.noticeId}`}
      className='flex items-center gap-4 px-2 py-4 transition-colors hover:bg-(--color-surface-subtle) [&+*]:border-t [&+*]:border-(--color-border)'
    >
      {head}
      <span className='min-w-0 flex-1 truncate text-sm font-semibold'>{neighbor.title}</span>
      <NoticeDate
        iso={neighbor.publishedAt}
        className='hidden shrink-0 text-sm tabular-nums text-(--color-fg-muted) sm:block'
      />
    </Link>
  );
}
