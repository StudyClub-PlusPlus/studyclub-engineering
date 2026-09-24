import Link from 'next/link';
import { notFound } from 'next/navigation';


import { MarkdownLite } from '@core/components/ApplicationFormUi';
import { ApplyButton } from '@core/components/ApplyButton';
import { categoryGradient, categoryMeta } from '@core/components/StudyThumb';
import { getStudy, getStudies, type Locale } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { recruitBadge, studyStartValue, studyTimezoneLabel, toISODate } from '@core/lib/recruit';
import { getStudyCrew, recruitCapacity } from '@studyclub/mock';
import { ArrowLeft, CalendarClock, Globe, Rocket } from 'lucide-react';

import { SPECS } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export async function generateStaticParams() {
  const studies = await getStudies();
  // 조회 키는 study_id(STUDY.ID) — 슬러그(s.id)는 내부 키일 뿐 URL에 쓰지 않는다. getStudy()와 짝이 맞아야 한다.
  return studies.map((s) => ({ id: String(s.study_id) }));
}

/**
 * 스터디 상세.
 *
 * **등록 폼(운영자 콘솔)에 있는 항목만 노출한다.** 폼에 없는 값은 운영자가 채울 방법이 없으므로
 * 화면에도 두지 않는다 — 목표·주제·대상·주차 커리큘럼·멤버·후기·통계 전부 제외.
 * 모집 정원은 폼에 있으므로 참여 인원(현재/정원)으로 보인다.
 *
 * 레이아웃은 카드 하나로 묶는다. 헤더(색)–본문(흰색)–신청(고정 바)이 한 덩어리로 읽히게 해서
 * 요소가 따로 떠 보이지 않도록 한다.
 *
 * 찜·인기(HOT) 배지는 두지 않는다 — 목록 카드와 같은 결정이다(둘러보기 전용 정보는 목록에,
 * 신청 여부에 영향을 주는 정보만 여기 남긴다). 헤더 상태 배지·시작 예정일은 목록 카드와 같은
 * 함수(`@core/lib/recruit`)로 계산한다 — 모집 마감일은 배지와 항상 겹치므로 고정 바에 따로 두지 않는다.
 */
export default async function StudyDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const study = await getStudy(id);
  if (!study) notFound();

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

      {/* 본문 전체가 하나의 카드 — 헤더와 내용이 분리돼 보이지 않게 한다 */}
      <article className='card mt-4 overflow-hidden'>
        {/* 헤더: 카테고리 색. 목록 카드와 같은 규칙이라 어디서 왔는지 바로 이어진다 */}
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
          {/* 일정 · 시간대 — 목록 카드와 같은 판정을 쓴다 */}
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

        {/* 참여 현황 — 신청 여부와 무관하게 알아 둘 정보라 본문에 둔다. 모집 마감일은 헤더 배지에 이미 있다 */}
        <div className='flex flex-col gap-1 border-t border-border px-8 py-5'>
          <span className='tnum text-sm font-medium text-fg-secondary'>
            <span data-anno='view:3'>
              {cap
                ? t({ ko: `참여 ${joined}/${cap}명`, en: `${joined}/${cap} joined` }, locale)
                : t({ ko: `참여 ${joined}명 · 정원 제한 없음`, en: `${joined} joined · no limit` }, locale)}
            </span>
            {deadline ? ` · ${t({ ko: `${deadline}까지 모집`, en: `Apply by ${deadline}` }, locale)}` : ''}
          </span>
          {/* 클럽은 기수가 바뀌어도 참여가 이어진다. 스터디는 공고마다 새로 신청한다. */}
          <span data-anno='view:4' className='text-xs text-fg-muted'>
            {study.program?.kind === 'club'
              ? t({ ko: '클럽 — 이전 기수 참여자는 새 기수에 신청 없이 자동으로 이어집니다.', en: 'Club — members carry over to new cohorts without re-applying.' }, locale)
              : t({ ko: '스터디 — 참여하려면 신청이 필요합니다.', en: 'Study — you need to apply to join.' }, locale)}
          </span>
        </div>

        {/*
          신청은 카드의 마지막 줄에 둔다. 정보를 다 읽은 직후가 결정 시점이고,
          카드 밖 고정 바는 페이지가 짧을 때 본문과 분리돼 떠 보인다.
        */}
        <div className='flex flex-wrap items-center justify-between gap-4 border-t border-border bg-surface-1 px-8 py-5'>
          {/* 모집 마감일은 헤더 배지(D-N/모집 마감)와 항상 겹치므로 여기 따로 두지 않는다 */}
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
