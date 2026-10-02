'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';


import { MarkdownLite } from '@core/components/ApplicationFormUi';
import { ApplyButton } from '@core/components/ApplyButton';
import { categoryGradient, categoryMeta } from '@core/components/StudyThumb';
import type { Locale, Study } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { recruitBadge, studyStartValue, studyTimezoneLabel, toISODate } from '@core/lib/recruit';
import { getStudyCrew, recruitCapacity, studies as mockStudies } from '@studyclub/mock';
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
      <div className='mx-auto max-w-3xl px-6 py-20 text-center'>
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
      <div className='mx-auto max-w-3xl px-6 py-20 text-center'>
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
  const startValue = studyStartValue(study, locale);
  const startText = `${t({ ko: '시작 예정일', en: 'Starts' }, locale)} ${startValue}`;
  const timezoneLabel = studyTimezoneLabel(study, locale);
  const deadline = toISODate(study.recruitment?.deadline);
  const joined = getStudyCrew(study).crew.filter((c) => c.status === 'active').length;
  const cap = recruitCapacity(study);

  return (
    <div className='mx-auto max-w-3xl px-6 pb-16 pt-8'>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.chip ?? spec.screen} spec={spec} />
      ))}
      <Link
        href={`/proto/core/${locale}/studies`}
        className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition-colors hover:text-fg'
      >
        <ArrowLeft size={15} /> {m('common.back_studies', locale)}
      </Link>

      <article className='card mt-4 overflow-hidden'>
        <header
          className='flex flex-col gap-2.5 px-8 pb-7 pt-6'
          style={{ background: categoryGradient(study.category) }}
        >
          <span className='inline-flex w-fit items-center gap-1.5 rounded-pill bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md'>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dotClass}`} aria-hidden='true' />
            {badge.label}
          </span>
          <div className='flex items-center gap-1.5 text-white/85'>
            <CategoryIcon size={14} strokeWidth={1.75} className='shrink-0' />
            <span className='text-[11px] font-bold uppercase tracking-[0.14em]'>{categoryLabel}</span>
          </div>
          <h1 className='break-keep text-[28px] font-bold leading-[1.25] tracking-tight text-white'>
            {t(study.title, locale)}
          </h1>
          <p className='text-[16px] leading-relaxed text-white/90'>{t(study.summary, locale)}</p>
          <p className='flex items-center gap-1.5 text-[14px] font-medium text-white/90'>
            {study.schedule ? (
              <>
                <CalendarClock size={14} strokeWidth={1.75} className='shrink-0' />
                {t(study.schedule, locale)}
                <span className='text-white/70'>· {timezoneLabel}</span>
              </>
            ) : (
              <>
                <Globe size={14} strokeWidth={1.75} className='shrink-0' />
                {timezoneLabel}
              </>
            )}
          </p>
        </header>

        {study.description && (
          <div className='px-8 py-7'>
            <h2 className='text-[15px] font-bold text-fg'>{m('common.about_study', locale)}</h2>
            <MarkdownLite
              text={t(study.description, locale)}
              className='mt-3 whitespace-pre-line text-[16px] leading-[1.85] text-fg-secondary'
            />
          </div>
        )}

        <div className='flex flex-col gap-1 border-t border-border px-8 py-5'>
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
              ? t({ ko: '클럽 — 이전 기수 참여자는 새 기수에 신청 없이 자동으로 이어집니다.', en: 'Club — members carry over to new cohorts without re-applying.' }, locale)
              : t({ ko: '스터디 — 참여하려면 신청이 필요합니다.', en: 'Study — you need to apply to join.' }, locale)}
          </span>
        </div>

        <div className='flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface-1 px-8 py-5'>
          <span className='tnum flex items-center gap-1.5 text-sm font-semibold text-fg-secondary'>
            <Rocket size={14} strokeWidth={2} className='shrink-0' />
            {startText}
          </span>
          <ApplyButton study={study} locale={locale} />
        </div>
      </article>
    </div>
  );
}
