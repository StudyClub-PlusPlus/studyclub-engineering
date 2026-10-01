import type { Metadata } from 'next';

import { StudyDetailView } from '@/components/StudyDetailView';
import { getStudies, getStudy, type Locale } from '@/lib/content';
import { t } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateStaticParams() {
  const studies = await getStudies();
  return studies.map((s) => ({ id: String(s.study_id) }));
}

/**
 * 스터디 상세.
 *
 * 등록 폼(운영자 콘솔)에 있는 항목만 노출한다.
 * 클라이언트 단에서는 MSW / API (/api/studies/:id) 상태(정상, 404, 500)에 반응한다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const study = await getStudy(Number(id));
  if (!study) return {};

  const name = t(study.title, locale);
  const category = study.category ? `${study.category} · ` : '';
  const summary = t(study.description ?? study.summary, locale);
  return pageMetadata({
    locale,
    path: `/studies/${id}`,
    title: `${category}${name}`,
    description: summary.slice(0, 155),
    image: study.image,
    ogType: 'article',
  });
}

export default async function StudyDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  return <StudyDetailView id={Number(id)} locale={locale} />;
}
