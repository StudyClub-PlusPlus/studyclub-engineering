import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, ArrowRight, Pin } from 'lucide-react';
import type { Metadata } from 'next';

import { Pill } from '@/components/StatusBadge';
import type { Locale } from '@/lib/content';
import { m, t } from '@/lib/i18n';
import { NOTICES, getNotice } from '@/lib/notices';
import { pageMetadata } from '@/lib/seo';

export function generateStaticParams() {
  return NOTICES.map((n) => ({ id: n.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const n = getNotice(id);
  if (!n) return {};
  return pageMetadata({ locale, path: `/notices/${id}`, title: t(n.title, locale), description: t(n.summary, locale) });
}

/** 공지 상세 — 브이크래프트 소식 상세처럼 배너 없는 제목형 머리 + 소제목 위계가 분명한 본문 */
export default async function NoticeDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const n = getNotice(id);
  if (!n) notFound();

  return (
    <div className='mx-auto max-w-6xl px-6 py-12'>
      <Link
        href={`/${locale}/notices`}
        className='inline-flex items-center gap-1.5 text-sm font-medium text-(--color-fg-muted) hover:text-(--color-fg)'
      >
        <ArrowLeft size={15} /> {m('notices.title', locale)}
      </Link>

      {/* 컨테이너 폭은 다른 페이지와 같게, 읽는 글줄은 3xl 로 */}
      <header className='mt-6 max-w-3xl border-b border-(--color-border) pb-6'>
        <div className='flex items-center gap-2'>
          {n.pinned && <Pin size={14} aria-label='pinned' style={{ color: 'var(--color-brand)' }} />}
          {n.tag && <Pill>{m(`notice_tag.${n.tag}`, locale)}</Pill>}
          <time className='text-xs font-medium text-(--color-fg-faint)'>{n.date}</time>
        </div>
        <h1 className='mt-3 text-[26px] font-bold leading-[1.3] tracking-tight sm:text-3xl'>{t(n.title, locale)}</h1>
      </header>

      <div className='mt-8 flex max-w-3xl flex-col gap-4 text-[16px] leading-[1.85] text-(--color-fg)'>
        {n.blocks.map((b, i) => {
          if ('h' in b) return <h2 key={i} className='mt-6 text-lg font-bold tracking-tight'>{t(b.h, locale)}</h2>;
          if ('p' in b) return <p key={i}>{t(b.p, locale)}</p>;
          if ('ul' in b)
            return (
              <ul key={i} className='flex flex-col gap-1.5'>
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
              href={`/${locale}${b.link.href}`}
              className='inline-flex w-fit items-center gap-1 text-[15px] font-semibold text-(--color-brand) hover:underline'
            >
              {t(b.link.label, locale)} <ArrowRight size={15} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
