import { getStudies, getStudy, type Locale } from '@core/lib/content';
import { withConfirmedScheduleExample } from '@core/lib/recruit';

import { StudyDetailView } from '@/proto/core/components/StudyDetailView';

export async function generateStaticParams() {
  const studies = await getStudies();
  // 조회 키는 study_id(STUDY.ID) — 내부 키(s.id)는 URL 에 쓰지 않는다. getStudy()와 짝이 맞아야 한다.
  return studies.map((s) => ({ id: String(s.study_id) }));
}

/**
 * 스터디 상세.
 *
 * 등록 폼(운영자 콘솔)에 있는 항목만 노출한다.
 * 클라이언트 뷰 컴포넌트(StudyDetailView)에서 MSW Devtool 상태(정상, 404, 500)에 반응한다.
 */
export default async function StudyDetail({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ scenario?: string }>;
}) {
  const schedulePreview = (await searchParams).scenario === 'confirmed-schedule';
  const { locale, id } = await params;
  const study = await getStudy(id);

  return (
    <StudyDetailView
      study={study && schedulePreview ? withConfirmedScheduleExample(study) : study}
      id={id}
      locale={locale}
      schedulePreview={schedulePreview}
    />
  );
}
