'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';


import { MarkdownLite } from '@core/components/ApplicationFormUi';
import { ApplyButton } from '@core/components/ApplyButton';
import type { Locale, Study } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { DETAIL_ASIDE, DETAIL_GRID, PAGE } from '@core/lib/layout';
import { recruitBadge, studyStartValue, studyTimezoneLabel, toISODate } from '@core/lib/recruit';
import { getStudyCrew, recruitCapacity, studies as mockStudies } from '@studyclub/mock';
import { categoryArtUrl, categoryMeta, categoryTint } from '@studyclub/ui';
import { ArrowLeft, CalendarClock, Globe, Rocket } from 'lucide-react';

import { SPECS } from '@/app/(proto)/proto/core/[locale]/studies/[id]/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

/** TODO(api): GET /api/studies/{id} — 스터디 상세 조회 연동 */
export function StudyDetailView({
  study: initialStudy,
  id,
  locale,
}: {
  study: Study | null;
  id: string;
  locale: Locale;
}) {
  const [study, setStudy] = useState<Study | null>(initialStudy);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const syncFromMsw = () => {
      fetch(`/api/studies/${id}`)
        .then((res) => {
          if (!res.ok) {
            if (!isCancelled) {
              setErrorStatus(res.status);
              setStudy(null);
            }
            return null;
          }
          if (!isCancelled) {
            setErrorStatus(null);
            const found = initialStudy ?? (mockStudies.find((s) => String(s.study_id) === id) as unknown as Study) ?? null;
            setStudy(found);
          }
          return res.json();
        })
        .catch(() => {
          if (!isCancelled) {
            setErrorStatus(500);
            setStudy(null);
          }
        });
    };

    syncFromMsw();
    window.addEventListener('msw:config-change', syncFromMsw);
    return () => {
      isCancelled = true;
      window.removeEventListener('msw:config-change', syncFromMsw);
    };
  }, [id, initialStudy]);

  if (errorStatus === 404) {
    return (
      <div className={`${PAGE} py-20 text-center`}>
        <p className='text-lg font-bold text-fg-secondary'>
          {t({ ko: '스터디를 찾을 수 없어요.', en: 'Study not found.' }, locale)}
        </p>
        <Link
          href={`/proto/core/${locale}/studies`}
          className='mt-4 inline-flex items-center gap-1.5 rounded-pill border border-border-strong px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand hover:text-brand'
        >
          <ArrowLeft size={15} /> {m('common.back_studies', locale)}
        </Link>
      </div>
    );
  }

  if (errorStatus !== null) {
    return (
      <div className={`${PAGE} py-20 text-center`}>
        <p className='text-lg font-bold text-fg-secondary'>
          {t({ ko: '스터디 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', en: 'Could not load study details. Please try again.' }, locale)}
        </p>
        <Link
          href={`/proto/core/${locale}/studies`}
          className='mt-4 inline-flex items-center gap-1.5 rounded-pill border border-border-strong px-4 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand hover:text-brand'
        >
          <ArrowLeft size={15} /> {m('common.back_studies', locale)}
        </Link>
      </div>
    );
  }

  if (!study) return null;

  const { icon: CategoryIcon, label: categoryLabel } = categoryMeta(study.category);
  const badge = recruitBadge(study, locale);
  const { background, ink } = categoryTint(study.category);
  const artUrl = categoryArtUrl(study.category);
  const deadline = toISODate(study.recruitment?.deadline);
  const joined = getStudyCrew(study).crew.length;
  const cap = recruitCapacity(study);

  // 목록 카드와 같은 정보를 칸으로 — 같은 개념은 같은 모양
  const facts = [
    ...(study.schedule ? [{ icon: CalendarClock, label: t({ ko: '일정', en: 'Schedule' }, locale), value: t(study.schedule, locale) }] : []),
    { icon: Globe, label: t({ ko: '시간대', en: 'Time zone' }, locale), value: studyTimezoneLabel(study, locale) },
    { icon: Rocket, label: t({ ko: '시작 예정일', en: 'Starts' }, locale), value: studyStartValue(study, locale) },
  ];

  return (
    <div className={`${PAGE} pb-16 pt-8`}>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.chip ?? spec.screen} spec={spec} />
      ))}
      <Link
        href={`/proto/core/${locale}/studies`}
        className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition-colors hover:text-fg'
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

          {study.description && (
            <div className='px-6 py-7 sm:px-8'>
              <h2 className='text-[15px] font-bold text-fg'>{m('common.about_study', locale)}</h2>
              <MarkdownLite
                text={t(study.description, locale)}
                className='mt-3 whitespace-pre-line text-[16px] leading-[1.85] text-fg-secondary'
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
                  <dt className='text-xs text-fg-muted'>{f.label}</dt>
                  <dd className='tnum text-[15px] font-semibold text-fg'>{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
          <div className='flex flex-col gap-1 border-t border-border px-6 py-5'>
            <span className='tnum text-sm font-medium text-fg-secondary'>
              <span data-anno='view:3'>
                {cap
                  ? t({ ko: `참여 ${joined}/${cap}명`, en: `${joined}/${cap} joined` }, locale)
                  : t({ ko: `참여 ${joined}명 · 정원 제한 없음`, en: `${joined} joined · no limit` }, locale)}
              </span>
              {deadline ? ` · ${t({ ko: `${deadline}까지 모집`, en: `Apply by ${deadline}` }, locale)}` : ''}
            </span>
            <span data-anno='view:4' className='text-xs text-fg-muted'>
              {study.program?.kind === 'club'
                ? t({ ko: '클럽: 이전 기수 참여자는 새 기수에 신청 없이 자동으로 이어집니다.', en: 'Club: members carry over to new cohorts without re-applying.' }, locale)
                : t({ ko: '스터디: 참여하려면 신청이 필요합니다.', en: 'Study: you need to apply to join.' }, locale)}
            </span>
          </div>

          <div className='flex flex-col gap-3 border-t border-border bg-surface-1 px-6 py-5'>
            <ApplyButton study={study} locale={locale} />
          </div>
        </aside>
      </div>
    </div>
  );
}
