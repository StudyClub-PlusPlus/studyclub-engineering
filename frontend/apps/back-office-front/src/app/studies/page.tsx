import { StudiesTable } from '@/components/StudiesTable';
import { StudyCreateButton } from '@/components/StudyCreateButton';
import { PageHeader } from '@/components/ui';
import { fetchStudies } from '@/lib/api';

export const metadata = { title: '스터디' };

export default async function StudiesAdmin() {
  const studies = await fetchStudies();

  return (
    <div>
      <PageHeader title='스터디 관리' action={<StudyCreateButton />} />
      <StudiesTable studies={studies} />
    </div>
  );
}
