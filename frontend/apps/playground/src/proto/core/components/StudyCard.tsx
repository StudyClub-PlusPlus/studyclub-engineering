import Link from 'next/link';

import { userStudyPath, type Locale, type Operator, type Study } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { recruitBadge, studyStartValue, studyTimezoneLabel } from '@core/lib/recruit';
import { CalendarClock, Globe, Rocket } from 'lucide-react';

import { categoryGradient, categoryMeta } from './StudyThumb';

/** `2026-10-05` → `10/05`. 값이 날짜가 아니면(상시 모집·미정 등 자기설명 문구) 그대로 둔다. */
function shortDate(value: string): string {
  const m = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : value;
}

export function StudyCard({ study, locale }: { study: Study; locale: Locale; lead?: Operator; index?: number }) {
  const { icon: CategoryIcon, label: categoryLabel } = categoryMeta(study.category);
  const badge = recruitBadge(study, locale);
  const startValue = studyStartValue(study, locale);
  const timezoneLabel = studyTimezoneLabel(study, locale);
  const startText = `${t({ ko: '시작 예정일', en: 'Starts' }, locale)} ${shortDate(startValue)}`;

  return (
    <div data-anno='5-1' className='card card-hover relative flex flex-col overflow-hidden'>
      {/* Stretched link — covers the whole card without nesting anchors */}
      <Link
        href={userStudyPath(locale, study)}
        className='absolute inset-0 z-[1] rounded-[inherit]'
        aria-label={t(study.title, locale)}
      />

      {/* 컬러 헤더 — 고정 높이. 색은 카테고리를 따라간다(같은 분야 = 같은 색) */}
      <div
        className='relative flex h-40 shrink-0 flex-col justify-between overflow-hidden p-4'
        style={{ background: categoryGradient(study.category) }}
      >
        <CategoryIcon
          className='pointer-events-none absolute -bottom-5 -right-4 text-white/15'
          size={104}
          strokeWidth={1.25}
          aria-hidden='true'
        />
        <span className='relative inline-flex w-fit items-center gap-1.5 rounded-pill bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md'>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${badge.dotClass}`} aria-hidden='true' />
          {badge.label}
        </span>
        <div className='relative text-white'>
          <span className='flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70'>
            <CategoryIcon size={12} strokeWidth={1.75} className='shrink-0' />
            {categoryLabel}
          </span>
          {/* 최대 2줄 — 넘치면 말줄임. 카드 높이를 균일하게 유지한다. */}
          <h3 className='mt-1 line-clamp-2 break-keep text-xl font-bold leading-[1.3] tracking-tight'>
            {t(study.title, locale)}
          </h3>
        </div>
      </div>

      {/*
        본문 — 한 줄 소개·일정·시간대·시작 예정일을 한 영역에 모은다. 별도 하단 바로 분리하지 않는다.
        모집 마감일은 배지의 D-N/모집 마감/상시 모집과 항상 겹치므로 본문에 따로 두지 않는다.
      */}
      <div className='flex flex-1 flex-col gap-3 p-5'>
        <p className='line-clamp-2 text-sm leading-relaxed text-fg-secondary'>{t(study.summary, locale)}</p>

        <div className='space-y-1.5 text-xs text-fg-muted'>
          {study.schedule && (
            <div className='flex items-center gap-2'>
              <CalendarClock size={13} strokeWidth={1.75} className='shrink-0' />
              {t(study.schedule, locale)}
            </div>
          )}
          <div className='flex items-center gap-2'>
            <Globe size={13} strokeWidth={1.75} className='shrink-0' />
            {timezoneLabel}
          </div>
          <div className='flex items-center gap-2'>
            <Rocket size={13} strokeWidth={1.75} className='shrink-0' />
            {startText}
          </div>
        </div>
      </div>
    </div>
  );
}
