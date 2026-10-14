'use client';

import Link from 'next/link';

import { ArrowLeft, CalendarClock } from 'lucide-react';


import { ApplyButton } from '@/components/ApplyButton';
import { categoryGradient, categoryMeta } from '@/components/StudyThumb';
import { useStudyDetail } from '@/features/studies/queries';
import type { Locale } from '@/lib/content';
import { ApiError } from '@/lib/http';
import { m, t } from '@/lib/i18n';
import { JsonLd, breadcrumbJsonLd, courseJsonLd } from '@/lib/jsonld';
import { toISODate } from '@/lib/recruit';
import { SITE_URL } from '@/lib/seo';

/** TODO(api): GET /api/studies/{id} — 스터디 상세 조회 */
export function StudyDetailView({
  id,
  locale,
}: {
  id: number;
  locale: Locale;
}) {
  const { data: study, error, isPending } = useStudyDetail(id);

  if (isPending) {
    return (
      <div className='mx-auto max-w-3xl px-6 py-20 text-center text-sm text-fg-muted'>
        {t({ ko: '스터디 정보를 불러오는 중…', en: 'Loading study details…' }, locale)}
      </div>
    );
  }

  if (error || !study) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    return (
      <div className='mx-auto max-w-3xl px-6 py-20 text-center'>
        <p className='text-lg font-bold text-fg-secondary'>
          {isNotFound
            ? t({ ko: '스터디를 찾을 수 없어요.', en: 'Study not found.' }, locale)
            : t({ ko: '스터디 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', en: 'Could not load study details. Please try again.' }, locale)}
        </p>
        <Link
          href={`/${locale}/studies`}
          className='mt-4 inline-flex items-center gap-1.5 rounded-pill border border-border px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-border-interactive hover:text-brand'
        >
          <ArrowLeft size={15} /> {m('common.back_studies', locale)}
        </Link>
      </div>
    );
  }

  const rec = study.recruitment;
  const { icon: CategoryIcon, label: categoryLabel } = categoryMeta(study.category);
  const deadline = toISODate(rec?.deadline);
  const url = `${SITE_URL}/${locale}/studies/${id}`;

  return (
    <div className='mx-auto max-w-3xl px-6 pb-16 pt-8'>
      <JsonLd
        data={[
          courseJsonLd(study, locale, url),
          breadcrumbJsonLd([
            { name: m('nav.home', locale), path: `/${locale}` },
            { name: m('studies.title', locale), path: `/${locale}/studies` },
            { name: t(study.title, locale), path: `/${locale}/studies/${id}` },
          ]),
        ]}
      />
      <Link
        href={`/${locale}/studies`}
        className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition-colors hover:text-fg'
      >
        <ArrowLeft size={15} /> {m('common.back_studies', locale)}
      </Link>

      <article className='card mt-4 overflow-hidden'>
        <header
          className='flex flex-col gap-2.5 px-8 pb-7 pt-6'
          style={{ background: categoryGradient(study.category) }}
        >
          <div className='flex items-center gap-1.5 text-white/85'>
            <CategoryIcon size={14} strokeWidth={1.75} className='shrink-0' />
            <span className='text-[11px] font-bold uppercase tracking-[0.14em]'>{categoryLabel}</span>
          </div>
          <h1 className='break-keep text-[28px] font-bold leading-[1.25] tracking-tight text-white'>
            {t(study.title, locale)}
          </h1>
          <p className='text-[16px] leading-relaxed text-white/90'>{t(study.summary, locale)}</p>
          {study.schedule && (
            <p className='flex items-center gap-1.5 text-[14px] font-medium text-white/90'>
              <CalendarClock size={14} strokeWidth={1.75} className='shrink-0' />
              {t(study.schedule, locale)}
            </p>
          )}
        </header>

        {study.description && (
          <div className='px-8 py-7'>
            <h2 className='text-[15px] font-bold text-fg'>{m('common.about_study', locale)}</h2>
            <p className='mt-3 whitespace-pre-line text-[16px] leading-[1.85] text-fg-secondary'>
              {t(study.description, locale)}
            </p>
          </div>
        )}

        <div className='flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface-1 px-8 py-5'>
          <span className='tnum text-sm font-medium text-fg-secondary'>
            {deadline ? t({ ko: `${deadline}까지 모집`, en: `Apply by ${deadline}` }, locale) : ''}
          </span>
          <ApplyButton study={study} locale={locale} />
        </div>
      </article>
    </div>
  );
}
