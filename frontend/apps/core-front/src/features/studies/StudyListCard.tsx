'use client';

import Link from 'next/link';

import type { Locale, Operator, Study } from '@studyclub/types';
import { StudyCard } from '@studyclub/ui';
import { CalendarClock, Globe, Rocket } from 'lucide-react';

import { recruitBadge, studyStartValue, studyTimezoneLabel } from '@/features/studies/recruit';
import { track } from '@/lib/analytics';
import { t } from '@/lib/i18n';

/** `2026-10-05` → `10/05`. 값이 날짜가 아니면(상시 모집·미정 등 자기설명 문구) 그대로 둔다. */
function shortDate(value: string): string {
  const m = value.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : value;
}

/**
 * 스터디 목록 카드 — `Study` 를 @studyclub/ui `StudyCard` 에 맞춰 넘긴다. 모양은 ui 에서만 고친다.
 * 모집 마감일은 배지의 D-N/모집 마감/상시 모집과 항상 겹치므로 본문에는 시작 예정일만 남긴다.
 */
export function StudyListCard({
  study,
  locale,
  index,
  source = 'studies_list',
}: {
  study: Study;
  locale: Locale;
  lead?: Operator;
  index?: number;
  source?: 'landing' | 'studies_list';
}) {
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
      href={`/${locale}/studies/${study.study_id}`}
      linkAs={Link}
      title={t(study.title, locale)}
      category={study.category}
      badge={{ label: badge.label, dotClassName: badge.dotClass }}
      summary={t(study.summary, locale)}
      details={details}
      // 카드 전체를 덮는 링크의 클릭이 바깥 div 로 올라온다 — ui 부품을 고치지 않고 여기서 잡는다
      onClick={() =>
        track({
          name: 'Study Card Clicked',
          props: {
            study_id: String(study.study_id),
            study_title_ko: study.title.ko,
            study_category: study.category,
            study_status: study.status,
            source,
            card_position: index ?? 0,
          },
        })
      }
    />
  );
}
