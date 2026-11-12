import { PageHeader } from '@/components/ui';
import { resolveListFilters, serverListQuery } from '@/features/studies/list-filters';
import { fetchStudyListPage } from '@/features/studies/server';
import { StudiesTable } from '@/features/studies/StudiesTable';
import { StudyCreateButton } from '@/features/studies/StudyCreateButton';

export const metadata = { title: '스터디' };

/** URL의 모든 검색·필터·정렬 조건을 서버에 전달해 한 페이지를 조회한다. */
export default async function StudiesAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = serverListQuery(resolveListFilters(await searchParams));
  const list = await fetchStudyListPage(query);

  return (
    <div>
      <PageHeader title='스터디 관리' action={<StudyCreateButton />} />
      <StudiesTable list={list} />
    </div>
  );
}
