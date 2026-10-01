'use client';

import Link from 'next/link';

import { StudyCard } from '@/components/StudyCard';
import { useStudies } from '@/features/studies/queries';
import type { Locale, Operator } from '@/lib/content';
import { m, t } from '@/lib/i18n';

/** TODO(api): GET /api/studies — Featured 스터디 목록 */
export function FeaturedStudies({
  locale,
  leads,
}: {
  locale: Locale;
  leads: Record<string, Operator>;
}) {
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
        <h2 className='text-xl font-bold tracking-tight'>{m('studies.title', locale)}</h2>
        <Link href={`/${locale}/studies`} className='shrink-0 text-sm font-medium text-[var(--color-accent)] hover:underline'>
          {t({ ko: '전체 보기', en: 'View all' }, locale)} →
        </Link>
      </div>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {featured.map((s) => (
          <StudyCard key={s.id} study={s} locale={locale} lead={s.lead ? leads[s.lead] : undefined} />
        ))}
      </div>
    </section>
  );
}
