'use client';

import Link from 'next/link';

import { categoryArtUrl, categoryMeta, categoryTint } from '@studyclub/ui';
import { ArrowLeft, CalendarClock, Globe, Rocket, Users } from 'lucide-react';

import { ApplyButton } from '@/components/ApplyButton';
import { useStudyDetail } from '@/features/studies/queries';
import type { Locale } from '@/lib/content';
import { ApiError } from '@/lib/http';
import { m, t } from '@/lib/i18n';
import { JsonLd, breadcrumbJsonLd, courseJsonLd } from '@/lib/jsonld';
import { recruitBadge, studyStartValue, studyTimezoneLabel, toISODate } from '@/lib/recruit';
import { SITE_URL } from '@/lib/seo';

/** TODO(api): GET /api/studies/{id} — 스터디 상세 조회 */
export function StudyDetailView({ id, locale }: { id: number; locale: Locale }) {
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
            : t(
                {
                  ko: '스터디 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
                  en: 'Could not load study details. Please try again.',
                },
                locale,
              )}
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
  const { background, ink } = categoryTint(study.category);
  const artUrl = categoryArtUrl(study.category);
  const badge = recruitBadge(study, locale);
  // 목록 카드와 같은 정보를 칸으로 — 같은 개념은 같은 모양(ui 스킬 §3 일관성)
  const facts = [
    ...(study.schedule ? [{ icon: CalendarClock, label: t({ ko: '일정', en: 'Schedule' }, locale), value: t(study.schedule, locale) }] : []),
    { icon: Globe, label: t({ ko: '시간대', en: 'Time zone' }, locale), value: studyTimezoneLabel(study, locale) },
    { icon: Rocket, label: t({ ko: '시작 예정일', en: 'Starts' }, locale), value: studyStartValue(study, locale) },
    ...(rec?.capacity ? [{ icon: Users, label: t({ ko: '정원', en: 'Capacity' }, locale), value: `${rec.capacity}${t({ ko: '명', en: '' }, locale)}` }] : []),
  ];
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
        <header className='relative flex flex-col gap-3 overflow-hidden px-6 pb-7 pt-6 sm:px-8' style={{ background }}>
          {artUrl && (
            <span
              aria-hidden='true'
              className='pointer-events-none absolute right-4 top-4 h-20 w-20 bg-contain bg-center bg-no-repeat sm:right-8 sm:top-1/2 sm:h-32 sm:w-32 sm:-translate-y-1/2'
              style={{ backgroundImage: `url(${artUrl})` }}
            />
          )}
          <span className='inline-flex w-fit items-center gap-1.5 rounded-pill bg-white/85 px-2.5 py-1 text-xs font-semibold text-fg shadow-sm'>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dotClass}`} aria-hidden='true' />
            {badge.label}
          </span>
          <div className='flex items-center gap-1.5 pr-24 sm:pr-40' style={{ color: ink }}>
            <CategoryIcon size={14} strokeWidth={1.75} className='shrink-0' />
            <span className='text-xs font-semibold'>{categoryLabel}</span>
          </div>
          <h1 className='pr-24 text-[26px] font-bold leading-[1.25] tracking-tight text-fg sm:pr-40 sm:text-[30px]'>
            {t(study.title, locale)}
          </h1>
          <p className='text-[16px] leading-relaxed text-fg-secondary sm:pr-40'>{t(study.summary, locale)}</p>
        </header>

        <dl className='grid gap-px border-b border-border bg-border sm:grid-cols-2'>
          {facts.map((f, i) => (
            <div
              key={f.label}
              // 칸이 홀수면 마지막 칸을 두 칸으로 — 빈 회색 칸이 남지 않게
              className={`flex items-center gap-3 bg-bg px-6 py-4 sm:px-8 ${facts.length % 2 && i === facts.length - 1 ? 'sm:col-span-2' : ''}`}
            >
              <f.icon size={18} className='shrink-0' style={{ color: ink }} />
              <div className='min-w-0'>
                <dt className='text-xs text-fg-muted'>{f.label}</dt>
                <dd className='tnum text-[15px] font-semibold text-fg'>{f.value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {study.description && (
          <div className='px-6 py-7 sm:px-8'>
            <h2 className='text-[15px] font-bold text-fg'>{m('common.about_study', locale)}</h2>
            <p className='mt-3 whitespace-pre-line text-[16px] leading-[1.85] text-fg-secondary'>
              {t(study.description, locale)}
            </p>
          </div>
        )}

        <div className='flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface-1 px-6 py-5 sm:px-8'>
          <span className='tnum text-sm font-medium text-fg-secondary'>
            {deadline ? t({ ko: `${deadline}까지 모집`, en: `Apply by ${deadline}` }, locale) : ''}
          </span>
          <ApplyButton study={study} locale={locale} />
        </div>
      </article>
    </div>
  );
}
