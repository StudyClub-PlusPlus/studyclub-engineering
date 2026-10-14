import Link from 'next/link';

import { userStudyPath, type Locale, type Operator, type Study } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { recruitBadge, studyStartValue, studyTimezoneLabel } from '@core/lib/recruit';
import { StudyCard } from '@studyclub/ui';
import { CalendarClock, Globe, Rocket } from 'lucide-react';

/** `2026-10-05` → `10/05`. 값이 날짜가 아니면(미정 등 자기설명 문구) 그대로 둔다. */
function shortDate(value: string): string {
  const m = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : value;
}

/**
 * 스터디 목록 카드 — `Study` 를 @studyclub/ui `StudyCard` 에 맞춰 넘긴다. 모양은 ui 에서만 고친다.
 * 둘러보기 전용(신청·찜·HOT 없음)이고 목록·상세가 같은 함수(`@core/lib/recruit`)로 배지를 만든다.
 * 모집 마감일은 배지의 D-N/모집 마감과 항상 겹치므로 본문에는 시작 예정일만 남긴다.
 */
export function StudyListCard({ study, locale }: { study: Study; locale: Locale; lead?: Operator; index?: number }) {
  const badge = recruitBadge(study, locale);
  const details = [
    ...(study.schedule ? [{ icon: CalendarClock, label: t(study.schedule, locale) }] : []),
    { icon: Globe, label: studyTimezoneLabel(study, locale) },
    {
      icon: Rocket,
      label: `${t({ ko: '시작 예정일', en: 'Starts' }, locale)} ${shortDate(studyStartValue(study, locale))}`,
    },
  ];

  return (
    <StudyCard
      data-anno='5-1'
      href={userStudyPath(locale, study)}
      linkAs={Link}
      title={t(study.title, locale)}
      category={study.category}
      badge={{ label: badge.label, dotClassName: badge.dotClass }}
      summary={t(study.summary, locale)}
      details={details}
    />
  );
}
