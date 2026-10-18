import Link from 'next/link';
import { notFound } from 'next/navigation';

import { autolink } from '@core/lib/autolink';
import { getNotices, type Locale } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { READ } from '@core/lib/layout';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 공지 상세 — 제목 · 게시일 · 본문, 아래에 이전·다음 공지와 목록으로.
 *
 * **본문은 평문이다.** 줄바꿈·공백을 그대로 두고(pre-wrap), HTML 로 해석하지 않는다. 주소만 링크로 바꾼다.
 * 작성자는 내보내지 않는다 — 운영 콘솔에만 있다.
 * 삭제된 공지는 목록에 없으므로 그 주소는 404 다. TODO(api): GET /api/notices/{id} — 삭제 건 404, 이전·다음 id·제목 포함
 */
export async function generateStaticParams() {
  return (await getNotices()).map((a) => ({ id: a.id }));
}

export default async function NoticeDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  // 게시일 내림차순 — 앞쪽이 최신이다
  const list = await getNotices();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) notFound();
  const n = list[i];
  // 「다음」 = 더 최신, 「이전」 = 더 오래된 공지. 끝에서는 비활성
  const newer = i > 0 ? list[i - 1] : undefined;
  const older = i < list.length - 1 ? list[i + 1] : undefined;
  const base = `/proto/core/${locale}/notices`;

  return (
    <div className='mx-auto max-w-3xl px-6 py-12'>
      <article className='card overflow-hidden p-0'>
        <header className='border-b border-(--color-border) px-6 pb-5 pt-7 sm:px-10'>
          <h1 className={`${READ} break-words text-[24px] font-bold leading-[1.35] tracking-tight sm:text-[28px]`}>
            {t(n.title, locale)}
          </h1>
          <time className='mt-2 block text-sm tabular-nums text-(--color-fg-muted)'>{n.date}</time>
        </header>
        {/* 긴 공백·긴 주소가 들어와도 카드 밖으로 넘치지 않게 — pre-wrap + 단어 중간 줄바꿈 허용 */}
        <div
          className={`${READ} whitespace-pre-wrap break-words px-6 py-8 text-[16px] leading-[1.85] text-(--color-fg) [overflow-wrap:anywhere] sm:px-10`}
        >
          {autolink(t(n.body, locale))}
        </div>
      </article>

      <nav aria-label={t({ ko: '다른 공지', en: 'Other notices' }, locale)} className='mt-4 grid grid-cols-2 gap-3'>
        <NeighborLink
          dir='prev'
          label={t({ ko: '이전 공지', en: 'Previous' }, locale)}
          empty={t({ ko: '이전 공지가 없습니다', en: 'No previous notice' }, locale)}
          href={older && `${base}/${older.id}`}
          title={older && t(older.title, locale)}
        />
        <NeighborLink
          dir='next'
          label={t({ ko: '다음 공지', en: 'Next' }, locale)}
          empty={t({ ko: '다음 공지가 없습니다', en: 'No next notice' }, locale)}
          href={newer && `${base}/${newer.id}`}
          title={newer && t(newer.title, locale)}
        />
      </nav>

      <div className='mt-6 flex justify-center'>
        <Link
          href={base}
          className='inline-flex items-center rounded-full border border-(--color-border) bg-(--color-bg) px-6 py-2.5 text-sm font-semibold hover:bg-(--color-surface-subtle)'
        >
          {t({ ko: '목록으로', en: 'Back to list' }, locale)}
        </Link>
      </div>
      <span className='sr-only'>{m('notices.title', locale)}</span>
    </div>
  );
}

/** 이전·다음 칸 — 이동할 공지의 제목을 함께 보인다. 없으면 흐린 안내만 */
function NeighborLink({
  dir,
  label,
  empty,
  href,
  title,
}: {
  dir: 'prev' | 'next';
  label: string;
  empty: string;
  href?: string;
  title?: string;
}) {
  const align = dir === 'next' ? 'items-end text-right' : 'items-start text-left';
  const head = (
    <span className='inline-flex items-center gap-1 text-xs font-semibold text-(--color-fg-muted)'>
      {dir === 'prev' && <ChevronLeft size={14} />}
      {label}
      {dir === 'next' && <ChevronRight size={14} />}
    </span>
  );
  if (!href)
    return (
      <div aria-disabled='true' className={`card flex min-w-0 flex-col gap-1 p-4 opacity-50 ${align}`}>
        {head}
        <span className='text-sm text-(--color-fg-muted)'>{empty}</span>
      </div>
    );
  return (
    <Link href={href} className={`card card-hover flex min-w-0 flex-col gap-1 p-4 ${align}`}>
      {head}
      <span className='w-full truncate text-sm font-semibold'>{title}</span>
    </Link>
  );
}
