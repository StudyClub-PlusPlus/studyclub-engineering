import { StudyBrowser } from '@core/components/StudyBrowser';
import { getStudies, getOperatorMap, type Locale } from '@core/lib/content';
import { withConfirmedScheduleExample } from '@core/lib/recruit';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

const STATUS_RANK: Record<string, number> = { recruiting: 0, ongoing: 1, closed: 2 };

export default async function StudiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ scenario?: string }>;
}) {
  const schedulePreview = (await searchParams).scenario === 'confirmed-schedule';
  const { locale } = await params;
  const [studies, leads] = await Promise.all([getStudies(), getOperatorMap()]);

  const sorted = [...studies].sort(
    (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || (a.order ?? 99) - (b.order ?? 99),
  );

  return (
    <div className='mx-auto max-w-6xl px-6 pb-14 pt-6'>
      <ScreenSpecRegistrar spec={SPEC} />
      {schedulePreview && <p className='mb-4 type-label-lg text-fg-secondary'>확정 일정 예시 · 시간대 변환 확인용</p>}
      <StudyBrowser
        studies={schedulePreview ? sorted.map(withConfirmedScheduleExample) : sorted}
        schedulePreview={schedulePreview}
        locale={locale}
        leads={leads}
      />
    </div>
  );
}
