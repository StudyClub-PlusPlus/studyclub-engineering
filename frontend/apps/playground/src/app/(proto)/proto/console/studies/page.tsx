
import { StudiesTable } from '@console/components/StudiesTable';
import { StudyCreateButton } from '@console/components/StudyCreateButton';
import { PageHeader } from '@console/components/ui';
import { studies } from '@studyclub/mock';

export const metadata = { title: '스터디' };

export default function StudiesAdmin() {
  return (
    <div>
      <PageHeader title='스터디 관리' action={<StudyCreateButton />} />
      <StudiesTable studies={studies} />
    </div>
  );
}
