'use client';

import Link from 'next/link';

import type { Locale, Operator } from '@studyclub/types';

import { useStudies } from '@/features/studies/queries';
import { StudyListCard } from '@/features/studies/StudyListCard';
import { m, t } from '@/lib/i18n';

/** Featured 스터디 목록 — 서버가 GET /api/studies 로 받은 값을 넘겨받는다 */
export function FeaturedStudies({ locale, leads }: { locale: Locale; leads: Record<string, Operator> }) {
  const { data: studies = [] } = useStudies({});

  const featured = studies
    .filter((s) => s.status === 'recruiting' || s.status === 'ongoing')
    .sort(
      (a, b) =>
        (a.status === 'recruiting' ? 0 : 1) - (b.status === 'recruiting' ? 0 : 1) || (a.order ?? 99) - (b.order ?? 99),
    )
    .slice(0, 6);

  if (featured.length === 0) return null;

  return (
    <section className='pb-14'>
      <div className='mb-5 flex items-end justify-between gap-4'>
        <h2 className='type-title-lg'>{m('studies.title', locale)}</h2>
        <Link
          href={`/${locale}/studies`}
          className='shrink-0 type-label-lg text-[var(--color-brand)] hover:underline'
        >
          {t({ ko: '전체 보기', en: 'View all' }, locale)} →
        </Link>
      </div>
      <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3'>
        {featured.map((s, i) => (
          <StudyListCard
            key={s.id}
            study={s}
            locale={locale}
            lead={s.lead ? leads[s.lead] : undefined}
            index={i}
            source='landing'
          />
        ))}
      </div>
    </section>
  );
}
