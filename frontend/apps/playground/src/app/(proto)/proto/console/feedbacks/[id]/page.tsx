import { FeedbackDetail } from '@console/components/FeedbackDetail';

import { SPEC } from '../spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export const metadata = { title: '의견' };

export default async function FeedbackAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <ScreenSpecRegistrar spec={SPEC} />
      <FeedbackDetail id={id} />
    </div>
  );
}
