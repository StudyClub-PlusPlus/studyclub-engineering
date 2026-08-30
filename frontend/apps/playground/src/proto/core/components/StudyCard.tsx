import Link from 'next/link';

import type { Locale, Operator, Study } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { recruitLabel, recruitState, toISODate } from '@core/lib/recruit';
import { isHotStudy } from '@studyclub/mock';
import { CalendarClock } from 'lucide-react';

import { BookmarkButton } from './BookmarkButton';
import { HotBadge } from './HotBadge';
import { categoryGradient, categoryMeta } from './StudyThumb';

function RecruitCta({ study, locale }: { study: Study; locale: Locale }) {
  const state = recruitState(study);
  const label = recruitLabel(state, locale);
  const base = 'inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-pill px-5 text-[13px] font-bold';

  if (state === 'apply') {
    return (
      <a
        // TODO(api): 사내 신청 플로우가 생기면 그 경로로 교체. 외부 폼이 남아 있으면 그쪽 우선.
        href={study.recruit_url ?? `/proto/core/${locale}/studies/${study.id}`}
        {...(study.recruit_url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        // z-[2] — 카드 전체를 덮는 stretched link 위로 올려 클릭을 가로챈다
        className={`${base} relative z-[2] bg-brand text-on-brand shadow-sm transition-[background-color,box-shadow,transform] hover:bg-brand-hover hover:shadow-md hover:scale-[1.04] focus-visible:outline-none focus-visible:shadow-[var(--ring)]`}
      >
        {label}
      </a>
    );
  }

  return <span className={`${base} bg-surface-2 text-fg-placeholder`}>{label}</span>;
}

export function StudyCard({ study, locale }: { study: Study; locale: Locale; lead?: Operator; index?: number }) {
  const { icon: CategoryIcon, label: categoryLabel } = categoryMeta(study.category);
  const deadline = recruitState(study) === 'closed' ? undefined : toISODate(study.recruitment?.deadline);

  return (
    <div className='card card-hover relative flex flex-col overflow-hidden'>
      {/* Stretched link — covers the whole card without nesting anchors */}
      <Link
        href={`/proto/core/${locale}/studies/${study.id}`}
        className='absolute inset-0 z-[1] rounded-[inherit]'
        aria-label={t(study.title, locale)}
      />

      {/* 컬러 헤더 — 배너 지면을 제목이 차지한다. 색은 카테고리를 따라간다(같은 분야 = 같은 색). */}
      <div
        className='relative flex min-h-[124px] flex-col justify-between gap-2 overflow-hidden px-5 pb-4 pt-4'
        style={{ background: categoryGradient(study.category) }}
      >
        <CategoryIcon
          className='pointer-events-none absolute -bottom-5 -right-4 text-white/15'
          size={104}
          strokeWidth={1.25}
          aria-hidden='true'
        />
        <div className='relative flex items-start justify-between gap-3'>
          <span className='flex items-center gap-1.5 pt-1 text-white/85'>
            <CategoryIcon size={13} strokeWidth={1.75} className='shrink-0' />
            <span className='text-[11px] font-bold uppercase tracking-[0.14em]'>{categoryLabel}</span>
          </span>
          <div className='flex shrink-0 items-center gap-2'>
            {isHotStudy(study) && <HotBadge />}
            <BookmarkButton studyId={study.id} locale={locale} />
          </div>
        </div>
        {/* 최대 2줄 — 넘치면 말줄임. 카드 높이를 균일하게 유지한다. */}
        <h3 className='relative line-clamp-2 break-keep text-2xl font-extrabold leading-[1.25] tracking-tight text-white'>
          {t(study.title, locale)}
        </h3>
      </div>

      <div className='flex flex-1 flex-col gap-3 p-5'>
        <p className='line-clamp-2 text-[15px] leading-relaxed text-fg-secondary'>{t(study.summary, locale)}</p>

        {study.schedule && (
          <p className='flex items-center gap-1.5 text-[13px] font-medium text-fg-secondary'>
            <CalendarClock size={13} strokeWidth={1.75} className='shrink-0' />
            {t(study.schedule, locale)}
          </p>
        )}

        {/* 하단: 좌측 마감일, 우측 신청 버튼 */}
        <div className='mt-auto flex items-center justify-between gap-2 border-t border-border pt-3'>
          <span className='tnum text-[12px] font-medium text-fg-secondary'>
            {deadline ? t({ ko: `${deadline}까지`, en: `by ${deadline}` }, locale) : ''}
          </span>
          <RecruitCta study={study} locale={locale} />
        </div>
      </div>
    </div>
  );
}
