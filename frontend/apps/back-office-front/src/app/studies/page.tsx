import { StudyCreateButton } from '@/components/StudyCreateButton';
import { PageHeader } from '@/components/ui';
import { resolveListFilters, serverListQuery, type StudyListData } from '@/features/studies/list-filters';
import { StudiesTable } from '@/features/studies/StudiesTable';
import { fetchStudies, fetchStudyListPage } from '@/lib/api';

export const metadata = { title: '스터디' };

/**
 * 걸린 조건을 서버가 처리할 수 있으면 서버가 자른 한 페이지를, 아니면 전체를 받아 화면이 거른다
 * (features/studies/list-filters). 조건을 바꾸면 주소가 바뀌고 이 컴포넌트가 다시 받는다.
 */
export default async function StudiesAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = serverListQuery(resolveListFilters(await searchParams));
  const list: StudyListData = query ? await fetchStudyListPage(query) : { mode: 'all', studies: await fetchStudies() };

  return (
    <div>
      <PageHeader title='스터디 관리' action={<StudyCreateButton />} />
      <StudiesTable list={list} />
    </div>
  );
}
