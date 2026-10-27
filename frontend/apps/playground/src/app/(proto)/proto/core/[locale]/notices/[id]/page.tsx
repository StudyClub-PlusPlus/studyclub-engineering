import Link from 'next/link';
import { notFound } from 'next/navigation';

import { autolink } from '@core/lib/autolink';
import { getNotices, type Locale } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { PAGE, READ } from '@core/lib/layout';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
    <div className={`${PAGE} py-12`}>
      <Link href={base} className='type-label-lg text-(--color-fg-muted) hover:text-(--color-fg)'>
        {m('notices.title', locale)}
      </Link>

      {/* 게시판 글 모양 — 페이지 폭을 다 쓰고 카드로 감싸지 않는다. 본문 글줄만 읽기 폭(READ)으로 묶는다 */}
      <article className='mt-3 border-t-2 border-(--color-fg)'>
        <header className='border-b border-(--color-border) px-2 py-6'>
          {/* 제목은 본문(16px)의 1.4배 안쪽 — 크게 벌리면 제목만 떠 보이고 본문이 작아 보인다 */}
          <h1 className='break-words type-headline-lg'>{t(n.title, locale)}</h1>
          <time className='mt-2 block type-body-sm tabular-nums text-(--color-fg-muted)'>{n.date}</time>
        </header>
        {/* 긴 공백·긴 주소가 들어와도 넘치지 않게 — pre-wrap + 단어 중간 줄바꿈 허용 */}
        <div
          className={`${READ} min-h-40 whitespace-pre-wrap break-words px-2 py-10 type-body-md text-(--color-fg) [overflow-wrap:anywhere]`}
        >
          {autolink(t(n.body, locale))}
        </div>
      </article>

      {/* 이전·다음 — 게시판처럼 위아래 두 줄. 이동할 공지의 제목을 함께 보인다 */}
      <nav aria-label={t({ ko: '다른 공지', en: 'Other notices' }, locale)} className='border-y border-(--color-border)'>
        <NeighborRow
          label={t({ ko: '다음 공지', en: 'Next' }, locale)}
          empty={t({ ko: '다음 공지가 없습니다', en: 'No next notice' }, locale)}
          href={newer && `${base}/${newer.id}`}
          title={newer && t(newer.title, locale)}
          date={newer?.date}
          icon={<ChevronUp size={15} />}
        />
        <NeighborRow
          label={t({ ko: '이전 공지', en: 'Previous' }, locale)}
          empty={t({ ko: '이전 공지가 없습니다', en: 'No previous notice' }, locale)}
          href={older && `${base}/${older.id}`}
          title={older && t(older.title, locale)}
          date={older?.date}
          icon={<ChevronDown size={15} />}
        />
      </nav>

      <div className='mt-8 flex justify-end'>
        <Link
          href={base}
          className='inline-flex items-center rounded-full border border-(--color-border) bg-(--color-bg) px-6 py-2.5 type-label-lg hover:bg-(--color-surface-subtle)'
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
  href,
  title,
  date,
  icon,
}: {
  label: string;
  empty: string;
  href?: string;
  title?: string;
  date?: string;
  icon: React.ReactNode;
}) {
  const head = (
    <span className='inline-flex w-24 shrink-0 items-center gap-1 type-label-lg text-(--color-fg-muted)'>
      {icon}
      {label}
    </span>
  );
  if (!href)
    return (
      <div aria-disabled='true' className='flex items-center gap-4 px-2 py-4 opacity-50 [&+*]:border-t [&+*]:border-(--color-border)'>
        {head}
        <span className='type-body-sm text-(--color-fg-muted)'>{empty}</span>
      </div>
    );
  return (
    <Link
      href={href}
      className='flex items-center gap-4 px-2 py-4 transition-colors hover:bg-(--color-surface-subtle) [&+*]:border-t [&+*]:border-(--color-border)'
    >
      {head}
      <span className='min-w-0 flex-1 truncate type-label-lg'>{title}</span>
      <time className='hidden shrink-0 type-body-sm tabular-nums text-(--color-fg-muted) sm:block'>{date}</time>
    </Link>
  );
}
