
import { StudiesTableContainer } from '@console/components/StudiesTableContainer';
import { StudyCreateButton } from '@console/components/StudyCreateButton';
import { StudyStatusGuide } from '@console/components/StudyStatusGuide';
import { PageHeader } from '@console/components/ui';

import { SPECS } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '스터디' };

export default function StudiesAdmin() {
  return (
    <div>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.chip ?? spec.screen} spec={spec} />
      ))}
      <PageHeader title='스터디 관리' action={<StudyCreateButton />} />
      <StudyStatusGuide />
      <StudiesTableContainer />
    </div>
  );
}
