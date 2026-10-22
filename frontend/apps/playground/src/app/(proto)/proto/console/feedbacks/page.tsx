import { FeedbacksTable } from '@console/components/FeedbacksTable';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '의견' };

export default function FeedbacksAdmin() {
  return (
    <div>
      <ScreenSpecRegistrar spec={SPEC} />
      <FeedbacksTable />
    </div>
  );
}
