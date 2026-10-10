import type { Metadata } from 'next';

import { StudyBrowser } from '@/components/StudyBrowser';
import { getOperatorMap, type Locale } from '@/lib/content';
import { m } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/studies',
    title: m('studies.title', locale),
    description: m('seo.studies_description', locale),
  });
}

export default async function StudiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  // 목록 조건을 URL(`?q=…`)로 받는다 — searchParams 를 읽어 요청마다 렌더한다. 정적으로 두면 클라이언트의
  // useSearchParams 때문에 페이지 전체가 브라우저 렌더로 넘어가 HTML 에 목록·제목이 빠진다(SEO).
  await searchParams;
  const leads = await getOperatorMap();

  return (
    <div className='mx-auto max-w-6xl px-6 pb-14 pt-6'>
      <StudyBrowser locale={locale} leads={leads} />
    </div>
  );
}
