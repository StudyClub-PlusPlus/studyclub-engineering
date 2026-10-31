'use client';

import Link from 'next/link';

import { categoryArtUrl, categoryMeta, categoryTint } from '@studyclub/ui';
import { ArrowLeft, CalendarClock, Globe, Rocket, Users } from 'lucide-react';

import { MarkdownLite } from '@/components/ApplicationFormUi';
import { ApplyButton } from '@/components/ApplyButton';
import { useStudyDetail } from '@/features/studies/queries';
import type { Locale, Study } from '@/lib/content';
import { ApiError } from '@/lib/http';
import { m, t } from '@/lib/i18n';
import { JsonLd, breadcrumbJsonLd, courseJsonLd } from '@/lib/jsonld';
import { PAGE, DETAIL_GRID, DETAIL_ASIDE } from '@/lib/layout';
import { recruitBadge, studyStartValue, studyTimezoneLabel, toISODate } from '@/lib/recruit';
import { SITE_URL } from '@/lib/seo';

/** TODO(api): GET /api/studies/{id} — 스터디 상세 조회 */
export function StudyDetailView({ id, locale, initial }: { id: number; locale: Locale; initial?: Study | null }) {
  const { data: study, error, isPending } = useStudyDetail(id, initial);

  if (isPending) {
    return (
      <div className={`${PAGE} py-20 text-center type-body-sm text-fg-muted`}>
        {t({ ko: '스터디 정보를 불러오는 중…', en: 'Loading study details…' }, locale)}
      </div>
    );
  }

  if (error || !study) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    return (
      <div className={`${PAGE} py-20 text-center`}>
        <p className='type-title-md text-fg-secondary'>
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
          className='mt-4 inline-flex items-center gap-1.5 rounded-pill border border-border px-4 py-2 type-label-lg text-fg transition-colors hover:border-border-interactive hover:text-brand'
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
    <div className={`${PAGE} pb-16 pt-8`}>
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
        className='inline-flex items-center gap-1.5 type-label-lg text-fg-secondary transition-colors hover:text-fg'
      >
        <ArrowLeft size={15} /> {m('common.back_studies', locale)}
      </Link>

      {/* 넓은 화면: 왼쪽 본문 + 오른쪽 고정 신청 카드. 좁은 화면은 위아래로 */}
      <div className={`mt-4 ${DETAIL_GRID}`}>
        <article className='card overflow-hidden'>
        <header className='relative flex flex-col gap-3 overflow-hidden px-6 pb-7 pt-6 sm:px-8' style={{ background }}>
          {artUrl && (
            <span
              aria-hidden='true'
              className='pointer-events-none absolute right-4 top-4 h-20 w-20 bg-contain bg-center bg-no-repeat sm:right-8 sm:top-1/2 sm:h-32 sm:w-32 sm:-translate-y-1/2'
              style={{ backgroundImage: `url(${artUrl})` }}
            />
          )}
          <span className='inline-flex w-fit items-center gap-1.5 rounded-pill bg-white/85 px-2.5 py-1 type-label-sm text-fg shadow-sm'>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dotClass}`} aria-hidden='true' />
            {badge.label}
          </span>
          <div className='flex items-center gap-1.5 pr-24 sm:pr-40' style={{ color: ink }}>
            <CategoryIcon size={14} strokeWidth={1.75} className='shrink-0' />
            <span className='type-label-sm'>{categoryLabel}</span>
          </div>
          <h1 className='pr-24 type-headline-lg text-fg sm:pr-40'>
            {t(study.title, locale)}
          </h1>
          <p className='type-body-md text-fg-secondary sm:pr-40'>{t(study.summary, locale)}</p>
        </header>

        {study.description && (
          <div className='px-6 py-7 sm:px-8'>
            <h2 className='type-title-lg text-fg'>{m('common.about_study', locale)}</h2>
            {/* 운영 콘솔 등록·수정 폼이 마크다운을 받는다 — 프로토와 같은 렌더러로 그린다. 빈 줄로 나눈 문단은 그대로 띄운다 */}
            <MarkdownLite
              text={t(study.description, locale)}
              className='mt-3 whitespace-pre-line type-body-md text-fg-secondary type-prose'
            />
          </div>
        )}
        </article>

        <aside className={`card flex flex-col overflow-hidden ${DETAIL_ASIDE}`}>
          <dl className='flex flex-col divide-y divide-border'>
            {facts.map((f) => (
              <div key={f.label} className='flex items-center gap-3 px-6 py-4'>
                <f.icon size={18} className='shrink-0' style={{ color: ink }} />
                <div className='min-w-0'>
                  <dt className='type-label-sm text-fg-muted'>{f.label}</dt>
                  <dd className='tnum type-label-lg text-fg'>{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className='flex flex-col gap-3 border-t border-border bg-surface-1 px-6 py-5'>
            {deadline && (
              <span className='tnum type-label-lg text-fg-secondary'>
                {t({ ko: `${deadline}까지 모집`, en: `Apply by ${deadline}` }, locale)}
              </span>
            )}
            <ApplyButton study={study} locale={locale} />
          </div>
        </aside>
      </div>
    </div>
  );
}
