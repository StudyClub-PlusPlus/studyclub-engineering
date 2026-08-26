import { studies } from '@studyclub/mock';

import { StudiesTable } from '@/components/StudiesTable';
import { StudyCreateButton } from '@/components/StudyCreateButton';
import { PageHeader } from '@/components/ui';

export const metadata = { title: '스터디' };

export default function StudiesAdmin() {
  return (
    <div>
      <PageHeader title='스터디 관리' action={<StudyCreateButton />} />
      <StudiesTable studies={studies} />
    </div>
  );
}
